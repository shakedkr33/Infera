/**
 * Utilities for geo: URI scheme (RFC 5870).
 * Format: geo:<lat>,<lng>
 *
 * Used to store event coordinates in the existing `locationUrl` field
 * without requiring schema changes. Only events where the user selected a
 * place from autocomplete get coordinate-based navigation.
 */

export function buildGeoUri(lat: number, lng: number): string {
  return `geo:${lat},${lng}`;
}

export function parseGeoUri(
  uri: string | undefined | null
): { lat: number; lng: number } | null {
  if (!uri || !uri.startsWith('geo:')) return null;
  const parts = uri.slice(4).split(',');
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function hasValidCoords(
  lat: number | undefined,
  lng: number | undefined
): lat is number {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng)
  );
}
