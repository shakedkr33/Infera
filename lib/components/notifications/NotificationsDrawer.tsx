import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/contexts/NotificationsContext';
import type { UserNotification } from '@/contexts/NotificationsContext';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import { position, rtl } from '@/lib/rtl';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.round(SCREEN_WIDTH * 0.7);
// Drawer always slides in from the left regardless of RTL locale.
// translateX is a physical transform (never auto-flipped by I18nManager), so
// these stay negative-to-hide / 0-to-show in every environment.
const CLOSED_X = -DRAWER_WIDTH;
const OPEN_X = 0;
const SPRING = { damping: 26, stiffness: 130 } as const;
const PRIMARY = '#36a9e2';

// ─── pushType → icon + color mapping (cosmetic display only) ─────────────────
// Navigation is driven exclusively by notification.screen — not by this map.

const PUSH_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  event_reminder: { icon: 'schedule', color: '#f59e0b' },
  birthday_today: { icon: 'cake', color: '#a855f7' },
  task_assigned: { icon: 'check-circle', color: '#22c55e' },
  event_updated: { icon: 'edit-calendar', color: '#36a9e2' },
  community_join_approved: { icon: 'group', color: '#36a9e2' },
};

const DEFAULT_TYPE_CONFIG: { icon: string; color: string } = {
  icon: 'notifications',
  color: '#64748b',
};

// ─── Time grouping helpers ────────────────────────────────────────────────────

type TimeGroup = 'today' | 'this_week' | 'older';

function getTimeGroup(createdAt: number): TimeGroup {
  const now = new Date();
  const date = new Date(createdAt);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  if (date >= startOfToday) return 'today';

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  if (date >= startOfWeek) return 'this_week';

  return 'older';
}

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'היום',
  this_week: 'השבוע',
  older: 'ישנות יותר',
};

const GROUP_ORDER: TimeGroup[] = ['today', 'this_week', 'older'];

function getRelativeTime(createdAt: number): string {
  const now = Date.now();
  const diff = now - createdAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for API compatibility. Drawer always slides from the left. */
  direction?: 'rtl' | 'ltr';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationsDrawer({
  isOpen,
  onClose,
}: NotificationsDrawerProps): React.JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, archiveAll } = useNotifications();
  // useBirthdaySheets is retained so callers that previously relied on
  // birthday card opening via the drawer don't break at import time.
  useBirthdaySheets();

  const [modalVisible, setModalVisible] = useState(false);
  const translateX = useSharedValue(CLOSED_X);

  // Combine both updates into one call so React 18 batches them together,
  // preventing an intermediate render where isOpen=true but modalVisible=false
  // that would otherwise re-trigger the opening animation.
  const handleCloseComplete = useCallback((): void => {
    setModalVisible(false);
    onClose();
  }, [onClose]);

  // Animate drawer off-screen then finalize close state atomically.
  const closeDrawer = useCallback((): void => {
    translateX.value = withSpring(CLOSED_X, SPRING, () => {
      runOnJS(handleCloseComplete)();
    });
  }, [translateX, handleCloseComplete]);

  // Respond to parent-driven open / close transitions.
  // The conditions are mutually exclusive (open↔close), preventing loops:
  //   isOpen && !modalVisible  → transition to open
  //   !isOpen && modalVisible  → parent-driven close (e.g. back navigation)
  useEffect(() => {
    if (isOpen && !modalVisible) {
      translateX.value = CLOSED_X; // always start from off-screen
      setModalVisible(true);
      translateX.value = withSpring(OPEN_X, SPRING);
    } else if (!isOpen && modalVisible) {
      translateX.value = withSpring(CLOSED_X, SPRING, () => {
        runOnJS(setModalVisible)(false);
      });
    }
  }, [isOpen, modalVisible, translateX]);

  // Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, closeDrawer]);

  // Swipe left to close (left-side drawer)
  const panGesture = Gesture.Pan()
    .activeOffsetX([Number.NEGATIVE_INFINITY, -8])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      const threshold = DRAWER_WIDTH * 0.3;
      const shouldClose = e.translationX < -threshold || e.velocityX < -700;

      if (shouldClose) {
        // Run closeDrawer on JS thread so it can call withSpring + runOnJS
        runOnJS(closeDrawer)();
      } else {
        translateX.value = withSpring(OPEN_X, SPRING);
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Backdrop fades from fully opaque (open) to invisible (closed)
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [OPEN_X, CLOSED_X], [1, 0]),
  }));

  // Group notifications by recency
  const grouped = useMemo(() => {
    const groups: Record<TimeGroup, UserNotification[]> = {
      today: [],
      this_week: [],
      older: [],
    };
    for (const n of notifications) {
      groups[getTimeGroup(n.createdAt)].push(n);
    }
    return groups;
  }, [notifications]);

  const hasNotifications = notifications.length > 0;

  // Navigation is driven exclusively by the stored screen string.
  // No switch on pushType — that is cosmetic only (icon selection).
  const handleTap = (n: UserNotification): void => {
    onClose();
    setTimeout(() => {
      router.replace(n.screen as Parameters<typeof router.replace>[0]);
    }, 280);
  };

  const handleArchiveAll = async (): Promise<void> => {
    archiveAll();
  };

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={closeDrawer}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {/*
       * Layout: backdrop covers the full screen behind everything.
       * Drawer panel is absolute on the left, rendered on top of the backdrop.
       * Tapping any area outside the drawer hits the backdrop Pressable and
       * fully closes in one tap via closeDrawer.
       */}
      <View style={StyleSheet.absoluteFill}>
        {/* Full-screen semi-transparent backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDrawer}
            accessible={true}
            accessibilityLabel="סגור התראות"
          />
        </Animated.View>

        {/* Drawer panel – absolute left, slides in from off-screen left */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              s.drawerPanel,
              { paddingBottom: insets.bottom },
              s.shadowRight,
              drawerStyle,
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingTop: insets.top + 8 }}
            >
              {/* Header */}
              <View style={s.header}>
                <Pressable
                  onPress={handleArchiveAll}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="נקה הכל"
                  hitSlop={8}
                >
                  <Text style={s.clearAllText}>נקה הכל</Text>
                </Pressable>
                <Text style={s.headerTitle}>התראות</Text>
              </View>

              {/* Content */}
              {!hasNotifications ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyIcon}>🔔</Text>
                  <Text style={s.emptyTitle}>אין התראות כרגע 😊</Text>
                  <Text style={s.emptySubtitle}>
                    נעדכן אותך ברגע שיהיה משהו חשוב.
                  </Text>
                </View>
              ) : (
                GROUP_ORDER.map((group) => {
                  const items = grouped[group];
                  if (items.length === 0) return null;
                  return (
                    <View key={group} style={s.group}>
                      <Text style={s.groupLabel}>{GROUP_LABELS[group]}</Text>
                      {items.map((n) => (
                        <NotificationCard
                          key={n._id}
                          notification={n}
                          onPress={() => handleTap(n)}
                        />
                      ))}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onPress,
}: {
  notification: UserNotification;
  onPress: () => void;
}): React.JSX.Element {
  const config = PUSH_TYPE_CONFIG[notification.pushType] ?? DEFAULT_TYPE_CONFIG;
  const isUnseen = notification.readAt === undefined;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.body}`}
      accessibilityHint="לחץ לצפייה בפרטים"
    >
      {/* Icon */}
      <View style={[s.iconBox, { backgroundColor: `${config.color}1A` }]}>
        <MaterialIcons
          name={config.icon as never}
          size={20}
          color={config.color}
        />
      </View>

      {/* Text content */}
      <View style={s.cardContent}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={s.cardBody} numberOfLines={1}>
          {notification.body}
        </Text>
        <Text style={s.cardTime}>
          {getRelativeTime(notification.createdAt)}
        </Text>
      </View>

      {/* Unseen dot */}
      {isUnseen && <View style={s.unseenDot} />}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    // Soft dark overlay — much softer than the previous solid #000
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  drawerPanel: {
    position: 'absolute',
    // React Native auto-flips physical `left`/`right` values when native RTL
    // is active (I18nManager.isRTL): code-level `left` renders on-screen RIGHT.
    // Since this drawer must always pin to the physical LEFT, we need the
    // logical "end" side (`position.end`), not "start" — `position.start`
    // would resolve to `left: 0` again on native RTL and leave the bug in place.
    ...position.end(0),
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
  },
  shadowRight: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },

  // Header
  header: {
    flexDirection: rtl.flexDirection,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: rtl.textAlign,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Group
  group: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: rtl.textAlign,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Card
  card: {
    flexDirection: rtl.flexDirection,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  cardPressed: {
    backgroundColor: '#f8fafc',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: rtl.textAlign,
  },
  cardBody: {
    fontSize: 12,
    color: '#64748b',
    textAlign: rtl.textAlign,
  },
  cardTime: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: rtl.textAlign,
    marginTop: 2,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginTop: 4,
  },
});
