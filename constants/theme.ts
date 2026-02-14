/**
 * InYomi Design System — Boho Aesthetic Theme
 *
 * Single source of truth for the InYomi visual language.
 * Import from here instead of hard-coding hex values in components.
 *
 * @example
 * ```ts
 * import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
 *
 * <View style={{ backgroundColor: colors.beige, padding: spacing.md, borderRadius: borderRadius.lg }}>
 *   <Text style={{ color: colors.slate }}>שלום</Text>
 * </View>
 * ```
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** InYomi Boho color palette */
export const colors = {
  // ── Primary ───────────────────────────────────────────────────────────
  /** Sage Green — primary brand color: calm, organizing, trustworthy */
  sage: '#8B9F87',
  /** Dusty Rose — accent color: warmth, family, affection */
  rose: '#D4A5A5',
  /** Beige — neutral background: soft, inviting canvas */
  beige: '#F5F0E8',
  /** Soft Slate — primary text color: readable without harsh black */
  slate: '#4A4A4A',

  // ── Sage Variations ───────────────────────────────────────────────────
  /** Lighter sage for backgrounds, hover states, and muted surfaces */
  sageLight: '#A8BFA2',
  /** Darker sage for pressed states and emphasis */
  sageDark: '#6D7F68',
  /** Very light sage tint for subtle backgrounds */
  sageMuted: 'rgba(139, 159, 135, 0.12)',

  // ── Rose Variations ───────────────────────────────────────────────────
  /** Lighter rose for backgrounds, tags, and soft highlights */
  roseLight: '#E6C5C5',
  /** Muted rose tint for subtle backgrounds and badges */
  roseMuted: 'rgba(212, 165, 165, 0.15)',

  // ── Beige Variations ──────────────────────────────────────────────────
  /** Brighter off-white — for cards on beige backgrounds */
  cream: '#FDFBF7',
  /** Slightly deeper warm beige — for section dividers */
  beigeDeep: '#EDE5D8',

  // ── Slate Variations ──────────────────────────────────────────────────
  /** Secondary text — subtitles, captions */
  slateLight: '#6B6B6B',
  /** Tertiary text — placeholders, disabled labels */
  slateMuted: '#9B9B9B',

  // ── UI / Semantic ─────────────────────────────────────────────────────
  /** Pure white for cards, modals, and inputs */
  white: '#FFFFFF',
  /** Pure black — use sparingly, prefer slate for text */
  black: '#000000',
  /** Error / destructive actions */
  error: '#D32F2F',
  /** Success / confirmation */
  success: '#388E3C',
  /** Warning / caution */
  warning: '#F57C00',
  /** InYomi brand blue — used in legacy screens and highlights */
  brandBlue: '#36a9e2',
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
 * Soft shadow presets matching the Boho aesthetic.
 *
 * All shadows use low opacity and generous radius for a gentle,
 * organic feel — never harsh drop-shadows.
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
  /** Sage-tinted glow for primary action buttons */
  sageCta: {
    shadowColor: '#8B9F87',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  /** Rose-tinted glow for secondary action buttons */
  roseCta: {
    shadowColor: '#D4A5A5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

/** TypeScript type for shadow preset names */
export type ShadowKey = keyof typeof shadows;
