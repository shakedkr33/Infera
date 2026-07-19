import { useMutation, useQuery } from 'convex/react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserNotification = Doc<'userNotifications'>;

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications: UserNotification[];
  unseenCount: number;
  markAllSeen: () => void;
  archiveAll: () => void;
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
  const rawNotifications = useQuery(api.userNotifications.list);
  const markAllReadMutation = useMutation(api.userNotifications.markAllRead);
  const archiveAllMutation = useMutation(api.userNotifications.archiveAll);

  // undefined while the query is in-flight; resolved to [] when unauthenticated
  // (the server throws "Not authenticated" and Convex surfaces undefined).
  const notifications: UserNotification[] = rawNotifications ?? [];
  const isLoading = rawNotifications === undefined;

  const unseenCount = useMemo(
    () => notifications.filter((n) => n.readAt === undefined).length,
    [notifications]
  );

  const markAllSeen = useCallback((): void => {
    void markAllReadMutation();
  }, [markAllReadMutation]);

  const archiveAll = useCallback((): void => {
    void archiveAllMutation();
  }, [archiveAllMutation]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unseenCount,
      markAllSeen,
      archiveAll,
      isLoading,
    }),
    [notifications, unseenCount, markAllSeen, archiveAll, isLoading]
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
