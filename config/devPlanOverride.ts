// ============================================================================
// devPlanOverride.ts — Runtime Dev Subscription Plan Override
// ============================================================================
//
// PURPOSE:
//   Provides a runtime-changeable subscription plan override for development
//   and QA testing. Unlike DEV_ACCESS_OVERRIDE (static constant requiring code
//   changes), this module allows toggling the plan via UI without reloading.
//
// SAFETY:
//   - getDevPlanOverride() always returns null when __DEV__ is false.
//   - All set/subscribe functions are no-ops in production builds.
//   - Metro dead-code eliminates __DEV__ branches in production bundles.
//   - The override only affects UI-layer access checks in useEffectiveAccess.
//   - No Convex mutations are bypassed; server-side checks remain unaffected.
//
// USAGE:
//   - setDevPlanOverride('personal')  → activates Plus plan simulation
//   - setDevPlanOverride('family')    → activates Family plan simulation
//   - setDevPlanOverride('trial_expired_free') → activates Free (expired) simulation
//   - setDevPlanOverride(null)        → clears override, uses real access logic
//
// PERSISTENCE:
//   Override persists across hot reloads via AsyncStorage (dev only).
//   This avoids needing to re-set the plan after every JS bundle reload.
//
// ⚠️  NEVER COMMIT code that calls setDevPlanOverride in a non-UI handler.
//     This module is ONLY for the profile debug panel UI.
//
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EffectiveAccess } from './devAccessConfig';

// TypeScript needs this declaration for React Native globals.
declare const __DEV__: boolean;

const STORAGE_KEY = '@inyomi_dev_plan_override_v1';

const VALID_ACCESSES: readonly EffectiveAccess[] = [
  'trial_active',
  'trial_expired_free',
  'personal',
  'family',
];

// ── In-memory state (dev only) ───────────────────────────────────────────────

let _override: EffectiveAccess | null = null;
const _listeners = new Set<() => void>();

// Restore persisted override from AsyncStorage when the module is first loaded.
// Only runs in __DEV__ builds — Metro eliminates this entire branch in production.
if (__DEV__) {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (stored !== null && (VALID_ACCESSES as string[]).includes(stored)) {
        _override = stored as EffectiveAccess;
        for (const fn of _listeners) fn();
      }
    })
    .catch(() => {
      // Ignore storage errors — dev only, not critical.
    });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current runtime dev plan override, or null if none is set.
 * Always returns null in production builds.
 */
export function getDevPlanOverride(): EffectiveAccess | null {
  if (!__DEV__) return null;
  return _override;
}

/**
 * Sets the runtime dev plan override.
 * Persists to AsyncStorage so it survives hot reloads.
 * Notifies all subscribers so useEffectiveAccess re-renders immediately.
 * No-op in production builds.
 */
export function setDevPlanOverride(plan: EffectiveAccess | null): void {
  if (!__DEV__) return;
  _override = plan;
  if (plan !== null) {
    AsyncStorage.setItem(STORAGE_KEY, plan).catch(() => {});
  } else {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
  for (const fn of _listeners) fn();
}

/**
 * Subscribes to changes in the dev plan override.
 * Returns an unsubscribe function.
 * No-op (returns empty unsubscribe) in production builds.
 */
export function subscribeDevPlanOverride(listener: () => void): () => void {
  if (!__DEV__) return () => {};
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
