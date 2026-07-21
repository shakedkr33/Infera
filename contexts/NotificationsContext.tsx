import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { createContext, useCallback, useContext, useMemo } from 'react';
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
  // Gate the query: skip while Convex auth is still loading or the user is
  // unauthenticated. NotificationsProvider is mounted at the root layout level
  // (outside the authenticated route group), so it is alive during cold start,
  // logout, login transitions, and Expo hot reload. Calling the query without
  // this guard causes the server to throw "Not authenticated", which propagates
  // as an unhandled error and crashes the React tree on Android (and iOS).
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const shouldFetch = !isAuthLoading && isAuthenticated;

  // useQuery is always called unconditionally (hook ordering rules).
  // "skip" tells Convex to not subscribe at all, returning undefined safely.
  const rawNotifications = useQuery(
    api.userNotifications.list,
    shouldFetch ? {} : 'skip'
  );
  const markAllReadMutation = useMutation(api.userNotifications.markAllRead);
  const archiveAllMutation = useMutation(api.userNotifications.archiveAll);

  // Safe empty state while unauthenticated or auth is still loading.
  // isLoading is true only when authenticated and the query hasn't resolved yet,
  // so logged-out consumers never see a permanent spinner.
  const notifications: UserNotification[] = rawNotifications ?? [];
  const isLoading = shouldFetch && rawNotifications === undefined;

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
