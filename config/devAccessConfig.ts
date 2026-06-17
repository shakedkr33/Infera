// ============================================================================
// devAccessConfig.ts — Dev/QA Access Override
// ============================================================================
//
// PURPOSE:
//   Allows developers and QA to manually override the effective subscription
//   access state without connecting to real Convex trial fields or RevenueCat.
//
// USAGE:
//   Change DEV_ACCESS_OVERRIDE to one of the EffectiveAccess values below,
//   then reload the app. The useEffectiveAccess hook will pick up the override
//   and return the matching permission set.
//
// ⚠️  IMPORTANT — NEVER USE IN PRODUCTION:
//   This override is ONLY applied when __DEV__ is true (Expo development builds
//   and Expo Go). In production builds __DEV__ is false, so this constant is
//   never read by the access hook.
//
// ⚠️  DO NOT COMMIT WITH A NON-NULL VALUE:
//   Always commit with DEV_ACCESS_OVERRIDE = null so the app boots in the
//   correct default state for other developers.
//
// FUTURE REPLACEMENT:
//   When Convex trial fields (trialStartedAt / trialEndsAt) and RevenueCat
//   entitlement state are connected, the useEffectiveAccess hook will derive
//   the real effective access from those sources. At that point this override
//   will only be needed for edge-case QA testing.
//
// QUICK REFERENCE:
//   "trial_active"       → entire app open, all personal/family/community
//   "trial_expired_free" → personal/family read-only, communities fully active
//   "personal"           → personal features open, family requires upgrade
//   "family"             → personal + family features fully open
//
// ============================================================================

export type EffectiveAccess =
  | 'trial_active'
  | 'trial_expired_free'
  | 'personal'
  | 'family';

// Set to one of the EffectiveAccess values above to override.
// Leave as null to use the default derivation logic in useEffectiveAccess.
export const DEV_ACCESS_OVERRIDE: EffectiveAccess | null = null;
