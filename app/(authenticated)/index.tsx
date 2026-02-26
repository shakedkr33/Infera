import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import { NotificationsDrawer } from '@/lib/components/notifications/NotificationsDrawer';
import { getCountdownLabel } from '@/lib/utils/birthday';

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { openBirthdayCard, birthdays: contextBirthdays } = useBirthdaySheets();
  const [showToast, setShowToast] = useState(true);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

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
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });

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
    },
  ]);

  const toggleTask = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const AVATAR_COLORS = ['#FFD1DC', '#E0F2F1', '#FFF9C4', '#E8EAF6', '#FCE4EC'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 4,
          backgroundColor: '#f6f7f8',
        }}
      >
        {/* Bell — left side */}
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

        {/* Date + greeting — right side */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
            {todayLabel}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#111517',
              textAlign: 'right',
            }}
          >
            {greeting}, שקד
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ── Week date carousel ─────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            marginBottom: 4,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6 }}
          >
            {weekDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const shortName = day.toLocaleDateString('he-IL', {
                weekday: 'short',
              });
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDate(day)}
                  style={{
                    width: 44,
                    height: 60,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? '#36a9e2' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: isSelected ? '#fff' : '#94a3b8',
                      fontWeight: isSelected ? '900' : '400',
                    }}
                  >
                    {shortName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      color: isSelected ? '#fff' : '#94a3b8',
                      fontWeight: isSelected ? '900' : '400',
                      marginTop: 2,
                    }}
                  >
                    {day.getDate()}
                  </Text>
                  {isToday && !isSelected && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: '#36a9e2',
                        marginTop: 3,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <Text
          style={{
            color: '#94a3b8',
            fontSize: 14,
            textAlign: 'right',
            paddingHorizontal: 24,
            marginBottom: 16,
          }}
        >
          יש לך {items.length + 1} פעילויות היום
        </Text>

        {/* ── Upcoming event card ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View
            style={styles.cardShadow}
            className="bg-white rounded-3xl overflow-hidden border border-gray-50"
          >
            <View className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#36a9e2]" />
            <View className="p-6 pr-8">
              {/* "האירוע הבא" pill */}
              <View
                style={{
                  backgroundColor: '#f0f7ff',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  alignSelf: 'flex-end',
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: '#36a9e2', fontSize: 11, fontWeight: '700' }}>
                  האירוע הבא
                </Text>
              </View>
              <View className="flex-row-reverse justify-between items-start mb-2">
                <View />
                <Text className="text-[#36a9e2] text-2xl font-bold">09:00</Text>
              </View>
              <Text className="text-xl font-bold text-[#111517] text-right">
                פגישה בבית הספר
              </Text>
              <View className="flex-row-reverse items-center gap-1.5 mt-1 mb-4">
                <MaterialIcons name="location-on" size={16} color="#94a3b8" />
                <Text className="text-gray-400 text-sm">
                  בית ספר יסודי "אלונים"
                </Text>
              </View>
              <View className="bg-[#fff5f5] flex-row-reverse items-center p-3 rounded-2xl mb-4">
                <MaterialIcons name="traffic" size={20} color="#ff6b6b" />
                <Text className="text-[#ff6b6b] text-xs font-bold mr-2 text-right flex-1">
                  עומס כבד באיילון: מומלץ לצאת ב-08:15
                </Text>
              </View>
              <Pressable className="bg-[#8d6e63]/10 px-4 py-2 rounded-xl flex-row items-center gap-2 self-start">
                <MaterialIcons name="near-me" size={18} color="#8d6e63" />
                <Text className="text-[#8d6e63] font-bold text-sm">נווט</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Birthdays ──────────────────────────────────────────────────── */}
        <View className="mb-8">
          <View className="flex-row-reverse justify-between px-6 mb-3 items-center">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              🎂 ימי הולדת קרובים
            </Text>
            <Pressable onPress={() => router.push('/birthdays')}>
              <Text className="text-[#36a9e2] text-xs font-bold">ראה הכל</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pr-6"
          >
            <View className="flex-row-reverse gap-3 pl-6">
              {contextBirthdays.map((b, idx) => (
                <Pressable
                  key={b.id}
                  onPress={() => openBirthdayCard(b)}
                  className="bg-white border border-gray-100 rounded-xl px-3 py-2 flex-row-reverse items-center gap-2 w-36 shadow-sm"
                >
                  <View
                    style={{
                      backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                    }}
                    className="size-9 rounded-full border border-gray-100"
                  />
                  <View className="flex-1">
                    <Text className="text-[#36a9e2] font-bold text-[9px] text-right leading-tight">
                      {getCountdownLabel(b)}:
                    </Text>
                    <Text className="text-[#111517] text-[13px] font-bold text-right truncate">
                      {b.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <View className="px-6 mb-4 flex-row-reverse justify-between items-center">
          <Text className="text-[#111517] text-lg font-bold">המשך היום</Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          {items.map((item) => (
            <View
              key={item.id}
              style={{ flexDirection: 'row-reverse', gap: 16, marginBottom: 4 }}
            >
              {/* Time column */}
              <View style={{ width: 48, alignItems: 'center', paddingTop: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8' }}>
                  {item.time}
                </Text>
              </View>

              {/* Card */}
              <View style={{ flex: 1, marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    padding: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 1,
                    overflow: 'hidden',
                  }}
                >
                  {/* Right accent bar */}
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      borderRadius: 2,
                      backgroundColor: item.iconColor,
                    }}
                  />

                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                      {item.type === 'task' && (
                        <Pressable
                          onPress={() => toggleTask(item.id)}
                          style={[
                            {
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              borderWidth: 2,
                              marginTop: 2,
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                            item.completed
                              ? { backgroundColor: '#36a9e2', borderColor: '#36a9e2' }
                              : { borderColor: '#d1d5db' },
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
                              { color: '#111517', fontSize: 15, fontWeight: '700', textAlign: 'right' },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: item.assigneeColor,
                              borderWidth: 1,
                              borderColor: '#fff',
                            }}
                          />
                        </View>
                        <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right', marginTop: 2 }}>
                          {item.location}
                        </Text>
                      </View>
                    </View>

                    {/* Icon */}
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: item.iconBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons
                        name={item.icon as any}
                        size={18}
                        color={item.iconColor}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── Mood check-in ──────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginTop: 8, marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#111517',
              textAlign: 'right',
              marginBottom: 16,
            }}
          >
            איך הרגיש היום שלך?
          </Text>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-around' }}>
            {[
              { emoji: '😒', label: 'קצת קשה', value: 1 },
              { emoji: '😐', label: 'סתם', value: 2 },
              { emoji: '🙂', label: 'טוב', value: 3 },
              { emoji: '😍', label: 'מדהים', value: 4 },
            ].map((mood) => (
              <Pressable
                key={mood.value}
                onPress={() => setSelectedMood(mood.value)}
                style={{ alignItems: 'center', gap: 6 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={mood.label}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selectedMood === mood.value ? 2 : 0,
                    borderColor: '#36a9e2',
                    backgroundColor:
                      selectedMood === mood.value ? '#e8f5fd' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{mood.emoji}</Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: selectedMood === mood.value ? '#36a9e2' : '#94a3b8',
                    fontWeight: selectedMood === mood.value ? '700' : '400',
                  }}
                >
                  {mood.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Welcome toast ──────────────────────────────────────────────────── */}
      {showToast && (
        <View className="absolute bottom-10 left-4 right-4 z-40 flex items-center pointer-events-none">
          <View
            style={styles.toastShadow}
            className="bg-white border border-[#36a9e2] rounded-[24px] px-4 py-4 flex-row-reverse items-start gap-3 w-full max-w-sm pointer-events-auto"
          >
            <View className="flex-1">
              <Text className="text-gray-700 text-sm leading-snug text-right">
                ברוכים הבאים הביתה, שקד! הכל מוכן. ה-AI של InYomi כבר התחילה
                לעבוד לסנכרן לך את היום.
              </Text>
            </View>
            <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
          </View>
        </View>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <Pressable
        onPress={() => setIsActionSheetVisible(true)}
        style={styles.fab}
        className="absolute bottom-28 left-5 bg-[#4A9FE2] size-14 rounded-2xl items-center justify-center"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      {/* ── Notifications Drawer ───────────────────────────────────────────── */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* ── Action Sheet ───────────────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isActionSheetVisible}
        onRequestClose={() => setIsActionSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsActionSheetVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomSheetContainer}
        >
          <View className="bg-white rounded-t-[32px] px-6 pt-3 pb-12 shadow-2xl">
            <View className="w-10 h-1.5 bg-gray-200 rounded-full self-center mb-6" />
            <View className="bg-gray-50 border border-gray-100 rounded-2xl flex-row-reverse items-center px-4 py-3 mb-8">
              <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
              <TextInput
                className="flex-1 text-right text-base font-medium px-3"
                placeholder="על מה את חושבת? או הדביקי הודעה..."
                placeholderTextColor="#94a3b8"
              />
              <View className="flex-row-reverse items-center gap-2">
                <MaterialIcons name="photo-camera" size={22} color="#94a3b8" />
                <MaterialIcons name="mic" size={22} color="#94a3b8" />
              </View>
            </View>
            <View className="flex-row-reverse justify-around items-center">
              <ActionButton
                icon="calendar-today"
                label="אירוע"
                onPress={() => {
                  setIsActionSheetVisible(false);
                  router.push('/(authenticated)/event/new');
                }}
              />
              <ActionButton
                icon="check"
                label="משימה"
                onPress={() => {
                  setIsActionSheetVisible(false);
                  router.push('/(authenticated)/task/new');
                }}
              />
              <ActionButton
                icon="cake"
                label="יום הולדת"
                onPress={() => {
                  setIsActionSheetVisible(false);
                  router.push('/birthdays');
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="items-center gap-2">
      <View className="size-16 rounded-full bg-[#f0f7ff] items-center justify-center">
        <MaterialIcons name={icon as any} size={28} color="#36a9e2" />
      </View>
      <Text className="text-sm font-bold text-[#111418]">{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  toastShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  fab: {
    elevation: 8,
    shadowColor: '#4A9FE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    zIndex: 100,
  },
  taskTitle: { textDecorationLine: 'none' },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
    opacity: 0.7,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
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
