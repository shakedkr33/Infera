// ============================================================================
// קונפיגורציית REVENUECAT - InYomi
// ============================================================================
// ניהול מפתחות RevenueCat API לפי פלטפורמה וסביבה
//
// API Key Prefixes (per RevenueCat docs):
// - Test Store: test_... (for development testing only)
// - iOS Production: appl_...
// - Android Production: goog_...
//
// CRITICAL: Test Store key must ONLY be used in development builds.
// The SDK will crash/alert in production builds if configured with a Test Store key.

import { Platform } from 'react-native';

type RevenueCatPlatform = 'ios' | 'android';

// ============================================================================
// Subscription Tier Type
// ============================================================================

export type SubscriptionTier = 'personal' | 'family' | null;

// ============================================================================
// Entitlement IDs
// ============================================================================

export const PERSONAL_ENTITLEMENT_ID = 'personal';
export const FAMILY_ENTITLEMENT_ID = 'family';

/** @deprecated Legacy entitlement — kept for backward compatibility only.
 *  Do NOT use for tier mapping. Use PERSONAL/FAMILY entitlements instead. */
export const ENTITLEMENT_ID = 'InYomi Pro';

// ============================================================================
// Package Identifiers (RevenueCat Offering packages)
// ============================================================================

export const PACKAGE_IDS = {
  personalMonthly: 'personal_monthly',
  personalAnnual: 'personal_annual',
  familyMonthly: 'family_monthly',
  familyAnnual: 'family_annual',
} as const;

// ============================================================================
// Product Identifiers (App Store / Google Play)
// ============================================================================

export const PRODUCT_IDS = {
  personalMonthly: 'inyomi_personal_monthly',
  personalAnnual: 'inyomi_personal_annual',
  familyMonthly: 'inyomi_family_monthly',
  familyAnnual: 'inyomi_family_annual',
  /** @deprecated Legacy — kept for old paywall backward compatibility */
  monthly: 'monthly',
  /** @deprecated Legacy — kept for old paywall backward compatibility */
  yearly: 'yearly',
  /** @deprecated Legacy — kept for old paywall backward compatibility */
  lifetime: 'lifetime',
} as const;

// ============================================================================
// API Key Management
// ============================================================================

/**
 * קבלת מפתח RevenueCat API המתאים לפי פלטפורמה וסביבה
 * סדר עדיפויות:
 * 1. עדיפות עליונה: מפתח Test Store (לבדיקות פיתוח)
 * 2. Production - לפי פלטפורמה
 * 3. מחזיר null אם לא מוגדר מפתח (מאפשר פיתוח ללא מפתחות)
 */
export function getRevenueCatApiKey(
  platform: RevenueCatPlatform
): string | null {
  // 1. עדיפות עליונה: מפתח Test Store (לבדיקות פיתוח)
  const testStoreKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY;
  if (testStoreKey) {
    return testStoreKey;
  }

  // 2. Production - לפי פלטפורמה
  if (platform === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  }

  if (platform === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  }

  return null;
}

/**
 * קבלת מפתח RevenueCat API עבור הפלטפורמה הנוכחית
 */
export function getCurrentPlatformRevenueCatApiKey(): string | null {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return getRevenueCatApiKey(platform);
}

/**
 * בדיקה האם RevenueCat מוגדר כראוי עבור הפלטפורמה הנוכחית
 */
export function isRevenueCatConfigured(): boolean {
  return getCurrentPlatformRevenueCatApiKey() !== null;
}
