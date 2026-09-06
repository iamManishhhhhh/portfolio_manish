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

    // Any non-2xx from Abstract API → fall back gracefully
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

    if (isFormatValid === false) {
      return res.status(200).json({
        valid: false,
        reason: 'Enter a valid email address, for example name@example.com.',
      });
    }

    if (isDisposable === true) {
      return res.status(200).json({
        valid: false,
        reason: 'Disposable or temporary email addresses are not accepted.',
      });
    }

    if (isMxFound === false) {
      return res.status(200).json({
        valid: false,
        reason: 'This domain cannot receive emails. Please check your email for typos.',
      });
    }

    if (deliverability === 'UNDELIVERABLE' || isSmtpValid === false) {
      return res.status(200).json({
        valid: false,
        reason: 'This email address does not appear to exist. Please use a real address.',
      });
    }

    // DELIVERABLE or UNKNOWN → allow
    return res.status(200).json({ valid: true });

  } catch (err) {
    // Timeout, network error, JSON parse error → fail open
    console.warn('[validate-email] Falling back due to error:', err.name || err.message);
    return res.status(200).json({ valid: true, fallback: true });
  }
};
