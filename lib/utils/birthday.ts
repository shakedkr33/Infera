import type { Birthday } from '@/lib/types/birthday';

const MONTHS_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export function formatBirthdayDate(
  b: Pick<Birthday, 'day' | 'month' | 'year'>
): string {
  const monthName = MONTHS_HE[b.month - 1];
  if (b.year) {
    return `${b.day} ב${monthName} ${b.year}`;
  }
  return `${b.day} ב${monthName}`;
}

export function getNextOccurrence(b: Pick<Birthday, 'day' | 'month'>): Date {
  const now = new Date();
  const year = now.getFullYear();
  let next = new Date(year, b.month - 1, b.day);
  if (next < now) {
    next = new Date(year + 1, b.month - 1, b.day);
  }
  return next;
}

export function getCountdownLabel(b: Pick<Birthday, 'day' | 'month'>): string {
  const next = getNextOccurrence(b);
  const now = new Date();
  const diff = Math.ceil(
    (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  return `בעוד ${diff} ימים`;
}

export function getAge(
  b: Pick<Birthday, 'day' | 'month' | 'year'>
): number | null {
  if (!b.year) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  const birthdayThisYear = new Date(thisYear, b.month - 1, b.day);
  let age = thisYear - b.year;
  if (now < birthdayThisYear) age--;
  return age;
}
