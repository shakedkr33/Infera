// ============================================================================
// useEffectiveAccess.ts — Central Access-Control Hook
// ============================================================================
//
// Returns the current user's effective subscription access level and derived
// permission flags. All subscription/trial gating in the UI should read from
// this hook — never check plan strings or RevenueCat state directly in screens.
//
// Access precedence order (highest to lowest priority):
//   1. DEV_ACCESS_OVERRIDE — only in __DEV__, always wins.
//   2. RevenueCat paid entitlement — only when PAYMENT_SYSTEM_ENABLED=true.
//      'family'   → effectiveAccess = 'family'
//      'personal' → effectiveAccess = 'personal'
//   3. Convex createdAt-based 30-day trial (PAYMENT_SYSTEM_ENABLED=true, no RC entitlement):
//      Within 30 days of account creation → 'trial_active'
//      After 30 days                       → 'trial_expired_free'
//      Still loading / missing user        → 'trial_active' (safe fallback)
//   4. Full trial_active fallback — when PAYMENT_SYSTEM_ENABLED=false.
//
// Communities are always free — never gated regardless of access level.
//
// TODO: Add server-side enforcement in Convex mutations. UI gating alone is
//       NOT sufficient for production — a motivated user could bypass client
//       checks. Personal/family mutations must verify access server-side.
//       Community mutations must remain free and must never be gated.
//
// ============================================================================

import { api } from '@/convex/_generated/api';
import { PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import {
  DEV_ACCESS_OVERRIDE,
  type EffectiveAccess,
} from '@/config/devAccessConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import type { SubscriptionTier } from '@/utils/revenueCatConfig';
import { useQuery } from 'convex/react';

// Declare the React Native global so TypeScript is satisfied without importing
// the full RN package just for this constant.
declare const __DEV__: boolean;

// ============================================================================
// Trial constants
// ============================================================================

const TRIAL_DAYS = 30;
const DAY_MS = 86_400_000;

// ============================================================================
// RevenueCat tier normalizer — testable without React
// ============================================================================

/**
 * Maps a RevenueCat SubscriptionTier to the app's EffectiveAccess model.
 *
 * Used only for paid entitlements ('family' / 'personal').
 * When the tier is null (no entitlement), the caller falls back to
 * Convex createdAt-based trial derivation instead of locking immediately.
 *
 * - 'family'   → 'family'   (personal + family access)
 * - 'personal' → 'personal' (personal access only)
 * - null       → null       (caller handles: check 30-day trial)
 */
export function normalizeSubscriptionTier(
  tier: SubscriptionTier
): EffectiveAccess | null {
  switch (tier) {
    case 'family':
      return 'family';
    case 'personal':
      return 'personal';
    default:
      return null;
  }
}

// ============================================================================
// 30-day trial helper — testable without React
// ============================================================================

/**
 * Derives trial access from the user's Convex account createdAt timestamp.
 *
 * Returns 'trial_active' as a safe fallback when createdAt is not yet
 * available (still loading or missing user) to avoid premature lock-out.
 *
 * @param createdAt - Unix timestamp (ms) of account creation, or null/undefined when loading.
 * @param now       - Current timestamp in ms; defaults to Date.now().
 */
export function getTrialAccessFromCreatedAt(
  createdAt: number | null | undefined,
  now = Date.now()
): EffectiveAccess {
  if (createdAt == null) {
    // Still loading or user missing — do not lock the user prematurely.
    return 'trial_active';
  }
  const trialEndsAt = createdAt + TRIAL_DAYS * DAY_MS;
  return now <= trialEndsAt ? 'trial_active' : 'trial_expired_free';
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
  /**
   * Days remaining in the 30-day full-access trial.
   * - null  → paid plan, or user data still loading (avoid showing "0 days" prematurely)
   * - >= 1  → trial is active, this many full days remain
   * - 0     → trial has expired (free tier)
   */
  trialDaysRemaining: number | null;
  /** Total trial length in days — always 30. Exposed so UIs can display context. */
  trialTotalDays: 30;
}

// ============================================================================
// useEffectiveAccess hook
// ============================================================================

/**
 * Returns the current effective access level and all derived permission flags.
 *
 * Access precedence (highest → lowest priority):
 *   1. DEV_ACCESS_OVERRIDE   — __DEV__ only, always wins regardless of flags.
 *   2. RevenueCat paid tier  — 'family' or 'personal' when PAYMENT_SYSTEM_ENABLED=true.
 *   3. Convex 30-day trial   — no RC entitlement + PAYMENT_SYSTEM_ENABLED=true:
 *        within 30 days of createdAt → 'trial_active'
 *        after 30 days               → 'trial_expired_free'
 *        user still loading          → 'trial_active' (safe fallback, avoids flash)
 *   4. 'trial_active'        — safe fallback when PAYMENT_SYSTEM_ENABLED=false.
 *
 * @example
 * const { canCreatePersonalContent, canEditFamilyContent } = useEffectiveAccess();
 * if (!canCreatePersonalContent) showUpgradeModal();
 */
export function useEffectiveAccess(): UseEffectiveAccessResult {
  // Read RevenueCat tier. RevenueCatProvider wraps the root layout so this
  // is always safe to call. Returns null when there is no active entitlement.
  const { subscriptionTier } = useRevenueCat();

  // Always call useQuery unconditionally (React hook rules).
  // Used below only when PAYMENT_SYSTEM_ENABLED=true and there is no RC entitlement.
  // undefined = still loading; null = authenticated but no user row; Doc = loaded.
  const currentUser = useQuery(api.users.getCurrentUser);

  // ── Derive effectiveAccess using priority order ──────────────────────────

  let effectiveAccess: EffectiveAccess;

  if (__DEV__ && DEV_ACCESS_OVERRIDE !== null) {
    // ── Priority 1: Developer / QA override ─────────────────────────────
    // Only active in __DEV__ builds. Never runs in production.
    effectiveAccess = DEV_ACCESS_OVERRIDE;
  } else if (PAYMENT_SYSTEM_ENABLED) {
    // ── Priority 2 & 3: RevenueCat entitlement, then Convex 30-day trial ──
    const paidAccess = normalizeSubscriptionTier(subscriptionTier);
    if (paidAccess !== null) {
      // Paid RevenueCat entitlement wins.
      effectiveAccess = paidAccess;
    } else {
      // No active RC entitlement — derive from Convex account age.
      // currentUser === undefined means the query is still in flight;
      // getTrialAccessFromCreatedAt returns 'trial_active' in that case
      // so the user is never prematurely locked out during loading.
      effectiveAccess = getTrialAccessFromCreatedAt(currentUser?.createdAt);
    }
  } else {
    // ── Priority 4: Fallback — payments disabled ─────────────────────────
    effectiveAccess = 'trial_active';
  }

  // ── Derive booleans ─────────────────────────────────────────────────────

  const isTrialActive = effectiveAccess === 'trial_active';
  const isExpiredFree = effectiveAccess === 'trial_expired_free';
  const isPersonal = effectiveAccess === 'personal';
  const isFamily = effectiveAccess === 'family';

  // ── Derive trial days remaining ──────────────────────────────────────────
  // null for paid users and while currentUser is still loading.
  // >= 1 for an active trial; 0 when expired.
  // Never stored — always derived on each render.
  let trialDaysRemaining: number | null = null;
  if (!isPersonal && !isFamily && currentUser?.createdAt != null) {
    const trialEndsAt = currentUser.createdAt + TRIAL_DAYS * DAY_MS;
    const msRemaining = trialEndsAt - Date.now();
    trialDaysRemaining =
      msRemaining > 0 ? Math.max(1, Math.ceil(msRemaining / DAY_MS)) : 0;
  }

  const permissions = getAccessPermissions(effectiveAccess);

  return {
    effectiveAccess,
    isTrialActive,
    isExpiredFree,
    isPersonal,
    isFamily,
    trialDaysRemaining,
    trialTotalDays: 30,
    ...permissions,
  };
}
