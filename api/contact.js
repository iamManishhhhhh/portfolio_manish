/**
 * Vercel Serverless Function: /api/contact
 *
 * Handles complete contact form submission with multi-layered anti-spam:
 * 1. Honeypot check (silent drop for bots)
 * 2. Distributed Upstash Redis IP rate limiting (5 submissions per 10 mins per IP -> HTTP 429)
 * 3. Duplicate payload detection (IP + email + message hash within 5 mins)
 * 4. Local email syntax validation (RFC 5321)
 * 5. Abstract API email reputation check (disposable, MX, deliverability)
 * 6. Server-side proxy forwarding to Formspree
 *
 * Environment Variables (Server-side ONLY):
 * - ABSTRACT_API_KEY
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

'use strict';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwvbnaze';
const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';

const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Distributed Rate Limiter Config
const MAX_SUBMISSIONS_PER_IP = 5;
const RATE_LIMIT_TTL_SECONDS = 600; // 10 minutes (600 seconds)

// In-memory duplicate payload cache (IP + email + trimmed message)
const payloadCache = new Map();
const PAYLOAD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory Abstract API validation cache
const emailCache = new Map();
const EMAIL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Abstract API Circuit Breaker
let quotaExhaustedUntil = 0;
const CIRCUIT_BREAKER_COOL_DOWN_MS = 15 * 60 * 1000; // 15 minutes

function fetchWithTimeout(url, options, ms = 5000) {
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

/**
 * Distributed Upstash Redis Rate Limiter
 * Uses Upstash REST pipeline: INCR ratelimit:<ip> & EXPIRE ratelimit:<ip> 600
 * Fails open gracefully if Redis is unavailable or unconfigured.
 */
async function checkDistributedRateLimit(ip) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.warn('[api/contact] Upstash Redis env vars missing. Failing open for IP rate limiter.');
    return { limited: false, configured: false };
  }

  try {
    const pipelineUrl = `${redisUrl.replace(/\/$/, '')}/pipeline`;
    const res = await fetchWithTimeout(pipelineUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', `ratelimit:${ip}`],
        ['EXPIRE', `ratelimit:${ip}`, RATE_LIMIT_TTL_SECONDS],
      ]),
    }, 4000);

    if (!res.ok) {
      console.warn(`[api/contact] Upstash Redis HTTP ${res.status}. Failing open.`);
      return { limited: false, configured: true, count: 1 };
    }

    const data = await res.json();
    const count = (Array.isArray(data) && data[0] && typeof data[0].result === 'number')
      ? data[0].result
      : 1;

    if (count > MAX_SUBMISSIONS_PER_IP) {
      return { limited: true, configured: true, count };
    }

    return { limited: false, configured: true, count };
  } catch (err) {
    console.warn('[api/contact] Distributed rate limiter error:', err.message);
    return { limited: false, configured: true, count: 1 };
  }
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
    return res.status(200).json({ success: true, message: 'Thank you—your message has been sent.' });
  }

  // ── Layer 2: Distributed Upstash Redis IP Rate Limiting (5 / 10 mins) ───
  const rawIp = req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].toString().split(',')[0] : '') ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const clientIp = rawIp.toString().trim();

  const rateCheck = await checkDistributedRateLimit(clientIp);
  res.setHeader('X-RateLimit-Limit', MAX_SUBMISSIONS_PER_IP.toString());
  if (rateCheck.configured && typeof rateCheck.count === 'number') {
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_SUBMISSIONS_PER_IP - rateCheck.count).toString());
  }

  if (rateCheck.limited) {
    console.warn(`[api/contact] Distributed rate limit exceeded for IP: ${clientIp}`);
    return res.status(429).json({
      error: 'Too many contact submissions from this IP address. Please wait 10 minutes before sending another message.',
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
