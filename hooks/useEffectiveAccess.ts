// ============================================================================
// useEffectiveAccess.ts — Central Access-Control Hook
// ============================================================================
//
// Returns the current user's effective subscription access level and derived
// permission flags. All subscription/trial gating in the UI should read from
// this hook — never check plan strings or RevenueCat state directly in screens.
//
// PHASE 3B-2 — RevenueCat tier wired up (payments still disabled):
//   Access precedence order (highest to lowest priority):
//     1. DEV_ACCESS_OVERRIDE — only in __DEV__, always wins.
//     2. RevenueCat subscriptionTier — only when PAYMENT_SYSTEM_ENABLED=true.
//     3. Fallback: "trial_active" — when PAYMENT_SYSTEM_ENABLED=false (current).
//
// FUTURE — Phase 2B and beyond:
//   TODO: Replace the default fallback with real derivation from Convex:
//         const user = useQuery(api.users.getCurrentUser);
//         Derive from user.trialEndsAt and user.subscriptionTier.
//   TODO: daysRemaining must be derived from trialEndsAt, NEVER stored as a
//         mutable counter field. Compute it as:
//         Math.ceil((trialEndsAt - Date.now()) / 86_400_000)
//   TODO: When PAYMENT_SYSTEM_ENABLED becomes true, also cross-check Convex
//         trial fields for users whose trial is still active but have no
//         RevenueCat entitlement yet (free trial period).
//   TODO: Add server-side enforcement in Convex mutations. UI gating alone is
//         NOT sufficient for production — a motivated user could bypass client
//         checks. Personal/family mutations must verify access server-side.
//         Community mutations must remain free and must never be gated.
//
// ============================================================================

import { PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import {
  DEV_ACCESS_OVERRIDE,
  type EffectiveAccess,
} from '@/config/devAccessConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import type { SubscriptionTier } from '@/utils/revenueCatConfig';

// Declare the React Native global so TypeScript is satisfied without importing
// the full RN package just for this constant.
declare const __DEV__: boolean;

// ============================================================================
// RevenueCat tier normalizer — testable without React
// ============================================================================

/**
 * Maps a RevenueCat SubscriptionTier to the app's EffectiveAccess model.
 *
 * Called only when PAYMENT_SYSTEM_ENABLED is true so that RevenueCat is
 * the authoritative source of paid access.
 *
 * - 'family'   → 'family'             (personal + family access)
 * - 'personal' → 'personal'           (personal access only)
 * - null       → 'trial_expired_free' (no active entitlement, read-only)
 *
 * "free" is not a separate tier in EffectiveAccess — the absence of a
 * RevenueCat entitlement maps to 'trial_expired_free' (locked paid features).
 */
export function normalizeSubscriptionTier(
  tier: SubscriptionTier
): EffectiveAccess {
  switch (tier) {
    case 'family':
      return 'family';
    case 'personal':
      return 'personal';
    default:
      // null / undefined / unknown value → no subscription, free mode
      return 'trial_expired_free';
  }
}

// ============================================================================
// Pure permission helper — testable without React
// ============================================================================

export interface AccessPermissions {
  // Viewing is always allowed regardless of access level.
  canViewPersonalContent: boolean;
  canViewFamilyContent: boolean;

  // Personal create/edit — allowed during trial, personal, or family plan.
  canCreatePersonalContent: boolean;
  canEditPersonalContent: boolean;

  // Family create/edit — allowed during trial or family plan only.
  canCreateFamilyContent: boolean;
  canEditFamilyContent: boolean;

  // Task mutation granularity (matches the create/edit rules above).
  canMutatePersonalTask: boolean;
  canMutateFamilyTask: boolean;

  // Communities are always free — these are always true.
  canUseCommunities: boolean;
  canMutateCommunityContent: boolean;

  // Family profile and pets editing — requires trial or family plan.
  canEditFamilyProfile: boolean;
  canEditPets: boolean;
}

/**
 * Derives the full permission set from an EffectiveAccess value.
 *
 * This is a pure function so it can be unit-tested without a React context.
 * The hook below calls this internally.
 */
export function getAccessPermissions(
  access: EffectiveAccess
): AccessPermissions {
  const isTrial = access === 'trial_active';
  const isPersonal = access === 'personal';
  const isFamily = access === 'family';

  const canMutatePersonal = isTrial || isPersonal || isFamily;
  const canMutateFamily = isTrial || isFamily;

  return {
    // Viewing is never restricted.
    canViewPersonalContent: true,
    canViewFamilyContent: true,

    canCreatePersonalContent: canMutatePersonal,
    canEditPersonalContent: canMutatePersonal,

    canCreateFamilyContent: canMutateFamily,
    canEditFamilyContent: canMutateFamily,

    canMutatePersonalTask: canMutatePersonal,
    canMutateFamilyTask: canMutateFamily,

    // Communities are always free — never gated.
    canUseCommunities: true,
    canMutateCommunityContent: true,

    canEditFamilyProfile: canMutateFamily,
    canEditPets: canMutateFamily,
  };
}

// ============================================================================
// Hook return type
// ============================================================================

export interface UseEffectiveAccessResult extends AccessPermissions {
  effectiveAccess: EffectiveAccess;
  isTrialActive: boolean;
  isExpiredFree: boolean;
  isPersonal: boolean;
  isFamily: boolean;
}

// ============================================================================
// useEffectiveAccess hook
// ============================================================================

/**
 * Returns the current effective access level and all derived permission flags.
 *
 * Phase 3B-2: RevenueCat subscriptionTier is now read and wired into the
 * precedence chain, but only takes effect when PAYMENT_SYSTEM_ENABLED=true.
 * While PAYMENT_SYSTEM_ENABLED remains false the behavior is identical to
 * the previous phase (full trial_active access for all users).
 *
 * Access precedence (highest → lowest priority):
 *   1. DEV_ACCESS_OVERRIDE   — __DEV__ only, always wins regardless of flags.
 *   2. RevenueCat tier       — only when PAYMENT_SYSTEM_ENABLED=true.
 *   3. 'trial_active'        — safe fallback when PAYMENT_SYSTEM_ENABLED=false.
 *
 * @example
 * const { canCreatePersonalContent, canEditFamilyContent } = useEffectiveAccess();
 * if (!canCreatePersonalContent) showUpgradeModal();
 */
export function useEffectiveAccess(): UseEffectiveAccessResult {
  // Read RevenueCat tier. RevenueCatProvider wraps the root layout so this
  // is always safe to call. When PAYMENT_SYSTEM_ENABLED=false the context
  // returns subscriptionTier=null (no-op in the logic below).
  const { subscriptionTier } = useRevenueCat();

  // ── Derive effectiveAccess using priority order ──────────────────────────

  let effectiveAccess: EffectiveAccess;

  if (__DEV__ && DEV_ACCESS_OVERRIDE !== null) {
    // ── Priority 1: Developer / QA override ─────────────────────────────
    // Only active in __DEV__ builds. Never runs in production.
    // Overrides RevenueCat AND the payment flag — always wins in dev.
    effectiveAccess = DEV_ACCESS_OVERRIDE;
  } else if (PAYMENT_SYSTEM_ENABLED) {
    // ── Priority 2: RevenueCat subscription tier ─────────────────────────
    // PAYMENT_SYSTEM_ENABLED=true means RevenueCat is the source of truth.
    // normalizeSubscriptionTier maps the RC tier to EffectiveAccess:
    //   'family'   → 'family'
    //   'personal' → 'personal'
    //   null       → 'trial_expired_free'
    effectiveAccess = normalizeSubscriptionTier(subscriptionTier);
  } else {
    // ── Priority 3: Fallback — payments disabled ─────────────────────────
    // PAYMENT_SYSTEM_ENABLED=false (current state). Grant full trial access
    // so no existing user is accidentally locked out.
    //
    // TODO (Phase 2B): Replace with Convex trial derivation:
    //   const user = useQuery(api.users.getCurrentUser);
    //   if (user?.trialEndsAt && Date.now() > user.trialEndsAt) {
    //     effectiveAccess = 'trial_expired_free';
    //   } else if (user?.subscriptionTier) {
    //     effectiveAccess = user.subscriptionTier;
    //   } else {
    //     effectiveAccess = 'trial_active';
    //   }
    //   daysRemaining = Math.ceil((trialEndsAt - Date.now()) / 86_400_000)
    //   Never store daysRemaining as a field — always derive from trialEndsAt.
    effectiveAccess = 'trial_active';
  }

  // ── Derive booleans ─────────────────────────────────────────────────────

  const isTrialActive = effectiveAccess === 'trial_active';
  const isExpiredFree = effectiveAccess === 'trial_expired_free';
  const isPersonal = effectiveAccess === 'personal';
  const isFamily = effectiveAccess === 'family';

  const permissions = getAccessPermissions(effectiveAccess);

  return {
    effectiveAccess,
    isTrialActive,
    isExpiredFree,
    isPersonal,
    isFamily,
    ...permissions,
  };
}
