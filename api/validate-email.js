/**
 * Vercel Serverless Function: /api/validate-email
 *
 * Accepts:  POST { email: string }
 * Returns:  { valid: boolean, reason?: string, fallback?: boolean }
 *
 * The Abstract API key lives ONLY in process.env.ABSTRACT_API_KEY
 * (Vercel Environment Variables). It is NEVER sent to the browser.
 */

'use strict';

// RFC 5321 / HTML-spec-compatible email format check
const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';

/** fetch() with a hard timeout so the form never hangs */
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// In-memory cache for recent email validations (persists in warm serverless instances)
const emailCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Circuit breaker for Abstract API quota/rate-limit errors
let quotaExhaustedUntil = 0;
const CIRCUIT_BREAKER_COOL_DOWN_MS = 15 * 60 * 1000; // 15 minutes

function getBool(data, key1, key2) {
  if (!data) return null;
  const val = data[key1] !== undefined ? data[key1] : (key2 ? data[key2] : undefined);
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'object' && typeof val.value === 'boolean') return val.value;
  return null;
}

module.exports = async function handler(req, res) {
  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── CORS: allow same-origin / Vercel calls ──────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  // ── Parse & validate body ─────────────────────────────────────────────────
  const body = req.body;
  const email = (typeof body === 'object' && body !== null)
    ? (body.email || '').toString().trim()
    : '';

  if (!email) {
    return res.status(400).json({ valid: false, reason: 'Email is required.' });
  }

  // ── Layer 1: local format check (fast, no network) ────────────────────────
  if (!EMAIL_FORMAT_REGEX.test(email)) {
    return res.status(200).json({
      valid: false,
      reason: 'Enter a valid email address, for example name@example.com.',
    });
  }

  // ── Layer 1.5: Server-side cache check (avoids duplicate API calls) ───────
  const cacheKey = email.toLowerCase();
  const cached = emailCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return res.status(200).json(cached.result);
  }

  // ── Layer 1.6: Circuit breaker check (if quota was exhausted recently) ────
  if (Date.now() < quotaExhaustedUntil) {
    console.warn('[validate-email] Circuit breaker active – skipping Abstract API call');
    return res.status(200).json({ valid: true, fallback: true });
  }

  // ── Layer 2: Abstract API reputation check ────────────────────────────────
  const apiKey = process.env.ABSTRACT_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    // Key not configured → pass through (don't block real users)
    console.warn('[validate-email] ABSTRACT_API_KEY not set – skipping reputation check');
    return res.status(200).json({ valid: true, fallback: true });
  }

  try {
    const url = `${ABSTRACT_API_URL}?api_key=${apiKey.trim()}&email=${encodeURIComponent(email)}`;
    const abstractRes = await fetchWithTimeout(url, 7000);

    // Handle 429 Quota Exceeded or 401/403 Auth errors with circuit breaker
    if (abstractRes.status === 429 || abstractRes.status === 401 || abstractRes.status === 403) {
      console.warn(`[validate-email] Abstract API status ${abstractRes.status}. Activating circuit breaker.`);
      quotaExhaustedUntil = Date.now() + CIRCUIT_BREAKER_COOL_DOWN_MS;
      return res.status(200).json({ valid: true, fallback: true });
    }

    // Any other non-2xx from Abstract API → fall back gracefully without locking out users
    if (!abstractRes.ok) {
      console.warn('[validate-email] Abstract API responded with HTTP', abstractRes.status);
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
      // DELIVERABLE or UNKNOWN → allow
      result = { valid: true };
    }

    // Cache the result for subsequent requests
    emailCache.set(cacheKey, { result, timestamp: Date.now() });

    return res.status(200).json(result);

  } catch (err) {
    // Timeout, network error, JSON parse error → fail open
    console.warn('[validate-email] Falling back due to error:', err.name || err.message);
    return res.status(200).json({ valid: true, fallback: true });
  }
};
