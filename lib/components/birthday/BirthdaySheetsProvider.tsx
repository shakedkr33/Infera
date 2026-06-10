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
import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import {
  loadPersistedBirthdays,
  persistBirthdays,
} from '@/lib/birthdayStorage';
import type { Birthday } from '@/lib/types/birthday';
import { BirthdayCardSheet } from './BirthdayCardSheet';
import { BirthdayEditSheet } from './BirthdayEditSheet';

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

// Seeded only when there is no saved data yet (first launch).
const SEED_BIRTHDAYS: Birthday[] = [
  {
    id: '1',
    name: 'דני כהן',
    day: 15,
    month: 2,
    year: 1995,
    photoUri: null,
    contactId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '2',
    name: 'נועה לוי',
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    year: null,
    photoUri: null,
    contactId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '3',
    name: 'נועה',
    day: 5,
    month: new Date().getMonth() + 1,
    year: 2018,
    photoUri: null,
    contactId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '4',
    name: 'סבתא רחל',
    day: 15,
    month: new Date().getMonth() + 1,
    year: null,
    photoUri: null,
    contactId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

interface ProviderProps {
  children: ReactNode;
}

export function BirthdaySheetsProvider({
  children,
}: ProviderProps): React.JSX.Element {
  const { isExpiredFree } = useEffectiveAccess();

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const birthdaysRef = useRef<Birthday[]>([]);
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
        console.error('[Birthdays] Failed to persist birthdays', error);
      }
    },
    []
  );

  // Load persisted birthdays on mount; seed once on first launch.
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const saved = await loadPersistedBirthdays();
        if (saved !== null) {
          birthdaysRef.current = saved;
          setBirthdays(saved);
          return;
        }

        // Persist seed before exposing it in UI to avoid a write race with
        // an early delete on first launch.
        try {
          await persistBirthdays(SEED_BIRTHDAYS);
        } catch (error) {
          console.error('[Birthdays] Failed to persist seed birthdays', error);
        }
        birthdaysRef.current = SEED_BIRTHDAYS;
        setBirthdays(SEED_BIRTHDAYS);
      } catch (error) {
        console.error('[Birthdays] Failed to load birthdays', error);
      }
    };

    void load();
  }, []);

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
