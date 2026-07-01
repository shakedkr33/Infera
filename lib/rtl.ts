/**
 * Environment-Aware RTL Utilities for Mobile Template
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This module provides THE DEFINITIVE SOLUTION for consistent RTL layout across:
 * - Expo Go (native RTL doesn't work, needs explicit overrides)
 * - Dev/Prod builds (native RTL works via I18nManager)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * HOW textAlign WORKS WITH Yoga direction: 'rtl'
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * textAlign is NOT auto-flipped by I18nManager (unlike flexDirection).
 * iOS and Android handle it differently:
 *
 *   iOS native (I18nManager.isRTL=true):
 *     Yoga inherits RTL direction from the OS → 'left' is logical-start →
 *     physical RIGHT. Use 'left' (logical inverse) so text lands on the right.
 *
 *   Android native (I18nManager.isRTL=true):
 *     Yoga does NOT auto-flip textAlign. 'left' stays physical LEFT. Must use
 *     'right' explicitly so text lands on the physical right.
 *
 *   Expo Go (no native RTL active):
 *     No Yoga RTL mode; textAlign values are physical. Use 'right'.
 *
 * ┌────────────────────┬───────────────────┬────────────────────┬──────────────────┐
 * │ Environment        │ rtl.textAlign     │ Yoga direction:rtl │ Final Result     │
 * ├────────────────────┼───────────────────┼────────────────────┼──────────────────┤
 * │ Expo Go            │ "right"           │ No  (physical)     │ RIGHT ✅         │
 * │ iOS native RTL     │ "left"            │ Yes (logical)      │ RIGHT ✅         │
 * │ Android native RTL │ "right"           │ No  (not flipped)  │ RIGHT ✅         │
 * └────────────────────┴───────────────────┴────────────────────┴──────────────────┘
 *
 * ┌─────────────┬───────────────────┬───────────────┬──────────────────┐
 * │ Environment │ rtl.flexDirection │ Native Flips? │ Final Result     │
 * ├─────────────┼───────────────────┼───────────────┼──────────────────┤
 * │ Expo Go     │ "row-reverse"     │ No            │ row-reverse ✅   │
 * │ Dev Build   │ "row"             │ Yes           │ row-reverse ✅   │
 * │ Prod Build  │ "row"             │ Yes           │ row-reverse ✅   │
 * └─────────────┴───────────────────┴───────────────┴──────────────────┘
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * import { rtl } from "@/lib/rtl";
 *
 * // Text alignment (environment-aware)
 * <Text style={{ textAlign: rtl.textAlign }}>כותרת בעברית</Text>
 *
 * // Flex direction (environment-aware)
 * <View style={{ flexDirection: rtl.flexDirection }}>
 *   <Icon />
 *   <Text>Item</Text>
 * </View>
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import Constants from 'expo-constants';
import { I18nManager, Platform } from 'react-native';

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
 * Get text alignment for Hebrew/RTL content.
 *
 * textAlign is NOT auto-flipped by I18nManager. The platforms diverge here:
 *
 *   iOS native (I18nManager.isRTL=true):
 *     Yoga inherits RTL direction from the native environment, so 'left' means
 *     logical-start → physical RIGHT. Return 'left' (logical). ✅
 *
 *   Android native (I18nManager.isRTL=true):
 *     Yoga does NOT auto-flip textAlign even with direction:'rtl' on the root
 *     View. 'left' stays physical LEFT. Return 'right' (explicit physical). ✅
 *
 *   Expo Go (needsExplicitRTL()=true, no native RTL):
 *     No Yoga RTL mode on root. Return 'right' (explicit physical). ✅
 *
 * ┌────────────────────┬─────────────────┬────────────────────┬──────────────┐
 * │ Environment        │ getTextAlign()  │ Yoga direction:rtl │ Final Result │
 * ├────────────────────┼─────────────────┼────────────────────┼──────────────┤
 * │ Expo Go            │ "right"         │ No  (physical)     │ RIGHT ✅     │
 * │ iOS native RTL     │ "left"          │ Yes (logical)      │ RIGHT ✅     │
 * │ Android native RTL │ "right"         │ No  (not flipped)  │ RIGHT ✅     │
 * └────────────────────┴─────────────────┴────────────────────┴──────────────┘
 *
 * @returns "right" | "left" | undefined
 */
export const getTextAlign = (): 'right' | 'left' | undefined => {
  if (needsExplicitRTL()) {
    return 'right'; // Expo Go: physical right (no Yoga RTL)
  }
  if (I18nManager.isRTL && Platform.OS === 'android') {
    return 'right'; // Android native: Yoga does not auto-flip textAlign
  }
  if (I18nManager.isRTL && Platform.OS === 'ios') {
    return 'left'; // iOS native: Yoga logical-start → physical right
  }
  return undefined;
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
   * Text alignment for RTL content.
   * Returns 'right' in Expo Go (physical), 'left' in native RTL builds (logical,
   * because Yoga direction:'rtl' on root makes 'left' render as physical right).
   */
  get textAlign(): 'right' | 'left' | undefined {
    return getTextAlign();
  },

  /**
   * Environment-aware flex direction.
   * - Expo Go: "row-reverse"
   * - Native RTL: "row" (gets flipped to "row-reverse")
   */
  get flexDirection(): 'row' | 'row-reverse' {
    return getFlexDirection();
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
   * Tailwind text-alignment class for logical "start" (right side in RTL).
   * Mirrors getTextAlign() — Expo Go and Android need explicit 'text-right';
   * iOS Yoga logical mode uses 'text-left' which renders as physical right.
   */
  get textStart(): string {
    if (needsExplicitRTL()) return 'text-right';
    if (I18nManager.isRTL && Platform.OS === 'android') return 'text-right';
    if (I18nManager.isRTL && Platform.OS === 'ios') return 'text-left';
    return '';
  },

  /**
   * Tailwind text-alignment class for logical "end" (left side in RTL).
   * Opposite of textStart.
   */
  get textEnd(): string {
    if (needsExplicitRTL()) return 'text-left';
    if (I18nManager.isRTL && Platform.OS === 'android') return 'text-left';
    if (I18nManager.isRTL && Platform.OS === 'ios') return 'text-right';
    return '';
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
