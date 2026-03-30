/**
 * Normalizes an Israeli phone number to E.164 format (+972XXXXXXXXX).
 * Returns null if the input cannot be normalized to a valid Israeli number.
 *
 * Accepted input formats:
 *   050-123-4567, 050 123 4567, 0501234567
 *   526417758 (no leading 0 — bare subscriber number starting with 5)
 *   +972501234567, 972501234567
 */
// FIXED: normalize phone number to handle leading 0 with Israeli prefix
// Also accepts bare subscriber numbers (e.g. 526417758) without leading 0
export function normalizeIsraeliPhone(raw: string): string | null {
  // Strip all spaces, dashes, and parentheses
  const stripped = raw.replace(/[\s\-()]/g, '');

  if (stripped.startsWith('+972')) {
    return stripped;
  }

  if (stripped.startsWith('972')) {
    return `+${stripped}`;
  }

  if (stripped.startsWith('0')) {
    // e.g. 0526417758 → +972526417758
    return `+972${stripped.slice(1)}`;
  }

  if (stripped.startsWith('5')) {
    // e.g. 526417758 → +972526417758 (user omitted leading 0)
    return `+972${stripped}`;
  }

  return null;
}

/**
 * Returns true if the given string is a valid Israeli mobile number in E.164 format.
 * Israeli mobile numbers: +9725X_XXXXXXX (10 digits after +972, starting with 5)
 * Examples: +972501234567, +972521234567, +972541234567
 */
export function isValidIsraeliMobile(e164: string): boolean {
  return /^\+9725\d{8}$/.test(e164);
}

/**
 * Combines normalization + validation.
 * Returns the normalized E.164 string, or null if invalid.
 */
export function parseIsraeliPhone(raw: string): string | null {
  const normalized = normalizeIsraeliPhone(raw);
  if (!normalized) return null;
  if (!isValidIsraeliMobile(normalized)) return null;
  return normalized;
}
