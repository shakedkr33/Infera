import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import type {
  Notification,
  NotificationType,
} from '@/lib/notificationsStorage';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.round(SCREEN_WIDTH * 0.75);
const SPRING = { damping: 26, stiffness: 130 } as const;
const PRIMARY = '#36a9e2';

// ─── Notification type → icon + color mapping ────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  event_reminder: { icon: 'schedule', color: '#f59e0b' },
  birthday_today: { icon: 'cake', color: '#a855f7' },
  task_assigned: { icon: 'check-circle', color: '#22c55e' },
  event_updated: { icon: 'edit-calendar', color: '#36a9e2' },
};

// ─── Time grouping helpers ────────────────────────────────────────────────────

type TimeGroup = 'today' | 'this_week' | 'older';

function getTimeGroup(dateStr: string): TimeGroup {
  const now = new Date();
  const date = new Date(dateStr);

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

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
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
  /** 'rtl' | 'ltr' – slides from left in RTL, from right in LTR */
  direction?: 'rtl' | 'ltr';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationsDrawer({
  isOpen,
  onClose,
  direction = 'rtl',
}: NotificationsDrawerProps): React.JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, archiveAll } = useNotifications();
  const { findBirthdayByName, openBirthdayCard } = useBirthdaySheets();

  const isRTL = direction === 'rtl';

  const [modalVisible, setModalVisible] = useState(false);
  const translateX = useSharedValue(isRTL ? -DRAWER_WIDTH : DRAWER_WIDTH);

  // Animate open / close
  useEffect(() => {
    const offScreen = isRTL ? -DRAWER_WIDTH : DRAWER_WIDTH;
    if (isOpen) {
      setModalVisible(true);
      translateX.value = withSpring(0, SPRING);
    } else if (modalVisible) {
      translateX.value = withSpring(offScreen, SPRING, () => {
        runOnJS(setModalVisible)(false);
      });
    }
  }, [isOpen, modalVisible, translateX, isRTL]);

  // Android back button
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, onClose]);

  // Swipe to close – swipe left (negative X) in RTL, right (positive X) in LTR
  const panGesture = Gesture.Pan()
    .activeOffsetX(
      isRTL ? [Number.NEGATIVE_INFINITY, -8] : [8, Number.POSITIVE_INFINITY]
    )
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (isRTL) {
        if (e.translationX < 0) translateX.value = e.translationX;
      } else {
        if (e.translationX > 0) translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      const offScreen = isRTL ? -DRAWER_WIDTH : DRAWER_WIDTH;
      const threshold = DRAWER_WIDTH * 0.3;
      const shouldClose = isRTL
        ? e.translationX < -threshold || e.velocityX < -700
        : e.translationX > threshold || e.velocityX > 700;

      if (shouldClose) {
        translateX.value = withSpring(offScreen, SPRING);
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const offScreen = isRTL ? -DRAWER_WIDTH : DRAWER_WIDTH;
    return {
      opacity: interpolate(translateX.value, [0, offScreen], [1, 0]),
    };
  });

  // Group notifications
  const grouped = useMemo(() => {
    const groups: Record<TimeGroup, Notification[]> = {
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

  // Navigation handler
  const handleTap = (n: Notification): void => {
    onClose();
    setTimeout(() => {
      switch (n.type) {
        case 'event_reminder':
        case 'event_updated':
          router.push(`/(authenticated)/event/${n.entityId}` as never);
          break;
        case 'birthday_today': {
          const found = findBirthdayByName(
            n.title.replace(/.*של\s+/, '').replace(/\s*🎂.*/, '')
          );
          if (found) openBirthdayCard(found);
          break;
        }
        case 'task_assigned':
          router.push('/(authenticated)/tasks' as never);
          break;
      }
    }, 280);
  };

  const handleArchiveAll = async (): Promise<void> => {
    await archiveAll();
  };

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View
        style={[s.modalRoot, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}
      >
        {/* Backdrop */}
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={onClose}
            accessible={true}
            accessibilityLabel="סגור התראות"
          />
        </Animated.View>

        {/* Drawer panel */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              s.drawerPanel,
              { paddingBottom: insets.bottom },
              isRTL ? s.shadowRight : s.shadowLeft,
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
                          key={n.id}
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
  notification: Notification;
  onPress: () => void;
}): React.JSX.Element {
  const config = TYPE_CONFIG[notification.type];
  const isUnseen = notification.seenAt === null;

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
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  drawerPanel: {
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
  shadowLeft: {
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },

  // Header
  header: {
    flexDirection: 'row-reverse',
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
    textAlign: 'right',
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
    textAlign: 'right',
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Card
  card: {
    flexDirection: 'row-reverse',
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
    textAlign: 'right',
  },
  cardBody: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
  },
  cardTime: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
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
