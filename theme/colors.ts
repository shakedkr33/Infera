export const colors = {
  // ── Action (blue) ──────────────────────────────────────
  primary:       '#00668E',  // Buttons, active tabs, links, interactive elements
  primaryLight:  '#E8F4F8',  // Selected card bg, subtle pressed state

  // ── Identity (brown) ──────────────────────────────────
  accent:        '#987467',  // Logo refs, decorative icons, birthdays, AI, communities
  accentLight:   '#F3E5DA',  // Warm card bg (birthdays, special messages, AI)

  // ── Warmth (beige) ────────────────────────────────────
  warmGray:      '#F8F4F1',  // Empty states, bottom sheets, AI bg, onboarding, community cards

  // ── Neutrals ──────────────────────────────────────────
  background:    '#F6F7F8',  // Screen background
  surface:       '#FFFFFF',  // Card background
  border:        '#E7E3DF',  // Card borders, dividers (warm, not cold)

  // ── Text ──────────────────────────────────────────────
  textPrimary:   '#2D3335',  // Headlines, names, primary content
  textSecondary: '#6B7280',  // Descriptions, dates, metadata
  textOnPrimary: '#FFFFFF',  // Text on primary-colored surfaces

  // ── Semantic ──────────────────────────────────────────
  success:       '#2E9B5F',  // RSVP confirmed, task completed
  warning:       '#D99026',  // Overdue, needs attention
  error:         '#DC2626',  // Errors, cancellations, destructive

  // ── Legacy (DO NOT USE in new code — migrate out gradually) ──
  /** @deprecated use `primary` instead */
  legacyBlue:    '#36a9e2',
  /** @deprecated use `primary` instead */
  legacyBlueMid: '#55C0FB',
} as const;

export type ColorToken = keyof typeof colors;
