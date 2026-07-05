/**
 * Environment-Aware RTL Utilities for Mobile Template
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This module provides THE DEFINITIVE SOLUTION for consistent RTL layout across:
 * - Expo Go (native RTL doesn't work, needs explicit overrides)
 * - Dev/Prod builds (native RTL works via I18nManager)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * MEASURED GROUND TRUTH (measured on real devices, 2026-07)
 * iOS native and Android native behave IDENTICALLY — platform splits removed.
 * Text and TextInput behave DIFFERENTLY — do not unify.
 * alignItems/alignSelf in COLUMN containers are logical (auto-flipped) on native.
 * direction:'rtl' wrapper has NO effect on column cross-axis alignment.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ── <Text> components (use rtl.textAlign / getTextAlign) ──────────────────
 *
 *   Native RTL (I18nManager.isRTL=true) — iOS and Android identical:
 *     <Text> textAlign IS auto-flipped by Yoga. 'left' renders physical RIGHT.
 *     Return 'left' so Yoga logical flip lands on the right side.
 *
 *   Expo Go / iOS storeClient (I18nManager.isRTL=false):
 *     No Yoga RTL mode; no direction wrapper. textAlign is physical.
 *     Return 'right'.
 *
 * ┌─────────────────────────────┬────────────────────┬──────────────────┐
 * │ Environment                 │ getTextAlign()     │ Physical result  │
 * ├─────────────────────────────┼────────────────────┼──────────────────┤
 * │ Expo Go (isRTL=false)       │ "right"            │ RIGHT ✅         │
 * │ iOS native RTL (isRTL=true) │ "left"             │ RIGHT ✅         │
 * │ Android native (isRTL=true) │ "left"             │ RIGHT ✅         │
 * └─────────────────────────────┴────────────────────┴──────────────────┘
 *
 * ── <TextInput> components (use rtl.inputTextAlign / getInputTextAlign) ───
 *
 *   All environments:
 *     <TextInput> textAlign is NEVER auto-flipped. 'right' = physical RIGHT.
 *     direction:'rtl' wrapper has NO effect on TextInput textAlign.
 *
 * ┌─────────────────────────────┬───────────────────────┬──────────────────┐
 * │ Environment                 │ getInputTextAlign()   │ Physical result  │
 * ├─────────────────────────────┼───────────────────────┼──────────────────┤
 * │ All environments            │ "right"               │ RIGHT ✅         │
 * └─────────────────────────────┴───────────────────────┴──────────────────┘
 *
 * ── flexDirection (row axis) ───────────────────────────────────────────────
 *
 * ┌─────────────┬───────────────────┬───────────────┬──────────────────┐
 * │ Environment │ rtl.flexDirection │ Native Flips? │ Final Result     │
 * ├─────────────┼───────────────────┼───────────────┼──────────────────┤
 * │ Expo Go     │ "row-reverse"     │ No            │ row-reverse ✅   │
 * │ Dev Build   │ "row"             │ Yes           │ row-reverse ✅   │
 * │ Prod Build  │ "row"             │ Yes           │ row-reverse ✅   │
 * └─────────────┴───────────────────┴───────────────┴──────────────────┘
 *
 * ── alignItems / alignSelf (column cross-axis) — measured 2026-07, Section D ──
 *
 *   Native RTL (isRTL=true): column cross-axis IS logical (auto-flipped).
 *     'flex-start' → physical RIGHT   'flex-end' → physical LEFT
 *   Expo Go (isRTL=false): column cross-axis is physical.
 *     'flex-start' → physical LEFT    'flex-end' → physical RIGHT
 *
 *   direction:'rtl' wrapper has NO effect on column cross-axis alignment.
 *
 *   Use rtl.alignStart for physical RIGHT (logical start in RTL app).
 *   Use rtl.alignEnd   for physical LEFT  (logical end   in RTL app).
 *
 * ┌─────────────┬────────────────┬─────────────────┬──────────────────┐
 * │ Environment │ rtl.alignStart │ Physical result │ Note             │
 * ├─────────────┼────────────────┼─────────────────┼──────────────────┤
 * │ Expo Go     │ "flex-end"     │ RIGHT ✅        │ physical         │
 * │ Native RTL  │ "flex-start"   │ RIGHT ✅        │ logical (flipped)│
 * └─────────────┴────────────────┴─────────────────┴──────────────────┘
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * import { rtl } from "@/lib/rtl";
 *
 * // Text alignment for <Text> (environment-aware, Text auto-flip logic)
 * <Text style={{ textAlign: rtl.textAlign }}>כותרת בעברית</Text>
 *
 * // Text alignment for <TextInput> (never auto-flipped — always physical 'right')
 * <TextInput style={{ textAlign: rtl.inputTextAlign }} />
 * // or as a JSX prop:
 * <TextInput textAlign={rtl.inputTextAlign} />
 *
 * // Flex direction (environment-aware)
 * <View style={{ flexDirection: rtl.flexDirection }}>
 *   <Icon />
 *   <Text>Item</Text>
 * </View>
 *
 * // Column cross-axis alignment — physical RIGHT (e.g. RTL text block)
 * <View style={{ alignItems: rtl.alignStart }}>
 *   <Text>עברית</Text>
 * </View>
 *
 * // Column cross-axis alignment — physical LEFT (e.g. "see more" at left)
 * <Pressable style={{ alignSelf: rtl.alignEnd }}>...</Pressable>
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import Constants from 'expo-constants';
import { I18nManager } from 'react-native';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Master RTL flag for the app.
 * Set to `true` for Hebrew/Arabic apps, `false` for English/LTR apps.
 */
export const APP_IS_RTL = true;

/**
 * Kept for backward compatibility with existing code
 */
export const IS_RTL = APP_IS_RTL;

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detects if app is running in Expo Go.
 *
 * - 'storeClient' = Expo Go
 * - 'standalone' or 'bare' = Development/Production builds
 */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

/**
 * Returns true if native RTL is enabled.
 *
 * - Expo Go: Usually `false` (can be `true` after first bootstrap)
 * - Dev/Prod Build: `true` when device language is RTL or app forces RTL
 */
export const isNativeRTLEnabled = (): boolean => I18nManager.isRTL;

// ═══════════════════════════════════════════════════════════════
// RTL STYLE UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * When true, we need to EXPLICITLY apply RTL styles.
 *
 * This happens in Expo Go where I18nManager.isRTL is typically `false`.
 * In this case, we return explicit RTL values like "right" and "row-reverse".
 */
export const needsExplicitRTL = (): boolean => APP_IS_RTL && !I18nManager.isRTL;

/**
 * Get text alignment for <Text> components.
 *
 * MEASURED 2026-07 on real devices — Text and TextInput behave differently,
 * do NOT use this for TextInput (use getInputTextAlign instead).
 *
 *   Android native (I18nManager.isRTL=true):
 *     <Text> textAlign IS auto-flipped by Yoga. 'left' renders physical RIGHT.
 *     Return 'left'. ✅
 *
 *   iOS native (I18nManager.isRTL=true):
 *     Same behaviour. 'left' is logical-start → physical RIGHT. Return 'left'. ✅
 *
 *   Expo Go (I18nManager.isRTL=false):
 *     No Yoga RTL mode. textAlign is physical. Return 'right'. ✅
 *
 * @returns "right" | "left" | undefined
 */
export const getTextAlign = (): 'right' | 'left' | undefined => {
  if (!APP_IS_RTL) return undefined;
  if (I18nManager.isRTL) return 'left'; // native: Text auto-flips left→right
  return 'right'; // Expo Go: physical right
};

/**
 * Get text alignment for <TextInput> components.
 *
 * MEASURED 2026-07 on real devices — TextInput NEVER auto-flips textAlign,
 * regardless of I18nManager.isRTL or any direction:'rtl' wrapper.
 * Physical 'right' is correct everywhere.
 *
 * @returns "right" | undefined
 */
export const getInputTextAlign = (): 'right' | undefined => {
  if (!APP_IS_RTL) return undefined;
  return 'right'; // TextInput never auto-flips — physical 'right' everywhere
};

/**
 * Get flex direction for horizontal layouts that should be RTL.
 *
 * THE KEY INSIGHT:
 * In native RTL mode, flexDirection="row" gets FLIPPED to "row-reverse" automatically!
 *
 * So we need INVERSE logic:
 * - Expo Go (no native RTL): return "row-reverse" → stays "row-reverse" ✅
 * - Dev Build (native RTL): return "row" → gets flipped to "row-reverse" ✅
 *
 * @returns "row" | "row-reverse"
 */
export const getFlexDirection = (): 'row' | 'row-reverse' => {
  if (needsExplicitRTL()) {
    // Expo Go: no native RTL, explicitly reverse
    return 'row-reverse';
  }
  // Dev/Prod Build with native RTL: "row" gets flipped to "row-reverse" automatically
  return 'row';
};

// ═══════════════════════════════════════════════════════════════
// STATIC RTL OBJECT (for easy import)
// ═══════════════════════════════════════════════════════════════

/**
 * Static RTL style object for use with NativeWind/RN components.
 *
 * Properties are getters, so they're re-evaluated on each access
 * to handle any runtime changes to I18nManager.isRTL.
 *
 * @example
 * import { rtl } from "@/lib/rtl";
 *
 * <Text style={{ textAlign: rtl.textAlign }}>כותרת</Text>
 * <View style={{ flexDirection: rtl.flexDirection }}>{children}</View>
 */
export const rtl = {
  /**
   * Text alignment for <Text> components.
   * 'left' in native RTL builds (Yoga auto-flips to physical right).
   * 'right' in Expo Go (physical right, no Yoga RTL mode).
   * Use rtl.inputTextAlign for <TextInput> instead.
   */
  get textAlign(): 'right' | 'left' | undefined {
    return getTextAlign();
  },

  /**
   * Text alignment for <TextInput> components.
   * Always 'right' (physical) — TextInput never auto-flips on any platform.
   */
  get inputTextAlign(): 'right' | undefined {
    return getInputTextAlign();
  },

  /**
   * Environment-aware flex direction.
   * - Expo Go: "row-reverse"
   * - Native RTL: "row" (gets flipped to "row-reverse")
   */
  get flexDirection(): 'row' | 'row-reverse' {
    return getFlexDirection();
  },

  /**
   * Column cross-axis alignment for physical RIGHT (logical start in RTL).
   *
   * Measured 2026-07 on device (Section D):
   *   Native RTL (isRTL=true): 'flex-start' → physical RIGHT (Yoga logical flip)
   *   Expo Go (isRTL=false):   'flex-end'   → physical RIGHT (no flip)
   *
   * Use for: alignItems / alignSelf on COLUMN containers where you want
   * content to sit at the physical right edge (Hebrew text blocks, RTL cards).
   */
  get alignStart(): 'flex-start' | 'flex-end' {
    return needsExplicitRTL() ? 'flex-end' : 'flex-start';
  },

  /**
   * Column cross-axis alignment for physical LEFT (logical end in RTL).
   *
   * Measured 2026-07 on device (Section D):
   *   Native RTL (isRTL=true): 'flex-end'   → physical LEFT (Yoga logical flip)
   *   Expo Go (isRTL=false):   'flex-start' → physical LEFT (no flip)
   *
   * Use for: alignItems / alignSelf on COLUMN containers where you want
   * content to sit at the physical left edge (e.g. "see more" nav button).
   */
  get alignEnd(): 'flex-start' | 'flex-end' {
    return needsExplicitRTL() ? 'flex-start' : 'flex-end';
  },
};

// ═══════════════════════════════════════════════════════════════
// NATIVEWIND HELPER OBJECT
// ═══════════════════════════════════════════════════════════════

/**
 * Tailwind class helpers for RTL-aware styling.
 * These provide the correct Tailwind classes based on environment.
 */
export const tw = {
  /**
   * Flex row that respects RTL direction
   * - Expo Go: "flex-row-reverse"
   * - Native RTL: "flex-row" (gets flipped to row-reverse)
   */
  get flexRow(): string {
    return getFlexDirection() === 'row-reverse'
      ? 'flex-row-reverse'
      : 'flex-row';
  },

  /**
   * Tailwind text-alignment class for <Text> logical "start" (right side in RTL).
   * Mirrors getTextAlign() — native RTL (both iOS and Android) uses 'text-left'
   * because Yoga auto-flips Text to physical right; Expo Go uses 'text-right'.
   * For <TextInput> use an explicit style={{ textAlign: rtl.inputTextAlign }}
   * instead of this class, because TextInput does not auto-flip.
   */
  get textStart(): string {
    if (!APP_IS_RTL) return '';
    return I18nManager.isRTL ? 'text-left' : 'text-right';
  },

  /**
   * Tailwind text-alignment class for logical "end" (left side in RTL).
   * Opposite of textStart.
   *
   * iOS and Android native are identical — no Platform.OS split needed.
   * Measured 2026-07: native RTL Text is logical, so 'text-right' → physical LEFT.
   */
  get textEnd(): string {
    if (!APP_IS_RTL) return '';
    if (needsExplicitRTL()) return 'text-left'; // Expo Go: physical left
    return 'text-right'; // Native RTL (iOS + Android): Yoga flips right → left
  },

  /**
   * Justify content for start
   */
  get justifyStart(): string {
    return needsExplicitRTL() ? 'justify-end' : 'justify-start';
  },

  /**
   * Justify content for end
   */
  get justifyEnd(): string {
    return needsExplicitRTL() ? 'justify-start' : 'justify-end';
  },

  /**
   * Align items for start
   */
  get itemsStart(): string {
    return needsExplicitRTL() ? 'items-end' : 'items-start';
  },

  /**
   * Align items for end
   */
  get itemsEnd(): string {
    return needsExplicitRTL() ? 'items-start' : 'items-end';
  },

  /**
   * Self align for start
   */
  get selfStart(): string {
    return needsExplicitRTL() ? 'self-end' : 'self-start';
  },

  /**
   * Self align for end
   */
  get selfEnd(): string {
    return needsExplicitRTL() ? 'self-start' : 'self-end';
  },

  /**
   * Helper function for padding start (right in RTL, left in LTR)
   */
  ps: (size: number | string): string =>
    needsExplicitRTL() ? `pr-${size}` : `pl-${size}`,

  /**
   * Helper function for padding end (left in RTL, right in LTR)
   */
  pe: (size: number | string): string =>
    needsExplicitRTL() ? `pl-${size}` : `pr-${size}`,

  /**
   * Helper function for margin start
   */
  ms: (size: number | string): string =>
    needsExplicitRTL() ? `mr-${size}` : `ml-${size}`,

  /**
   * Helper function for margin end
   */
  me: (size: number | string): string =>
    needsExplicitRTL() ? `ml-${size}` : `mr-${size}`,
};

// ═══════════════════════════════════════════════════════════════
// LOGICAL PROPERTIES (React Native StyleSheet compatible)
// ═══════════════════════════════════════════════════════════════

/**
 * Spacing utilities that respect RTL direction
 */
export const spacing = {
  marginStart: (value: number) =>
    needsExplicitRTL() ? { marginRight: value } : { marginStart: value },
  marginEnd: (value: number) =>
    needsExplicitRTL() ? { marginLeft: value } : { marginEnd: value },
  paddingStart: (value: number) =>
    needsExplicitRTL() ? { paddingRight: value } : { paddingStart: value },
  paddingEnd: (value: number) =>
    needsExplicitRTL() ? { paddingLeft: value } : { paddingEnd: value },
};

/**
 * Position utilities that respect RTL direction
 */
export const position = {
  start: (value: number) =>
    needsExplicitRTL() ? { right: value } : { left: value },
  end: (value: number) =>
    needsExplicitRTL() ? { left: value } : { right: value },
};

// ═══════════════════════════════════════════════════════════════
// ICON TRANSFORM (For directional icons like arrows)
// ═══════════════════════════════════════════════════════════════

/**
 * Transform utilities for icons that need to flip in RTL
 */
export const iconTransform = {
  /**
   * Horizontal flip for RTL (e.g., back arrow)
   */
  flipHorizontal: APP_IS_RTL ? [{ scaleX: -1 }] : [],

  /**
   * 180-degree rotation for RTL
   */
  rotate180: APP_IS_RTL ? [{ rotate: '180deg' }] : [],
};
