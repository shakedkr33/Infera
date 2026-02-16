/**
 * InYomi Design System — Brand Theme
 *
 * Single source of truth for the InYomi visual language.
 * Import from here instead of hard-coding hex values in components.
 *
 * @example
 * ```ts
 * import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
 *
 * <View style={{ backgroundColor: colors.background, padding: spacing.md, borderRadius: borderRadius.lg }}>
 *   <Text style={{ color: colors.text }}>שלום</Text>
 * </View>
 * ```
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** InYomi color palette */
export const colors = {
  // ── Primary Brand Color ─────────────────────────────────────────────
  /** Blue — primary brand color: buttons, FAB, active tab */
  primary: '#4A9FE2',
  /** Lighter blue — hover states, muted surfaces */
  primaryLight: '#7AB8F5',
  /** Darker blue — pressed states, emphasis */
  primaryDark: '#2E7FC4',

  // ── Neutrals ────────────────────────────────────────────────────────
  /** Default screen background */
  background: '#F5F5F5',
  /** Card / surface background */
  cardBg: '#FFFFFF',
  /** Primary text color */
  text: '#333333',
  /** Secondary text — subtitles, captions */
  textSecondary: '#666666',
  /** Borders & dividers */
  border: '#E0E0E0',

  // ── Accents (minimal use only) ──────────────────────────────────────
  /** Soft green — keep but don't use for CTAs */
  accentGreen: '#8B9F87',
  /** Soft pink accent */
  accentPink: '#FFE5E5',

  // ── Functional ──────────────────────────────────────────────────────
  /** Error / destructive actions */
  error: '#E53935',
  /** Success / confirmation */
  success: '#4CAF50',
  /** Warning / caution */
  warning: '#FF9800',

  // ── Legacy aliases (for backward compat, prefer primary/text/etc) ──
  /** @deprecated use `primary` instead */
  sage: '#4A9FE2',
  /** @deprecated use `textSecondary` instead */
  slateLight: '#666666',
  /** @deprecated use `text` instead */
  slate: '#333333',
  /** @deprecated use `background` instead */
  beige: '#F5F5F5',
  /** @deprecated */
  slateMuted: '#9B9B9B',
  /** @deprecated */
  white: '#FFFFFF',
  /** @deprecated */
  black: '#000000',
  /** @deprecated use `primary` instead */
  brandBlue: '#4A9FE2',
} as const;

/** TypeScript type representing any key from the color palette */
export type ColorKey = keyof typeof colors;

/** TypeScript type representing any color value from the palette */
export type ColorValue = (typeof colors)[ColorKey];

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * 8px-grid spacing scale.
 *
 * Use these instead of magic numbers to keep layout consistent.
 *
 * | Token | px  | Common use                    |
 * |-------|-----|-------------------------------|
 * | xs    |  4  | Icon gaps, tight padding      |
 * | sm    |  8  | Inline spacing, small gaps    |
 * | md    | 16  | Card padding, section gaps    |
 * | lg    | 24  | Section padding               |
 * | xl    | 32  | Screen horizontal padding     |
 * | xxl   | 48  | Large vertical spacing        |
 */
export const spacing = {
  /** 4px — icon gaps, tight padding */
  xs: 4,
  /** 8px — inline spacing, small gaps */
  sm: 8,
  /** 16px — card padding, section gaps */
  md: 16,
  /** 24px — section padding */
  lg: 24,
  /** 32px — screen horizontal padding */
  xl: 32,
  /** 48px — large vertical spacing */
  xxl: 48,
} as const;

/** TypeScript type for spacing tokens */
export type SpacingKey = keyof typeof spacing;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

/**
 * Border radius presets for consistent rounded corners.
 *
 * | Token | px    | Common use                         |
 * |-------|-------|------------------------------------|
 * | sm    |   8   | Inputs, chips, small cards         |
 * | md    |  16   | Cards, modals, medium surfaces     |
 * | lg    |  24   | Large cards, bottom sheets         |
 * | full  | 9999  | Circular avatars, pill buttons     |
 */
export const borderRadius = {
  /** 8px — inputs, chips, small cards */
  sm: 8,
  /** 16px — cards, modals */
  md: 16,
  /** 24px — large cards, bottom sheets */
  lg: 24,
  /** 9999px — fully circular / pill shape */
  full: 9999,
} as const;

/** TypeScript type for border radius tokens */
export type BorderRadiusKey = keyof typeof borderRadius;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

/** Platform-compatible shadow preset type (iOS + Android) */
export interface ShadowPreset {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** Android elevation value */
  elevation: number;
}

/**
 * Shadow presets.
 *
 * @example
 * ```ts
 * <View style={[styles.card, shadows.soft]}>
 * ```
 */
export const shadows: Record<string, ShadowPreset> = {
  /** Barely visible lift — for list items, avatars */
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  /** Default card shadow — gentle and warm */
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  /** Medium lift — for floating elements, FABs */
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  /** Prominent lift — for modals, bottom sheets */
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  /** Blue-tinted glow for primary action buttons */
  primaryCta: {
    shadowColor: '#4A9FE2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

/** TypeScript type for shadow preset names */
export type ShadowKey = keyof typeof shadows;
