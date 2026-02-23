import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Notification } from '@/lib/notificationsStorage';
import {
  getNotifications,
  getUnseenCount,
  addNotification as storageAdd,
  archiveAll as storageArchiveAll,
  markAllSeen as storageMarkAllSeen,
} from '@/lib/notificationsStorage';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user_1';

function generateMockNotifications(): Notification[] {
  const now = Date.now();
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  return [
    {
      id: 'mock_1',
      userId: MOCK_USER_ID,
      type: 'birthday_today',
      title: 'היום יום ההולדת של אמא 🎂',
      body: 'לא לשכוח לברך!',
      entityType: 'person',
      entityId: 'person_1',
      createdAt: new Date(now).toISOString(),
      seenAt: null,
      archivedAt: null,
    },
    {
      id: 'mock_2',
      userId: MOCK_USER_ID,
      type: 'event_reminder',
      title: 'בעוד שעה: חוג כדורגל לשקד ⚽',
      body: 'היום ב־17:00',
      entityType: 'event',
      entityId: 'event_1',
      createdAt: new Date(now - 2 * HOUR).toISOString(),
      seenAt: null,
      archivedAt: null,
    },
    {
      id: 'mock_3',
      userId: MOCK_USER_ID,
      type: 'task_assigned',
      title: 'הוקצת למשימה: לקנות חלב 🥛',
      body: 'נוסף על ידי יניב',
      entityType: 'task',
      entityId: 'task_1',
      createdAt: new Date(now - DAY).toISOString(),
      seenAt: new Date(now - DAY + HOUR).toISOString(),
      archivedAt: null,
    },
    {
      id: 'mock_4',
      userId: MOCK_USER_ID,
      type: 'event_updated',
      title: 'האירוע פגישה עם המורה עודכן',
      body: 'השעה שונתה ל־18:30',
      entityType: 'event',
      entityId: 'event_2',
      createdAt: new Date(now - 3 * DAY).toISOString(),
      seenAt: new Date(now - 2 * DAY).toISOString(),
      archivedAt: null,
    },
  ];
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications: Notification[];
  unseenCount: number;
  markAllSeen: () => Promise<void>;
  archiveAll: () => Promise<void>;
  addNotification: (n: Notification) => Promise<void>;
  isLoading: boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const userId = MOCK_USER_ID;

  const refresh = useCallback(async (): Promise<void> => {
    const [list, count] = await Promise.all([
      getNotifications(userId),
      getUnseenCount(userId),
    ]);
    setNotifications(list);
    setUnseenCount(count);
  }, [userId]);

  // Seed mock data on first launch, then load
  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const existing = await getNotifications(userId);
        if (existing.length === 0) {
          const mocks = generateMockNotifications();
          for (const m of mocks) {
            await storageAdd(m);
          }
        }
        await refresh();
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [userId, refresh]);

  const markAllSeen = useCallback(async (): Promise<void> => {
    await storageMarkAllSeen(userId);
    await refresh();
  }, [userId, refresh]);

  const archiveAll = useCallback(async (): Promise<void> => {
    await storageArchiveAll(userId);
    await refresh();
  }, [userId, refresh]);

  const addOne = useCallback(
    async (n: Notification): Promise<void> => {
      await storageAdd(n);
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unseenCount,
      markAllSeen,
      archiveAll,
      addNotification: addOne,
      isLoading,
    }),
    [notifications, unseenCount, markAllSeen, archiveAll, addOne, isLoading]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within a NotificationsProvider'
    );
  }
  return ctx;
}
