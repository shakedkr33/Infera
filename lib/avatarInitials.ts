type InitialsSource = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  name?: string | null;
};

export function getAvatarInitials(source: InitialsSource): string {
  const firstName = source.firstName?.trim();
  const lastName = source.lastName?.trim();

  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`;
  }

  const displayName = source.fullName?.trim() || source.name?.trim() || '';
  const parts = displayName.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`;
  }

  return parts[0]?.[0] ?? '';
}
