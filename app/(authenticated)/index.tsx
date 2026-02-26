import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import { NotificationsDrawer } from '@/lib/components/notifications/NotificationsDrawer';
import { getCountdownLabel } from '@/lib/utils/birthday';

const { width: screenWidth } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreetingByHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  if (hour >= 17 && hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Mood data ────────────────────────────────────────────────────────────────

const MOODS = [
  { emoji: '😍', label: 'מדהים', value: 4 },
  { emoji: '🙂', label: 'טוב', value: 3 },
  { emoji: '😐', label: 'סתם', value: 2 },
  { emoji: '😔', label: 'קצת קשה', value: 1 },
  { emoji: '😤', label: 'מתסכל', value: 0 },
];
const MOOD_ITEM_WIDTH = 80;
// Triple the array for a pseudo-infinite feel
const wheelMoods = [...MOODS, ...MOODS, ...MOODS];
// Scroll offset that places the first item of the *middle* block at center
const MOOD_INITIAL_X = MOODS.length * MOOD_ITEM_WIDTH; // 5 * 80 = 400

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { openBirthdayCard, birthdays: contextBirthdays } = useBirthdaySheets();
  const [showToast, setShowToast] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  // ── Mood popup state (Patch 5a) ────────────────────────────────────────────
  const [hasSeenMoodPopupToday, setHasSeenMoodPopupToday] = useState(false);
  const [lastMoodDate, setLastMoodDate] = useState<string | null>(null);
  const [isMoodModalVisible, setIsMoodModalVisible] = useState(false);

  const dateScrollRef = useRef<ScrollView>(null);
  const moodScrollRef = useRef<ScrollView>(null);
  const moodPopupRef = useRef<ScrollView>(null);

  const {
    unseenCount,
    markAllSeen,
    isLoading: notifLoading,
  } = useNotifications();

  const handleBellPress = (): void => {
    if (!isNotificationsOpen) {
      setIsNotificationsOpen(true);
    }
    if (!notifLoading) {
      markAllSeen();
    }
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const greeting = getGreetingByHour(new Date().getHours());
  const todayLabel = new Date().toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }
  for (let d = 1; d <= 7; d++) {
    calendarDays.push(new Date(year, month + 1, d));
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState([
    {
      id: '1',
      time: '13:30',
      title: 'איסוף מהגן',
      location: 'גן שושנים',
      type: 'event',
      icon: 'child-care',
      iconBg: '#FFF4E6',
      iconColor: '#FF922B',
      assigneeColor: '#36a9e2',
      completed: false,
    },
    {
      id: '2',
      time: '16:00',
      title: 'לקנות חלב ולחם',
      location: 'סופר שכונתי',
      type: 'task',
      completed: false,
      icon: 'shopping-cart',
      iconBg: '#E7F5FF',
      iconColor: '#228BE6',
      assigneeColor: '#FFD1DC',
    },
    {
      id: '3',
      time: '17:30',
      title: 'חוג כדורגל (בן 6)',
      location: 'מגרש ספורט קהילתי',
      type: 'event',
      icon: 'fitness-center',
      iconBg: '#F3F0FF',
      iconColor: '#7950F2',
      assigneeColor: '#FFD1DC',
      completed: false,
    },
  ]);

  const toggleTask = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  // ── Delete logic (Patch 3) ─────────────────────────────────────────────────
  const handleDeleteFromSources = (item: (typeof items)[0]) => {
    // TODO: wire to calendar / backend deletion
    console.log('Delete from sources:', item.id);
  };

  const confirmDelete = (item: (typeof items)[0]) => {
    Alert.alert('מחיקה', 'האם אתה בטוח שברצונך למחוק?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          handleDeleteFromSources(item);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        },
      },
    ]);
  };

  // ── Card tap-to-edit (Patch 4) ─────────────────────────────────────────────
  const handleCardPress = (item: (typeof items)[0]) => {
    if (item.type === 'task') {
      router.push({
        pathname: '/(authenticated)/task/[id]',
        params: { id: item.id },
      });
    } else {
      router.push({
        pathname: '/(authenticated)/event/[id]',
        params: { id: item.id },
      });
    }
  };

  // ── Mood helpers (Patch 5a) ────────────────────────────────────────────────
  const shouldShowMoodPrompt = useCallback((): boolean => {
    const lastHour = items.reduce((max, item) => {
      const h = parseInt(item.time.split(':')[0], 10);
      return h > max ? h : max;
    }, 0);
    const moodStartHour = Math.max(19, lastHour);
    return new Date().getHours() >= moodStartHour;
  }, [items]);

  // Reset mood state when a new day begins
  useEffect(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    if (lastMoodDate !== null && lastMoodDate !== todayISO) {
      setHasSeenMoodPopupToday(false);
      setSelectedMood(null);
    }
  }, []); // runs once on mount

  // Check every minute whether to show the mood popup
  useEffect(() => {
    const check = () => {
      if (shouldShowMoodPrompt() && selectedMood === null && !hasSeenMoodPopupToday) {
        setIsMoodModalVisible(true);
      }
    };
    check(); // immediate check on mount
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [shouldShowMoodPrompt, selectedMood, hasSeenMoodPopupToday]);

  // Scroll main mood wheel to initial position after mount
  useEffect(() => {
    setTimeout(() => {
      moodScrollRef.current?.scrollTo({ x: MOOD_INITIAL_X, animated: false });
    }, 150);
  }, []);

  // Scroll popup mood wheel when modal opens
  useEffect(() => {
    if (isMoodModalVisible) {
      setTimeout(() => {
        moodPopupRef.current?.scrollTo({ x: MOOD_INITIAL_X, animated: false });
      }, 150);
    }
  }, [isMoodModalVisible]);

  // Scroll date carousel to today on mount
  useEffect(() => {
    const todayIndex = today.getDate() - 1;
    const PILL_WIDTH = 50;
    const offset = Math.max(0, todayIndex * PILL_WIDTH - (screenWidth - 32 - 38) / 2 + 21);
    setTimeout(() => {
      dateScrollRef.current?.scrollTo({ x: offset, animated: false });
    }, 80);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ── Mood selection handler (shared between bottom section & popup) ──────────
  const handleMoodSelect = (value: number) => {
    setSelectedMood(value);
    setHasSeenMoodPopupToday(true);
    setLastMoodDate(new Date().toISOString().split('T')[0]);
    setIsMoodModalVisible(false);
  };

  // ── Mood scroll-end handler (reusable for both wheels) ────────────────────
  const handleMoodScrollEnd = (
    e: { nativeEvent: { contentOffset: { x: number } } },
    ref: React.RefObject<ScrollView | null>
  ) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / MOOD_ITEM_WIDTH);
    const normalizedIndex = rawIndex % MOODS.length;
    handleMoodSelect(MOODS[normalizedIndex].value);
    // Snap back to middle block to maintain pseudo-infinite illusion
    if (rawIndex < MOODS.length) {
      ref.current?.scrollTo({
        x: (rawIndex + MOODS.length) * MOOD_ITEM_WIDTH,
        animated: false,
      });
    } else if (rawIndex >= MOODS.length * 2) {
      ref.current?.scrollTo({
        x: (rawIndex - MOODS.length) * MOOD_ITEM_WIDTH,
        animated: false,
      });
    }
  };

  const AVATAR_COLORS = ['#FFD1DC', '#E0F2F1', '#FFF9C4', '#E8EAF6', '#FCE4EC'];

  // Padding that centers each mood item when snapped
  const moodWheelPad = (screenWidth - 48 - MOOD_ITEM_WIDTH) / 2; // 48 = parent paddingHorizontal*2
  const moodPopupHPad = Math.max(0, (screenWidth * 0.88 - 56 - MOOD_ITEM_WIDTH) / 2);

  // ── Mood wheel render (reused in both bottom section and popup) ────────────
  const renderMoodWheel = (
    ref: React.RefObject<ScrollView | null>,
    pad: number,
    onScrollEnd: (e: { nativeEvent: { contentOffset: { x: number } } }) => void
  ) => (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={MOOD_ITEM_WIDTH}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: pad }}
      onMomentumScrollEnd={onScrollEnd}
    >
      {wheelMoods.map((mood, i) => {
        const isActive = selectedMood === mood.value;
        return (
          <Pressable
            key={i}
            onPress={() => handleMoodSelect(mood.value)}
            style={styles.moodItem}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={mood.label}
          >
            <View style={[styles.moodEmojiWrap, isActive && styles.moodEmojiWrapActive]}>
              <Text style={{ fontSize: isActive ? 36 : 26, opacity: isActive ? 1 : 0.45 }}>
                {mood.emoji}
              </Text>
            </View>
            <Text style={[styles.moodLabel, isActive && styles.moodLabelActive]}>
              {mood.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Bell — left */}
        <Pressable
          onPress={handleBellPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={
            unseenCount > 0 ? `התראות, ${unseenCount} חדשות` : 'התראות'
          }
          style={{ position: 'relative' }}
        >
          <MaterialIcons
            name={unseenCount > 0 ? 'notifications' : 'notifications-none'}
            size={26}
            color="#111517"
          />
          {unseenCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unseenCount > 9 ? '9+' : unseenCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* PATCH 1: text stack first (left), avatar last (far right in LTR) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.headerDate}>{todayLabel}</Text>
            <Text style={styles.headerGreeting}>{greeting}, שקד</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ש</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ── Date Carousel ──────────────────────────────────────────────── */}
        <View style={styles.carouselRow}>
          <ScrollView
            ref={dateScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {calendarDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const shortName = day.toLocaleDateString('he-IL', { weekday: 'short' });
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDate(day)}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    !isSelected && isToday && styles.dayPillToday,
                  ]}
                >
                  <Text style={[styles.dayPillWeekday, isSelected && styles.dayPillTextSelected]}>
                    {shortName}
                  </Text>
                  <Text style={[styles.dayPillNumber, isSelected && styles.dayPillTextSelected]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => router.push('/(authenticated)/calendar')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="פתח יומן"
            style={{ marginLeft: 8 }}
          >
            <MaterialIcons name="event" size={22} color="#36a9e2" />
          </Pressable>
        </View>

        <Text style={styles.subtitleCount}>
          יש לך {items.length + 1} פעילויות היום
        </Text>

        {/* ── Upcoming event card ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={[styles.cardShadow, styles.eventCard]}>
            <View style={styles.eventAccentBar} />
            <View style={{ padding: 24, paddingRight: 32 }}>

              {/* PATCH 2a: pill + time on same row */}
              <View style={styles.eventTopRow}>
                <View style={styles.eventNextPill}>
                  <Text style={styles.eventNextPillText}>האירוע הבא</Text>
                </View>
                <Text style={styles.eventTime}>09:00</Text>
              </View>

              <Text style={styles.eventTitle}>פגישה בבית הספר</Text>

              {/* PATCH 2b: icon+address group on right, navBtn on left */}
              <View style={styles.eventAddressRow}>
                <View style={styles.eventAddressGroup}>
                  <MaterialIcons name="location-on" size={16} color="#94a3b8" />
                  <Text style={styles.eventAddress} numberOfLines={1}>
                    בית ספר יסודי "אלונים"
                  </Text>
                </View>
                <Pressable
                  style={styles.navBtn}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="נווט"
                >
                  <MaterialIcons name="near-me" size={16} color="#8d6e63" />
                  <Text style={styles.navBtnText}>נווט</Text>
                </Pressable>
              </View>

              <View style={styles.trafficAlert}>
                <MaterialIcons name="traffic" size={20} color="#ff6b6b" />
                <Text style={styles.trafficText}>
                  עומס כבד באיילון: מומלץ לצאת ב-08:15
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Birthdays ──────────────────────────────────────────────────── */}
        <View style={{ marginBottom: 32 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎂 ימי הולדת קרובים</Text>
            <Pressable onPress={() => router.push('/birthdays')}>
              <Text style={styles.seeAll}>ראה הכל</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 24, paddingLeft: 8 }}
          >
            <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
              {contextBirthdays.map((b, idx) => (
                <Pressable
                  key={b.id}
                  onPress={() => openBirthdayCard(b)}
                  style={styles.birthdayCard}
                >
                  <View
                    style={[
                      styles.birthdayAvatar,
                      { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.birthdayCountdown}>{getCountdownLabel(b)}:</Text>
                    <Text style={styles.birthdayName}>{b.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.timelineTitle}>המשך היום</Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          {/* PATCH 3 + 4: Swipeable + tap-to-edit */}
          {items.map((item) => (
            <Swipeable
              key={item.id}
              renderRightActions={() => (
                <Pressable
                  style={styles.deleteAction}
                  onPress={() => confirmDelete(item)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="מחק פריט"
                >
                  <MaterialIcons name="delete-outline" size={26} color="white" />
                </Pressable>
              )}
            >
              <View style={{ flexDirection: 'row-reverse', gap: 16, marginBottom: 4 }}>
                {/* Time column */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>

                {/* Card: Pressable wraps content for tap-to-edit */}
                <View style={{ flex: 1, marginBottom: 12 }}>
                  <Pressable onPress={() => handleCardPress(item)}>
                    <View style={styles.timelineCard}>
                      <View
                        style={[styles.timelineAccent, { backgroundColor: item.iconColor }]}
                      />
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                        {item.type === 'task' && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              toggleTask(item.id);
                            }}
                            style={[
                              styles.taskCheckbox,
                              item.completed
                                ? styles.taskCheckboxDone
                                : styles.taskCheckboxEmpty,
                            ]}
                          >
                            {item.completed && (
                              <MaterialIcons name="check" size={14} color="white" />
                            )}
                          </Pressable>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                            <Text
                              style={[
                                styles.taskTitle,
                                item.completed && styles.completedText,
                              ]}
                            >
                              {item.title}
                            </Text>
                            <View
                              style={[
                                styles.assigneeCircle,
                                { backgroundColor: item.assigneeColor },
                              ]}
                            />
                          </View>
                          <Text style={styles.itemLocation}>{item.location}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              </View>
            </Swipeable>
          ))}
        </View>

        {/* ── "עבור ליומן" button ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginTop: 4, marginBottom: 24 }}>
          <Pressable
            onPress={() => router.push('/(authenticated)/calendar')}
            style={styles.calendarBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="עבור ליומן"
          >
            <Text style={styles.calendarBtnText}>עבור ליומן</Text>
          </Pressable>
        </View>

        {/* ── Mood carousel (Patch 5d: pseudo-infinite wheel) ─────────────── */}
        <View style={{ paddingHorizontal: 24, marginTop: 8, marginBottom: 32 }}>
          <Text style={styles.moodTitle}>איך הרגיש היום שלך?</Text>
          {renderMoodWheel(
            moodScrollRef,
            moodWheelPad,
            (e) => handleMoodScrollEnd(e, moodScrollRef)
          )}
        </View>
      </ScrollView>

      {/* ── Welcome toast ──────────────────────────────────────────────────── */}
      {showToast && (
        <View style={styles.toastWrapper}>
          <View style={[styles.toastShadow, styles.toastCard]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toastText}>
                ברוכים הבאים הביתה, שקד! הכל מוכן. ה-AI של InYomi כבר התחילה
                לעבוד לסנכרן לך את היום.
              </Text>
            </View>
            <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
          </View>
        </View>
      )}

      {/* ── Notifications Drawer ───────────────────────────────────────────── */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* ── Mood Popup Modal (Patch 5b) ────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={isMoodModalVisible}
        onRequestClose={() => setIsMoodModalVisible(false)}
      >
        <View style={styles.moodModalOverlay}>
          <View style={styles.moodModalCard}>
            <Text style={styles.moodModalTitle}>איך הרגיש היום שלך?</Text>
            {renderMoodWheel(
              moodPopupRef,
              moodPopupHPad,
              (e) => handleMoodScrollEnd(e, moodPopupRef)
            )}
            <Pressable
              style={styles.moodModalClose}
              onPress={() => setIsMoodModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="סגור"
            >
              <Text style={styles.moodModalCloseText}>סגור</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#f6f7f8',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerDate: { fontSize: 12, color: '#94a3b8', textAlign: 'right' },
  headerGreeting: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111517',
    textAlign: 'right',
  },

  // Date carousel
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  dayPill: {
    width: 42,
    height: 58,
    borderRadius: 21,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dayPillToday: { borderWidth: 2, borderColor: '#36a9e2' },
  dayPillSelected: { backgroundColor: '#36a9e2', borderWidth: 0 },
  dayPillWeekday: { fontSize: 10, color: '#94a3b8' },
  dayPillNumber: { fontSize: 15, fontWeight: '700', color: '#111517', marginTop: 2 },
  dayPillTextSelected: { color: '#fff', fontWeight: '900' },
  subtitleCount: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'right',
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  // Event card
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f8fafc',
  },
  eventAccentBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#36a9e2',
  },
  // PATCH 2a: single row for pill + time
  eventTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eventNextPill: {
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  eventNextPillText: { color: '#36a9e2', fontSize: 11, fontWeight: '700' },
  eventTime: { color: '#36a9e2', fontSize: 26, fontWeight: '700' },
  eventTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 8,
  },
  // PATCH 2b: address row with proper grouping
  eventAddressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventAddressGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginLeft: 8,
  },
  eventAddress: { color: '#94a3b8', fontSize: 13, flex: 1 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(141,110,99,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navBtnText: { color: '#8d6e63', fontWeight: '700', fontSize: 13 },
  trafficAlert: {
    backgroundColor: '#fff5f5',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  trafficText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },

  // Birthdays
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  seeAll: { fontSize: 12, fontWeight: '700', color: '#36a9e2' },
  birthdayCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    width: 144,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  birthdayAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  birthdayCountdown: {
    fontSize: 9,
    fontWeight: '700',
    color: '#36a9e2',
    textAlign: 'right',
  },
  birthdayName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
  },

  // Timeline
  timelineTitle: { fontSize: 18, fontWeight: '700', color: '#111517' },
  timeColumn: { width: 48, alignItems: 'center', paddingTop: 14 },
  timeText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row-reverse',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  timelineAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  // PATCH 3: delete action
  deleteAction: {
    backgroundColor: '#ff4444',
    borderRadius: 16,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 12,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxDone: { backgroundColor: '#36a9e2', borderColor: '#36a9e2' },
  taskCheckboxEmpty: { borderColor: '#d1d5db' },
  taskTitle: {
    textDecorationLine: 'none',
    color: '#111517',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
    opacity: 0.7,
  },
  assigneeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#fff',
  },
  itemLocation: { color: '#94a3b8', fontSize: 13, textAlign: 'right', marginTop: 2 },

  // Calendar button
  calendarBtn: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarBtnText: { color: '#36a9e2', fontSize: 15, fontWeight: '700' },

  // Mood carousel
  moodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 16,
  },
  moodItem: { width: MOOD_ITEM_WIDTH, alignItems: 'center', paddingVertical: 8 },
  moodEmojiWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  moodEmojiWrapActive: { borderWidth: 2, borderColor: '#36a9e2' },
  moodLabel: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  moodLabelActive: { fontSize: 14, color: '#111517', fontWeight: '700' },

  // Mood popup modal (Patch 5b)
  moodModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodModalCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    width: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  moodModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 20,
  },
  moodModalClose: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  moodModalCloseText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },

  // Toast
  toastWrapper: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: 'center',
  },
  toastShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  toastCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#36a9e2',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  toastText: { color: '#374151', fontSize: 14, lineHeight: 20, textAlign: 'right' },

  // Bell badge
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
});
