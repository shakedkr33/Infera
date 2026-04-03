// SHARED: phone selection logic for contact import — used by both
// family-profile (AddPersonBottomSheet) and event-participant (ParticipantsCard) flows

import type * as Contacts from 'expo-contacts';

// FIXED: updated phone label filter to mobile-capable labels only
/**
 * Returns true only for labels that indicate mobile capability.
 * Non-mobile labels (home, work alone, fax, main, other, pager) return false.
 * Handles compound labels like "work mobile", "work-mobile", "work_mobile".
 */
export function isMobileCapable(label?: string | null): boolean {
  const normalized = (label ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ');

  // FIXED: phone-selection sheet now correctly opens when contact has 2+ mobile numbers
  // 'iphone' now has an includes() check alongside its exact-match check,
  // matching the symmetric pattern used for 'mobile', 'cell', and 'נייד'.
  // Previously "my iPhone", "iPhone 2", "personal iphone" etc. were silently
  // excluded, making getMobilePhones() return length 1 and auto-adding the contact.
  return (
    normalized === 'mobile' ||
    normalized === 'cell' ||
    normalized === 'iphone' ||
    normalized === 'נייד' ||
    normalized.includes('mobile') ||
    normalized.includes('cell') ||
    normalized.includes('iphone') || // was missing — caused silent exclusion of "my iPhone" etc.
    normalized.includes('נייד')
  );
}

// FIXED: updated phone label filter to mobile-capable labels only
/** Returns only the phone entries whose label is mobile-capable. */
export function getMobilePhones(
  contact: Contacts.Contact
): NonNullable<Contacts.Contact['phoneNumbers']> {
  return (contact.phoneNumbers ?? []).filter((p) => isMobileCapable(p.label));
}

/** Strip all non-digit characters — for deduplication and stable storage */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// FIXED: updated phone label filter to mobile-capable labels only
/**
 * Returns the first mobile-capable phone number for a contact.
 * Returns empty string if no mobile-capable number exists — does NOT fall back
 * to non-mobile numbers. Phone number is the stable identifier for user matching.
 */
export function getPrimaryPhone(contact: Contacts.Contact): string {
  const mobilePhones = getMobilePhones(contact);
  return mobilePhones[0]?.number ?? '';
}

// FIXED: family flow and event flow now preselect default phone when picker opens
/**
 * Returns the best default number string to preselect in the phone-picker.
 * Prefers a number marked isPrimary by the contacts API; falls back to
 * the first mobile-capable entry in the list.
 * Returns '' when the list is empty.
 */
export function getDefaultPhoneNumber(
  mobilePhones: NonNullable<Contacts.Contact['phoneNumbers']>
): string {
  if (mobilePhones.length === 0) return '';
  const primary = mobilePhones.find((p) => p.isPrimary);
  return (primary ?? mobilePhones[0])?.number ?? '';
}

// FIXED: implemented maskPhone for family-member card secondary identifying line
/**
 * Masks a phone number for display, showing only first 3 and last 3 digits.
 * Example: "0541234567" → "054-XXXX567"
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-3);
  const midLen = Math.max(0, digits.length - 6);
  return `${prefix}-${'X'.repeat(midLen)}${suffix}`;
}

/** Human-readable Hebrew label for a phone number entry's label field */
export function getPhoneLabel(label: string | undefined): string {
  if (isMobileCapable(label)) return 'נייד';
  const l = (label ?? '').toLowerCase();
  if (l.includes('home') || l.includes('בית')) return 'בית';
  if (l.includes('work') || l.includes('עבודה')) return 'עבודה';
  return label?.trim() || 'טלפון';
}
