import { useQuery } from 'convex/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { UpgradeModal, type UpgradeReason } from '@/components/UpgradeModal';
import { api } from '@/convex/_generated/api';
import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import {
  loadPersistedBirthdays,
  persistBirthdays,
  runBirthdayLegacySeedMigration,
} from '@/lib/birthdayStorage';
import type { Birthday } from '@/lib/types/birthday';
import { BirthdayCardSheet } from './BirthdayCardSheet';
import { BirthdayEditSheet } from './BirthdayEditSheet';

/** Phone number used by the Apple App Review demo account. */
const APPLE_REVIEW_PHONE = '+972510000000';

interface BirthdaySheetsContextValue {
  openBirthdayCard: (birthday: Birthday) => void;
  openBirthdayEdit: (birthday?: Birthday) => void;
  openBirthdayCreate: () => void;
  closeAll: () => void;
  deleteBirthday: (id: string) => void;
  birthdays: Birthday[];
  findBirthdayByName: (name: string) => Birthday | undefined;
}

const BirthdaySheetsContext = createContext<BirthdaySheetsContextValue | null>(
  null
);

export function useBirthdaySheets(): BirthdaySheetsContextValue {
  const context = useContext(BirthdaySheetsContext);
  if (!context) {
    throw new Error(
      'useBirthdaySheets must be used within BirthdaySheetsProvider'
    );
  }
  return context;
}

// SEED_BIRTHDAYS removed: first-launch empty list is now the correct behaviour.
// Showing demo data to real users was a regression — removed 2026-06-28.

interface ProviderProps {
  children: ReactNode;
}

export function BirthdaySheetsProvider({
  children,
}: ProviderProps): React.JSX.Element {
  const { isExpiredFree } = useEffectiveAccess();

  // Read current user to detect the Apple Review demo account.
  // Returns undefined while loading, null if unauthenticated, or the user doc.
  const currentUser = useQuery(api.users.getCurrentUser);

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const birthdaysRef = useRef<Birthday[]>([]);
  // Ensures the load effect runs only once after the user identity is known.
  const hasLoadedRef = useRef(false);
  const [selectedBirthday, setSelectedBirthday] = useState<Birthday | null>(
    null
  );
  const [cardSheetVisible, setCardSheetVisible] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>('personal');

  useEffect(() => {
    birthdaysRef.current = birthdays;
  }, [birthdays]);

  const commitBirthdays = useCallback(
    async (next: Birthday[]): Promise<void> => {
      birthdaysRef.current = next;
      setBirthdays(next);
      try {
        await persistBirthdays(next);
      } catch (error) {
        if (__DEV__) {
          console.error('[Birthdays] Failed to persist birthdays', error);
        }
      }
    },
    []
  );

  // Load persisted birthdays once after the user identity is known.
  // For the Apple Review demo account, skip AsyncStorage entirely and expose
  // an empty list — no personal data leaks, no stored data is touched.
  useEffect(() => {
    // currentUser is undefined while the Convex identity query is in-flight.
    // Defer until identity is resolved so we can detect the demo account.
    if (currentUser === undefined) return;

    // Run only once per mount regardless of future currentUser updates
    // (e.g. profile refreshes that produce a new object reference).
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Apple Review demo user: show empty birthdays without touching AsyncStorage.
    // AsyncStorage is not read, not written, and not seeded — real data is safe.
    if (currentUser?.phone === APPLE_REVIEW_PHONE) {
      birthdaysRef.current = [];
      setBirthdays([]);
      return;
    }

    // Normal user: run one-time seed cleanup, then load from AsyncStorage.
    const load = async (): Promise<void> => {
      try {
        // Remove legacy demo seeds if this is the first run after the fix.
        // No-ops immediately on every subsequent launch (marker already set).
        await runBirthdayLegacySeedMigration();

        const saved = await loadPersistedBirthdays();
        if (saved !== null) {
          if (__DEV__) {
            console.log(
              `[Birthdays] source=AsyncStorage count=${saved.length}`
            );
          }
          birthdaysRef.current = saved;
          setBirthdays(saved);
          return;
        }

        // No saved data (fresh install or different storage namespace).
        // Show an intentional empty list — never fall back to demo data.
        if (__DEV__) {
          console.log('[Birthdays] source=empty (no saved data found)');
        }
        birthdaysRef.current = [];
        setBirthdays([]);
      } catch (error) {
        // Storage read failed — surface an empty list rather than demo data.
        if (__DEV__) {
          console.error('[Birthdays] Failed to load birthdays', error);
          console.log('[Birthdays] source=error (storage read failed)');
        }
        birthdaysRef.current = [];
        setBirthdays([]);
      }
    };

    void load();
  }, [currentUser]);

  const openBirthdayCard = (birthday: Birthday): void => {
    setSelectedBirthday(birthday);
    setCardSheetVisible(true);
  };

  const openBirthdayEdit = (birthday?: Birthday): void => {
    if (isExpiredFree) {
      setUpgradeReason('personal');
      setUpgradeModalVisible(true);
      return;
    }
    setSelectedBirthday(birthday ?? null);
    setEditSheetVisible(true);
  };

  const openBirthdayCreate = (): void => {
    if (isExpiredFree) {
      setUpgradeReason('personal');
      setUpgradeModalVisible(true);
      return;
    }
    setSelectedBirthday(null);
    setEditSheetVisible(true);
  };

  const closeAll = (): void => {
    setCardSheetVisible(false);
    setEditSheetVisible(false);
    setTimeout(() => setSelectedBirthday(null), 300);
  };

  const handleEdit = (): void => {
    if (isExpiredFree) {
      setCardSheetVisible(false);
      setUpgradeReason('personal');
      setUpgradeModalVisible(true);
      return;
    }
    setCardSheetVisible(false);
    setTimeout(() => setEditSheetVisible(true), 300);
  };

  const handleSave = (data: Partial<Birthday>): void => {
    const current = birthdaysRef.current;
    const next =
      data.id && data.id !== ''
        ? current.map((b) =>
            b.id === data.id ? { ...b, ...data, updatedAt: Date.now() } : b
          )
        : [
            ...current,
            {
              id: Date.now().toString(),
              name: data.name ?? '',
              day: data.day ?? 1,
              month: data.month ?? 1,
              year: data.year ?? null,
              photoUri: data.photoUri ?? null,
              contactId: data.contactId ?? null,
              source: data.source ?? 'manual',
              phoneNumber: data.phoneNumber ?? null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];

    void (async () => {
      await commitBirthdays(next);
      closeAll();
    })();
  };

  const deleteBirthday = (id: string): void => {
    const next = birthdaysRef.current.filter((b) => b.id !== id);

    void (async () => {
      await commitBirthdays(next);
      if (selectedBirthday?.id === id) {
        closeAll();
      }
    })();
  };

  const handleDelete = (): void => {
    if (selectedBirthday?.id) {
      deleteBirthday(selectedBirthday.id);
    }
  };

  const findBirthdayByName = (name: string): Birthday | undefined =>
    birthdays.find((b) => b.name === name);

  const value: BirthdaySheetsContextValue = {
    openBirthdayCard,
    openBirthdayEdit,
    openBirthdayCreate,
    closeAll,
    deleteBirthday,
    birthdays,
    findBirthdayByName,
  };

  return (
    <BirthdaySheetsContext.Provider value={value}>
      {children}
      <BirthdayCardSheet
        birthday={selectedBirthday}
        visible={cardSheetVisible}
        onClose={closeAll}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <BirthdayEditSheet
        key={selectedBirthday?.id || selectedBirthday?.contactId || 'create'}
        birthday={selectedBirthday ?? undefined}
        visible={editSheetVisible}
        onClose={closeAll}
        onSave={handleSave}
        onDelete={selectedBirthday?.id ? handleDelete : undefined}
      />
      <UpgradeModal
        visible={upgradeModalVisible}
        reason={upgradeReason}
        onClose={() => setUpgradeModalVisible(false)}
      />
    </BirthdaySheetsContext.Provider>
  );
}
