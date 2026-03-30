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

  return (
    normalized === 'mobile' ||
    normalized === 'cell' ||
    normalized === 'iphone' ||
    normalized === 'נייד' ||
    normalized.includes('mobile') ||
    normalized.includes('cell') ||
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

/** Human-readable Hebrew label for a phone number entry's label field */
export function getPhoneLabel(label: string | undefined): string {
  if (isMobileCapable(label)) return 'נייד';
  const l = (label ?? '').toLowerCase();
  if (l.includes('home') || l.includes('בית')) return 'בית';
  if (l.includes('work') || l.includes('עבודה')) return 'עבודה';
  return label?.trim() || 'טלפון';
}
