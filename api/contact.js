/**
 * Vercel Serverless Function: /api/contact
 *
 * Handles complete contact form submission with multi-layered anti-spam:
 * 1. Honeypot check (silent drop for bots)
 * 2. IP-based rate limiting (3 submissions per 10 minutes per IP -> HTTP 429)
 * 3. Duplicate payload detection (IP + email + message hash within 5 mins)
 * 4. Local email syntax validation (RFC 5321)
 * 5. Abstract API email reputation check (disposable, MX, deliverability)
 * 6. Server-side proxy forwarding to Formspree
 *
 * The Abstract API key lives ONLY in process.env.ABSTRACT_API_KEY
 */

'use strict';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwvbnaze';
const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';

const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// In-memory IP rate limiter: max 3 submissions per IP per 10 minutes
const ipSubmissionMap = new Map(); // IP -> Array of timestamps
const SUBMISSION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SUBMISSIONS_PER_IP = 3;

// In-memory duplicate payload cache (IP + email + trimmed message)
const payloadCache = new Map(); // hash -> timestamp
const PAYLOAD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory Abstract API validation cache
const emailCache = new Map();
const EMAIL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Abstract API Circuit Breaker
let quotaExhaustedUntil = 0;
const CIRCUIT_BREAKER_COOL_DOWN_MS = 15 * 60 * 1000; // 15 minutes

function fetchWithTimeout(url, options, ms = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function getBool(data, key1, key2) {
  if (!data) return null;
  const val = data[key1] !== undefined ? data[key1] : (key2 ? data[key2] : undefined);
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'object' && typeof val.value === 'boolean') return val.value;
  return null;
}

function isIpRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const timestamps = (ipSubmissionMap.get(ip) || []).filter(t => now - t < SUBMISSION_WINDOW_MS);
  if (timestamps.length >= MAX_SUBMISSIONS_PER_IP) {
    ipSubmissionMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  ipSubmissionMap.set(ip, timestamps);
  return false;
}

function isDuplicatePayload(ip, email, message) {
  const now = Date.now();
  const key = `${ip}:${email.toLowerCase()}:${message.trim().toLowerCase()}`;
  const lastTime = payloadCache.get(key);
  if (lastTime && (now - lastTime < PAYLOAD_CACHE_TTL_MS)) {
    return true;
  }
  payloadCache.set(key, now);
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  const body = req.body || {};
  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const subject = (body.subject || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const websiteHp = (body.website_hp || '').toString().trim();

  // ── Layer 1: Honeypot Check (Invisible field trap for bots) ──────────────
  if (websiteHp !== '') {
    console.warn('[api/contact] Honeypot field populated. Silently dropping bot submission.');
    // Pretend success so bots do not retry
    return res.status(200).json({ success: true, message: 'Thank you—your message has been sent.' });
  }

  // ── Layer 2: Server-Side IP Rate Limiting (3 submissions / 10 mins) ──────
  // On Vercel, x-real-ip is injected by Vercel's edge proxy and cannot be spoofed by the client.
  const rawIp = req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].toString().split(',')[0] : '') ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const clientIp = rawIp.toString().trim();

  if (isIpRateLimited(clientIp)) {
    console.warn(`[api/contact] Rate limit exceeded for IP: ${clientIp}`);
    return res.status(429).json({
      error: 'Too many contact submissions from this IP. Please wait 10 minutes before sending another message.',
    });
  }

  // ── Layer 3: Duplicate Payload Prevention ────────────────────────────────
  if (isDuplicatePayload(clientIp, email, message)) {
    console.warn(`[api/contact] Duplicate payload blocked from IP: ${clientIp}`);
    return res.status(400).json({
      error: 'Duplicate message detected. Please wait a few minutes before resubmitting.',
    });
  }

  // ── Layer 4: Basic Input Validation ──────────────────────────────────────
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required fields.' });
  }

  // Local Syntax Validation
  if (!EMAIL_FORMAT_REGEX.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address, for example name@example.com.' });
  }

  // ── Layer 5: Abstract API Email Reputation Check ────────────────────────
  const apiKey = process.env.ABSTRACT_API_KEY;
  let validationResult = { valid: true };

  if (apiKey && apiKey.trim() !== '') {
    const cacheKey = email.toLowerCase();
    const cached = emailCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < EMAIL_CACHE_TTL_MS)) {
      validationResult = cached.result;
    } else if (Date.now() >= quotaExhaustedUntil) {
      try {
        const url = `${ABSTRACT_API_URL}?api_key=${apiKey.trim()}&email=${encodeURIComponent(email)}`;
        const abstractRes = await fetchWithTimeout(url, { method: 'GET' }, 7000);

        if (abstractRes.status === 429 || abstractRes.status === 401 || abstractRes.status === 403) {
          console.warn(`[api/contact] Abstract API HTTP ${abstractRes.status}. Activating circuit breaker.`);
          quotaExhaustedUntil = Date.now() + CIRCUIT_BREAKER_COOL_DOWN_MS;
        } else if (abstractRes.ok) {
          const data = await abstractRes.json();
          const isFormatValid = getBool(data, 'is_valid_format', 'is_format_valid');
          const isDisposable = getBool(data, 'is_disposable_email', 'is_disposable');
          const isMxFound = getBool(data, 'is_mx_found', 'is_mx_valid');
          const isSmtpValid = getBool(data, 'is_smtp_valid');
          const deliverability = (typeof data.deliverability === 'string')
            ? data.deliverability.toUpperCase()
            : (data.status ? data.status.toString().toUpperCase() : 'UNKNOWN');

          if (isFormatValid === false) {
            validationResult = { valid: false, reason: 'Enter a valid email address, for example name@example.com.' };
          } else if (isDisposable === true) {
            validationResult = { valid: false, reason: 'Disposable or temporary email addresses are not accepted.' };
          } else if (isMxFound === false) {
            validationResult = { valid: false, reason: 'This domain cannot receive emails. Please check your email for typos.' };
          } else if (deliverability === 'UNDELIVERABLE' || isSmtpValid === false) {
            validationResult = { valid: false, reason: 'This email address does not appear to exist. Please use a real address.' };
          } else {
            validationResult = { valid: true };
          }

          emailCache.set(cacheKey, { result: validationResult, timestamp: Date.now() });
        }
      } catch (err) {
        console.warn('[api/contact] Abstract API error, falling back:', err.message);
      }
    }
  }

  if (!validationResult.valid) {
    return res.status(400).json({ error: validationResult.reason || 'Invalid email address.' });
  }

  // ── Layer 6: Forward Payload to Formspree (Server-Side Proxy) ───────────
  try {
    const formspreeRes = await fetchWithTimeout(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        subject: subject || 'Portfolio Contact Form Submission',
        message,
      }),
    }, 10000);

    if (!formspreeRes.ok) {
      console.error('[api/contact] Formspree responded with HTTP', formspreeRes.status);
      return res.status(500).json({ error: 'Failed to send message via form provider. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: 'Thank you—your message has been sent.' });

  } catch (err) {
    console.error('[api/contact] Error forwarding to Formspree:', err.message);
    return res.status(500).json({ error: 'Server network error while submitting form. Please try again.' });
  }
};
