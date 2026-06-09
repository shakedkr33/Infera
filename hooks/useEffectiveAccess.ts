// ============================================================================
// useEffectiveAccess.ts — Central Access-Control Hook
// ============================================================================
//
// Returns the current user's effective subscription access level and derived
// permission flags. All subscription/trial gating in the UI should read from
// this hook — never check plan strings or RevenueCat state directly in screens.
//
// PHASE 2A — Mock/Dev mode only:
//   Access is derived from DEV_ACCESS_OVERRIDE when __DEV__ and the override is
//   set. Otherwise defaults to "trial_active" (all features open), matching the
//   current production behavior where PAYMENT_SYSTEM_ENABLED = false.
//
// FUTURE — Phase 2B and beyond:
//   TODO: Replace the default fallback with real derivation from Convex:
//         const user = useQuery(api.users.getCurrentUser);
//         Derive from user.trialEndsAt and user.subscriptionTier.
//   TODO: daysRemaining must be derived from trialEndsAt, NEVER stored as a
//         mutable counter field. Compute it as:
//         Math.ceil((trialEndsAt - Date.now()) / 86_400_000)
//   TODO: Cross-check with RevenueCat entitlement state once RevenueCat is
//         connected and PAYMENT_SYSTEM_ENABLED is true.
//   TODO: Add server-side enforcement in Convex mutations. UI gating alone is
//         NOT sufficient for production — a motivated user could bypass client
//         checks. Personal/family mutations must verify access server-side.
//         Community mutations must remain free and must never be gated.
//
// ============================================================================

import {
  DEV_ACCESS_OVERRIDE,
  type EffectiveAccess,
} from '@/config/devAccessConfig';

// Declare the React Native global so TypeScript is satisfied without importing
// the full RN package just for this constant.
declare const __DEV__: boolean;

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
 * Phase 2A: reads from DEV_ACCESS_OVERRIDE when in __DEV__, otherwise
 * defaults to "trial_active" (full access, matching the current production
 * behavior of PAYMENT_SYSTEM_ENABLED = false).
 *
 * @example
 * const { canCreatePersonalContent, canEditFamilyContent } = useEffectiveAccess();
 * if (!canCreatePersonalContent) showUpgradeModal();
 */
export function useEffectiveAccess(): UseEffectiveAccessResult {
  // ── Phase 2A: derive access ─────────────────────────────────────────────
  //
  // Priority order (each phase extends this block):
  //   1. DEV_ACCESS_OVERRIDE (dev/QA builds only)           ← Phase 2A
  //   2. Convex user.subscriptionTier + trialEndsAt         ← TODO Phase 2B
  //   3. RevenueCat entitlement cross-check                 ← TODO Phase 2C
  //   4. Fallback: "trial_active" (safe default)
  //
  let effectiveAccess: EffectiveAccess = 'trial_active';

  if (__DEV__ && DEV_ACCESS_OVERRIDE !== null) {
    effectiveAccess = DEV_ACCESS_OVERRIDE;
  }

  // TODO (Phase 2B): Read Convex user trial/subscription fields here.
  //   const user = useQuery(api.users.getCurrentUser);
  //   if (user?.trialEndsAt && Date.now() > user.trialEndsAt && !user.subscriptionTier) {
  //     effectiveAccess = 'trial_expired_free';
  //   } else if (user?.subscriptionTier) {
  //     effectiveAccess = user.subscriptionTier; // 'personal' | 'family'
  //   }
  //   Remember: daysRemaining = Math.ceil((trialEndsAt - Date.now()) / 86_400_000)
  //   Never store daysRemaining as a field — always derive it from trialEndsAt.

  // TODO (Phase 2C): Cross-check with RevenueCat entitlements when
  //   PAYMENT_SYSTEM_ENABLED is true. RevenueCat is the source of truth for
  //   paid plan status. Convex trial fields are the source of truth for trial.

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
