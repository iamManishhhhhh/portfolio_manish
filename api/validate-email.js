/**
 * Vercel Serverless Function: /api/validate-email
 *
 * Accepts:  POST { email: string }
 * Returns:  { valid: boolean, reason?: string }
 *
 * The Abstract API key lives ONLY in process.env.ABSTRACT_API_KEY.
 * It is never sent to the browser under any circumstances.
 */

// Minimal RFC 5321-compatible format check (same as frontend regex)
const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const ABSTRACT_BASE_URL =
  'https://emailvalidation.abstractapi.com/v1/';

// Fetch with a 6-second timeout so the form never hangs
function fetchWithTimeout(url, timeoutMs = 6000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Abstract API timeout')), timeoutMs)
    ),
  ]);
}

export default async function handler(req, res) {
  // --- Method guard ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- Parse body ---
  const { email } = req.body ?? {};

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ valid: false, reason: 'Email is required.' });
  }

  const trimmedEmail = email.trim();

  // --- Layer 1: fast local format check (no network) ---
  if (!EMAIL_FORMAT_REGEX.test(trimmedEmail)) {
    return res.status(200).json({
      valid: false,
      reason: 'Enter a valid email address, for example name@example.com.',
    });
  }

  // --- Layer 2: Abstract API reputation check ---
  const apiKey = process.env.ABSTRACT_API_KEY;

  if (!apiKey) {
    // API key not configured — gracefully fall back to format-only validation
    console.warn('[validate-email] ABSTRACT_API_KEY is not set. Skipping reputation check.');
    return res.status(200).json({ valid: true, fallback: true });
  }

  try {
    const url =
      `${ABSTRACT_BASE_URL}?api_key=${apiKey}&email=${encodeURIComponent(trimmedEmail)}`;

    const abstractRes = await fetchWithTimeout(url);

    if (!abstractRes.ok) {
      // Abstract API returned an HTTP error — fall back gracefully
      console.warn(`[validate-email] Abstract API HTTP error: ${abstractRes.status}`);
      return res.status(200).json({ valid: true, fallback: true });
    }

    const data = await abstractRes.json();

    // Abstract API fields we care about:
    //   is_valid_format.value  – passes our regex (should always be true here)
    //   deliverability         – "DELIVERABLE" | "UNDELIVERABLE" | "UNKNOWN"
    //   is_disposable_email.value – true for throw-away domains
    const deliverability = data.deliverability ?? 'UNKNOWN';
    const isDisposable = data.is_disposable_email?.value === true;
    const isValidFormat = data.is_valid_format?.value !== false;

    if (!isValidFormat || deliverability === 'UNDELIVERABLE' || isDisposable) {
      const reason = isDisposable
        ? 'Disposable email addresses are not accepted.'
        : 'This email address does not appear to be deliverable. Please use a real address.';
      return res.status(200).json({ valid: false, reason });
    }

    // DELIVERABLE or UNKNOWN (be permissive for UNKNOWN)
    return res.status(200).json({ valid: true });
  } catch (err) {
    // Network error, timeout, or parse error — fall back gracefully
    console.warn('[validate-email] Abstract API unavailable, falling back:', err.message);
    return res.status(200).json({ valid: true, fallback: true });
  }
}
