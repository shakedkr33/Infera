import { useQuery } from 'convex/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/convex/_generated/api';
import type { Notification } from '@/lib/notificationsStorage';
import {
  getNotifications,
  getUnseenCount,
  addNotification as storageAdd,
  archiveAll as storageArchiveAll,
  markAllSeen as storageMarkAllSeen,
} from '@/lib/notificationsStorage';

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

  const currentUser = useQuery(api.users.getCurrentUser);
  // undefined = still loading, null = not authenticated, Doc = resolved
  const userId: string | null = currentUser?._id
    ? String(currentUser._id)
    : null;

  const refresh = useCallback(async (): Promise<void> => {
    if (!userId) {
      setNotifications([]);
      setUnseenCount(0);
      return;
    }
    const [list, count] = await Promise.all([
      getNotifications(userId),
      getUnseenCount(userId),
    ]);
    setNotifications(list);
    setUnseenCount(count);
  }, [userId]);

  // Load real notifications once the authenticated user is known
  useEffect(() => {
    // currentUser === undefined means the query is still in-flight; wait.
    if (currentUser === undefined) return;

    const init = async (): Promise<void> => {
      try {
        if (!userId) {
          setNotifications([]);
          setUnseenCount(0);
          return;
        }
        await refresh();
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [currentUser, userId, refresh]);

  const markAllSeen = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await storageMarkAllSeen(userId);
    await refresh();
  }, [userId, refresh]);

  const archiveAll = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await storageArchiveAll(userId);
    await refresh();
  }, [userId, refresh]);

  const addOne = useCallback(
    async (n: Notification): Promise<void> => {
      if (!userId) return;
      await storageAdd(n);
      await refresh();
    },
    [userId, refresh]
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
