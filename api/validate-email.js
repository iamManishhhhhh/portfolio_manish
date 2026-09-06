/**
 * Vercel Serverless Function: /api/validate-email
 *
 * Accepts:  POST { email: string }
 * Returns:  { valid: boolean, reason?: string, fallback?: boolean }
 *
 * The Abstract API key lives ONLY in process.env.ABSTRACT_API_KEY
 */

'use strict';

const dns = require('dns').promises;

const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';

// Known disposable & temporary email domain blocklist (case-insensitive)
const DISPOSABLE_DOMAINS = new Set([
  'huyihuyi.in', 'hahaha.in', 'mailinator.com', 'tempmail.com', '10minutemail.com',
  'dispostable.com', 'guerrillamail.com', 'trashmail.com', 'yopmail.com',
  'sharklasers.com', 'getnada.com', 'temp-mail.org', 'throwawaymail.com',
  'fakeinbox.com', 'maildrop.cc', 'disposablemail.com', 'inboxkitten.com',
  'generator.email', 'crazymailing.com', 'tempmail.net', 'tempmailo.com',
  'burnermail.io', 'mohmal.com', 'dropmail.me', 'mailnesia.com', 'disposable.com',
  'nada.ltd', 'mailnull.com', 'spamgourmet.com', 'trashmail.net', 'mytemp.email',
  'emailondeck.com', 'tempinbox.com', 'throwawayemail.com'
]);

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// In-memory cache for recent email validations
const emailCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Circuit breaker for Abstract API quota/rate-limit errors
let quotaExhaustedUntil = 0;
const CIRCUIT_BREAKER_COOL_DOWN_MS = 15 * 60 * 1000; // 15 minutes

// Sliding window IP rate limiting (5 validation requests per IP per minute)
const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_IP = 5;

function isIpRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const timestamps = (ipRateLimitMap.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_IP) {
    ipRateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  ipRateLimitMap.set(ip, timestamps);
  return false;
}

function getBool(data, key1, key2) {
  if (!data) return null;
  const val = data[key1] !== undefined ? data[key1] : (key2 ? data[key2] : undefined);
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'object' && typeof val.value === 'boolean') return val.value;
  return null;
}

async function verifyDomainMailCapability(domain) {
  if (!domain) return false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      return true;
    }
  } catch (_err) {}

  try {
    const aRecords = await dns.resolve4(domain);
    if (Array.isArray(aRecords) && aRecords.length > 0) {
      return true;
    }
  } catch (_err) {}

  try {
    const aaaaRecords = await dns.resolve6(domain);
    if (Array.isArray(aaaaRecords) && aaaaRecords.length > 0) {
      return true;
    }
  } catch (_err) {}

  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  const body = req.body;

  if (body && typeof body === 'object' && body.website_hp && body.website_hp.toString().trim() !== '') {
    return res.status(200).json({ valid: false, reason: 'Spam submission detected.' });
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1')
    .toString().split(',')[0].trim();

  if (isIpRateLimited(clientIp)) {
    return res.status(200).json({
      valid: false,
      reason: 'Too many validation requests. Please wait a minute before submitting again.',
    });
  }

  const rawEmail = (typeof body === 'object' && body !== null)
    ? (body.email || '').toString().trim()
    : '';

  if (!rawEmail) {
    return res.status(400).json({ valid: false, reason: 'Email is required.' });
  }

  const normalizedEmail = rawEmail.toLowerCase();
  const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop() : '';

  if (!EMAIL_FORMAT_REGEX.test(normalizedEmail) || !domain) {
    return res.status(200).json({
      valid: false,
      reason: 'Enter a valid email address, for example name@example.com.',
    });
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return res.status(200).json({
      valid: false,
      reason: 'Disposable or temporary email addresses are not accepted.',
    });
  }

  const cacheKey = normalizedEmail;
  const cached = emailCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return res.status(200).json(cached.result);
  }

  const hasMailCapability = await verifyDomainMailCapability(domain);
  if (!hasMailCapability) {
    const invalidResult = {
      valid: false,
      reason: 'This domain does not appear to have valid mail servers. Please check your email address for typos.',
    };
    emailCache.set(cacheKey, { result: invalidResult, timestamp: Date.now() });
    return res.status(200).json(invalidResult);
  }

  if (Date.now() < quotaExhaustedUntil) {
    return res.status(200).json({ valid: true, fallback: true });
  }

  const apiKey = process.env.ABSTRACT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(200).json({ valid: true, fallback: true });
  }

  try {
    const url = `${ABSTRACT_API_URL}?api_key=${apiKey.trim()}&email=${encodeURIComponent(normalizedEmail)}`;
    const abstractRes = await fetchWithTimeout(url, 7000);

    if (abstractRes.status === 429 || abstractRes.status === 401 || abstractRes.status === 403) {
      quotaExhaustedUntil = Date.now() + CIRCUIT_BREAKER_COOL_DOWN_MS;
      return res.status(200).json({ valid: true, fallback: true });
    }

    if (!abstractRes.ok) {
      return res.status(200).json({ valid: true, fallback: true });
    }

    const data = await abstractRes.json();

    const isFormatValid = getBool(data, 'is_valid_format', 'is_format_valid');
    const isDisposable = getBool(data, 'is_disposable_email', 'is_disposable');
    const isMxFound = getBool(data, 'is_mx_found', 'is_mx_valid');
    const isSmtpValid = getBool(data, 'is_smtp_valid');
    const deliverability = (typeof data.deliverability === 'string')
      ? data.deliverability.toUpperCase()
      : (data.status ? data.status.toString().toUpperCase() : 'UNKNOWN');

    let result;

    if (isFormatValid === false) {
      result = {
        valid: false,
        reason: 'Enter a valid email address, for example name@example.com.',
      };
    } else if (isDisposable === true) {
      result = {
        valid: false,
        reason: 'Disposable or temporary email addresses are not accepted.',
      };
    } else if (isMxFound === false) {
      result = {
        valid: false,
        reason: 'This domain cannot receive emails. Please check your email for typos.',
      };
    } else if (deliverability === 'UNDELIVERABLE' || isSmtpValid === false) {
      result = {
        valid: false,
        reason: 'This email address does not appear to exist. Please use a real address.',
      };
    } else {
      result = { valid: true };
    }

    emailCache.set(cacheKey, { result, timestamp: Date.now() });
    return res.status(200).json(result);

  } catch (err) {
    return res.status(200).json({ valid: true, fallback: true });
  }
};
