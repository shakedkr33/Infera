import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Birthday } from '@/lib/types/birthday';

const STORAGE_KEY = 'inyomi_birthdays_v1';

// Written once after the legacy-seed cleanup migration completes.
const MIGRATION_V1_KEY = 'inyomi_birthdays_migration_v1';

// ─── Legacy seed fingerprints ─────────────────────────────────────────────────
// These are the exact entries that the old BirthdaySheetsProvider seeded on
// first launch.  IDs are the literal strings '1'–'4'; real user-created entries
// always have Date.now() epoch strings (13-digit, e.g. "1719601234567").
// Source: git history, removed 2026-06-28.
const LEGACY_SEED_FINGERPRINTS: ReadonlyArray<{ id: string; name: string }> = [
  { id: '1', name: 'דני כהן' },
  { id: '2', name: 'נועה לוי' },
  { id: '3', name: 'נועה' },
  { id: '4', name: 'סבתא רחל' },
] as const;

const LEGACY_SEED_ID_TO_NAME = new Map<string, string>(
  LEGACY_SEED_FINGERPRINTS.map((f) => [f.id, f.name])
);

/**
 * Returns true when a birthday record precisely matches a known legacy seed.
 *
 * The id check alone is virtually infallible: real entries use Date.now()
 * IDs (13-digit epoch strings) and can never be '1', '2', '3', or '4'.
 * The name, contactId, and photoUri checks are belt-and-suspenders guards.
 */
function isLegacySeed(b: Birthday): boolean {
  return (
    LEGACY_SEED_ID_TO_NAME.has(b.id) &&
    LEGACY_SEED_ID_TO_NAME.get(b.id) === b.name &&
    b.contactId == null &&
    b.photoUri == null &&
    !b.source
  );
}

// ─── One-time migration ───────────────────────────────────────────────────────

/**
 * Writes MIGRATION_V1_KEY = 'done' and logs the reason.
 *
 * Does NOT throw: a failed marker write simply causes a safe re-run on the
 * next app launch, where the same decision path will be taken harmlessly.
 */
async function markMigrationDone(reason: string): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_V1_KEY, 'done');
    if (__DEV__) {
      console.log(`[Birthdays/migration-v1] done — ${reason}`);
    }
  } catch (error) {
    // Marker write failed.  Migration will re-run next launch and take the
    // same safe decision path.  No data loss occurs in any branch.
    if (__DEV__) {
      console.log(
        `[Birthdays/migration-v1] marker write FAILED (${reason}) — ` +
          'will re-run next launch (safe, no data loss)'
      );
      console.error('[Birthdays/migration-v1] marker write error:', error);
    }
  }
}

/**
 * Removes legacy demo seed entries from AsyncStorage — but ONLY when the
 * persisted list consists exclusively of the exact known seed entries.
 *
 * Execution order (legacy-only path):
 *   1. Read MIGRATION_V1_KEY — abort if already 'done'.
 *   2. Read STORAGE_KEY — abort on read failure (marker NOT written).
 *   3. Parse JSON — if corrupt, abort WITHOUT writing marker (may be repairable).
 *   4. Classify entries as legacy or real.
 *   5a. Legacy-only  → write cleaned list to STORAGE_KEY first;
 *                       if that write fails, abort WITHOUT writing marker;
 *                       only write marker after a confirmed successful data write.
 *   5b. Mixed        → skip deletions, write marker.
 *   5c. No legacy    → write marker, no data touched.
 *   5d. Empty/null   → write marker, no data touched.
 *
 * All real user birthdays are preserved in every branch.
 */
export async function runBirthdayLegacySeedMigration(): Promise<void> {
  // ── Step 1: check idempotency marker ───────────────────────────────────────
  let marker: string | null;
  try {
    marker = await AsyncStorage.getItem(MIGRATION_V1_KEY);
  } catch (error) {
    // Cannot determine whether migration already ran — skip this launch.
    // Marker is NOT written; migration will retry on next launch.
    if (__DEV__) {
      console.log(
        '[Birthdays/migration-v1] marker read FAILED — skipping this launch'
      );
      console.error('[Birthdays/migration-v1] marker read error:', error);
    }
    return;
  }

  if (marker === 'done') {
    if (__DEV__) {
      console.log('[Birthdays/migration-v1] already ran — skipping');
    }
    return;
  }

  // ── Step 2: read stored birthday list ──────────────────────────────────────
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Read failed — original data untouched, marker NOT written.
    // Migration will retry on next launch.
    if (__DEV__) {
      console.log(
        '[Birthdays/migration-v1] data read FAILED — aborting (no changes made)'
      );
      console.error('[Birthdays/migration-v1] data read error:', error);
    }
    return;
  }

  // ── Step 3: handle empty storage ───────────────────────────────────────────
  if (!raw) {
    await markMigrationDone('no stored data — nothing to clean');
    return;
  }

  // ── Step 4: parse JSON ─────────────────────────────────────────────────────
  let stored: Birthday[];
  try {
    stored = JSON.parse(raw) as Birthday[];
  } catch {
    // Corrupt JSON — leave data untouched, do NOT write the marker.
    // Keeping the marker absent lets the migration rerun if the storage is
    // later repaired (e.g. by a successful AsyncStorage write from elsewhere)
    // or if the user reinstalls over clean data.
    if (__DEV__) {
      console.log(
        '[Birthdays/migration-v1] corrupt stored data — aborting without marker'
      );
    }
    return;
  }

  // ── Step 5: classify entries ───────────────────────────────────────────────
  const legacyEntries = stored.filter(isLegacySeed);
  const realEntries = stored.filter((b) => !isLegacySeed(b));

  if (legacyEntries.length === 0) {
    // No demo seeds present — nothing to remove.
    await markMigrationDone(
      `no legacy seeds found — ${stored.length} real entry(ies) untouched`
    );
    return;
  }

  if (realEntries.length > 0) {
    // Mixed list: real birthdays coexist with seeds.
    // Do NOT auto-delete — the user may have intentionally kept the seeds.
    if (__DEV__) {
      console.warn(
        '[Birthdays/migration-v1] SKIPPED — mixed list: ' +
          `${legacyEntries.length} legacy seed(s) + ` +
          `${realEntries.length} real entry(ies). ` +
          'No deletions made. User can remove seeds manually.'
      );
    }
    await markMigrationDone(
      `mixed list (${legacyEntries.length} seeds + ${realEntries.length} real) — no deletions`
    );
    return;
  }

  // ── Step 6 (legacy-only): write cleaned data FIRST, marker SECOND ──────────
  //
  // Sub-case A — data write fails:
  //   The catch block below fires. Original list is untouched. Marker is NOT
  //   written. Migration retries on next launch with the original list intact.
  //
  // Sub-case B — data write succeeds, marker write fails (inside markMigrationDone):
  //   STORAGE_KEY now holds "[]". MIGRATION_V1_KEY remains absent.
  //   Next launch: migration reads "[]", JSON.parse gives [], legacyEntries=[],
  //   realEntries=[] → falls into the "no legacy seeds found" branch →
  //   markMigrationDone writes the marker successfully. No birthday data is
  //   created, altered, or deleted. The state is fully recovered.
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (error) {
    // Data write failed — original list preserved exactly as-is.
    // Marker NOT written: migration will retry on next launch.
    if (__DEV__) {
      console.log(
        '[Birthdays/migration-v1] CLEANUP ABORTED — data write FAILED. ' +
          `Original ${legacyEntries.length} seed(s) preserved. ` +
          'Will retry next launch.'
      );
      console.error('[Birthdays/migration-v1] data write error:', error);
    }
    return;
  }

  // Data write confirmed successful — now write the marker.
  await markMigrationDone(`removed ${legacyEntries.length} legacy seed(s)`);
}

// ─── Core storage helpers ─────────────────────────────────────────────────────

export async function loadPersistedBirthdays(): Promise<Birthday[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Birthday[];
  } catch {
    return null;
  }
}

export async function persistBirthdays(birthdays: Birthday[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(birthdays));
}
