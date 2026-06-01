type InitialsSource = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  name?: string | null;
};

// Accepts either a plain display-name string (new callers) or the legacy
// InitialsSource object shape (MainScreenHeader, profile, family-profile).
export function getAvatarInitials(input: string | InitialsSource): string {
  if (typeof input === 'string') {
    const name = input.trim();
    if (!name) return '';
    const firstWord = name.split(/\s+/)[0] ?? '';
    const chars = Array.from(firstWord); // Unicode-safe Hebrew slicing
    return (chars[0] ?? '') + (chars[1] ?? '');
  }

  // Legacy: object with firstName / lastName / fullName / name
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (firstName && lastName) {
    return (Array.from(firstName)[0] ?? '') + (Array.from(lastName)[0] ?? '');
  }
  const displayName = input.fullName?.trim() || input.name?.trim() || '';
  return getAvatarInitials(displayName);
}
