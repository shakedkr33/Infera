import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import { rtl } from '@/lib/rtl';

// ===== Constants =====
const PRIMARY_BLUE = '#36a9e2';
const BG_COLOR = '#f6f7f8';
const COMPACT_CELL_HEIGHT = 60;
const EXPANDED_CELL_HEIGHT = 92;

// Dynamic panel height building blocks
const PANEL_FIXED_HEIGHT = 86; // paddingTop(16) + dayHeaders(34) + gap(4) + paddingBottom(8) + dragHandle(24)
const COMPACT_ROW_HEIGHT = COMPACT_CELL_HEIGHT + 4; // cell + weekRow marginBottom
const EXPANDED_ROW_HEIGHT = EXPANDED_CELL_HEIGHT + 4; // cell + weekRow marginBottom

type SnapState = 'compact' | 'expanded';

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const HEBREW_DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const HEBREW_WEEKDAYS_FULL = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
];

// ===== Types =====
interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  category: string;
  categoryColor: string;
  location?: string;
  icon?: string;
  cancelled?: boolean;
  assigneeColors: string[];
}

interface BirthdayInfo {
  name: string;
  age?: number;
}

interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  birthday?: BirthdayInfo;
}

// ===== Mock Data =====
const MOCK_TIMELINE_DATA = [
  {
    dayLabel: 'היום, יום חמישי',
    dayNumber: '24',
    isToday: true,
    events: [
      {
        id: '1',
        category: 'משפחה',
        categoryColor: '#ff922b',
        title: 'ארוחת צהריים משפחתית',
        time: '13:00',
        location: 'בבית',
        icon: 'home',
        cancelled: false,
      },
      {
        id: '2',
        category: 'בריאות',
        categoryColor: PRIMARY_BLUE,
        title: 'תור לרופא שיניים',
        time: '10:00',
        location: 'מרפאת כללית, תל אביב',
        icon: 'location-on',
        cancelled: false,
      },
      {
        id: '3',
        category: 'אישי',
        categoryColor: '#9ca3af',
        title: 'קפה עם אמא',
        time: '08:30',
        location: 'קפה לנדוור',
        icon: 'local-cafe',
        cancelled: true,
      },
    ],
  },
  {
    dayLabel: 'אתמול, יום רביעי',
    dayNumber: '23',
    isToday: false,
    events: [
      {
        id: '4',
        category: 'כושר',
        categoryColor: '#7950f2',
        title: 'אימון בחדר כושר',
        time: '18:00',
        location: 'הולמס פלייס',
        icon: 'fitness-center',
        cancelled: false,
      },
      {
        id: '5',
        category: 'קניות',
        categoryColor: '#51cf66',
        title: 'קניות לשבת',
        time: '16:30',
        location: 'שופרסל דיל',
        icon: 'shopping-cart',
        cancelled: false,
      },
    ],
  },
  {
    dayLabel: 'יום שלישי',
    dayNumber: '22',
    isToday: false,
    events: [
      {
        id: '6',
        category: 'עבודה',
        categoryColor: '#6b7280',
        title: 'פגישת צוות שבועית',
        time: '09:00',
        location: '',
        icon: '',
        cancelled: false,
      },
    ],
  },
];

const MOCK_MONTHLY_EVENTS: Record<number, CalendarEvent[]> = {
  2: [
    {
      id: 'm1',
      title: 'פגישת הורים',
      time: '16:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#36a9e2'],
    },
  ],
  5: [
    {
      id: 'm2',
      title: 'יום הולדת נועה',
      time: '17:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#7950f2', '#51cf66'],
    },
  ],
  8: [
    {
      id: 'm3',
      title: 'תור לרופא',
      time: '10:00',
      category: 'בריאות',
      categoryColor: '#36a9e2',
      assigneeColors: ['#36a9e2'],
    },
  ],
  10: [
    {
      id: 'm4',
      title: 'אימון כושר',
      time: '18:00',
      category: 'כושר',
      categoryColor: '#7950f2',
      assigneeColors: ['#7950f2'],
    },
    {
      id: 'm5',
      title: 'ארוחת ערב משפחתית',
      time: '20:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#51cf66'],
    },
  ],
  12: [
    {
      id: 'm6',
      title: 'קניות לשבת',
      time: '16:30',
      category: 'קניות',
      categoryColor: '#51cf66',
      assigneeColors: ['#51cf66'],
    },
  ],
  15: [
    {
      id: 'm7',
      title: 'יום הולדת סבתא רחל',
      time: '12:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#7950f2', '#36a9e2', '#51cf66'],
    },
  ],
  16: [
    {
      id: 'm8',
      title: 'ארוחת צהריים משפחתית',
      time: '13:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b'],
    },
    {
      id: 'm9',
      title: 'תור לרופא שיניים',
      time: '10:00',
      category: 'בריאות',
      categoryColor: '#36a9e2',
      assigneeColors: ['#36a9e2'],
    },
  ],
  18: [
    {
      id: 'm10',
      title: 'חוג ציור',
      time: '15:00',
      category: 'חוגים',
      categoryColor: '#e64980',
      assigneeColors: ['#e64980'],
    },
  ],
  20: [
    {
      id: 'm11',
      title: 'טיול משפחתי',
      time: '08:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#7950f2', '#51cf66', '#36a9e2'],
    },
  ],
  22: [
    {
      id: 'm12',
      title: 'פגישת צוות שבועית',
      time: '09:00',
      category: 'עבודה',
      categoryColor: '#6b7280',
      assigneeColors: ['#6b7280'],
    },
  ],
  25: [
    {
      id: 'm13',
      title: 'חוג פסנתר',
      time: '16:00',
      category: 'חוגים',
      categoryColor: '#7950f2',
      assigneeColors: ['#7950f2'],
    },
  ],
  28: [
    {
      id: 'm14',
      title: 'ערב הורים בבית ספר',
      time: '19:00',
      category: 'משפחה',
      categoryColor: '#ff922b',
      assigneeColors: ['#ff922b', '#36a9e2'],
    },
  ],
};

const MOCK_BIRTHDAYS: Record<number, BirthdayInfo> = {
  5: { name: 'נועה', age: 8 },
  15: { name: 'סבתא רחל' },
};

// ===== Event Helpers =====
function calculateDuration(event: CalendarEvent): number {
  const durations: Record<string, number> = {
    משפחה: 60,
    בריאות: 60,
    אישי: 45,
    כושר: 60,
    קניות: 30,
    עבודה: 120,
    חוגים: 45,
  };
  return durations[event.category] ?? 60;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    משפחה: 'people',
    בריאות: 'local-hospital',
    אישי: 'person',
    כושר: 'fitness-center',
    קניות: 'shopping-cart',
    עבודה: 'work',
    חוגים: 'palette',
  };
  return icons[category] ?? 'event';
}

// ===== Calendar Grid Helpers =====
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function generateCalendarGrid(year: number, month: number): CalendarDay[][] {
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const allDays: CalendarDay[] = [];

  for (let i = firstDayOffset - 1; i >= 0; i--) {
    allDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    allDays.push({
      day: d,
      isCurrentMonth: true,
      isToday: d === todayDay && month === todayMonth && year === todayYear,
      events: MOCK_MONTHLY_EVENTS[d] ?? [],
      birthday: MOCK_BIRTHDAYS[d],
    });
  }

  const minCells = 35;
  const targetCells = allDays.length <= minCells ? minCells : 42;
  const remaining = targetCells - allDays.length;
  for (let i = 1; i <= remaining; i++) {
    allDays.push({
      day: i,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  if (weeks.length === 6 && weeks[5].every((d) => !d.isCurrentMonth)) {
    weeks.pop();
  }

  return weeks;
}

// ===== Main Component =====
export default function CalendarScreen(): React.JSX.Element {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');
  const [slideAnim] = useState(new Animated.Value(0));

  const today = useMemo(() => new Date(), []);
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate()
  );

  // === Calendar grid data ===
  const grid = useMemo(
    () => generateCalendarGrid(displayYear, displayMonth),
    [displayYear, displayMonth]
  );

  // === Dynamic panel heights based on number of weeks ===
  const compactPanelHeight =
    PANEL_FIXED_HEIGHT + grid.length * COMPACT_ROW_HEIGHT;
  const expandedPanelHeight =
    PANEL_FIXED_HEIGHT + grid.length * EXPANDED_ROW_HEIGHT;

  const calendarHeight = useSharedValue(compactPanelHeight);
  const savedHeight = useSharedValue(compactPanelHeight);
  const compactHeightSV = useSharedValue(compactPanelHeight);
  const expandedHeightSV = useSharedValue(expandedPanelHeight);
  const [snapState, setSnapState] = useState<SnapState>('compact');
  const isExpanded = snapState === 'expanded';

  // Sync shared values when month changes (grid.length may differ)
  useEffect(() => {
    compactHeightSV.value = compactPanelHeight;
    expandedHeightSV.value = expandedPanelHeight;
    calendarHeight.value = withSpring(compactPanelHeight, {
      damping: 20,
      stiffness: 90,
    });
    setSnapState('compact');
  }, [
    compactPanelHeight,
    expandedPanelHeight,
    calendarHeight,
    compactHeightSV,
    expandedHeightSV,
  ]);

  // === Day events list animation (lifted from MonthlyGrid) ===
  const isShowingListRef = useRef(selectedDay != null);
  const [visibleDay, setVisibleDay] = useState<number | null>(selectedDay);
  const listAnim = useRef(
    new Animated.Value(selectedDay != null ? 1 : 0)
  ).current;

  useEffect(() => {
    if (selectedDay != null) {
      setVisibleDay(selectedDay);
      if (!isShowingListRef.current) {
        listAnim.setValue(0);
        Animated.timing(listAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      isShowingListRef.current = true;
    } else {
      Animated.timing(listAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setVisibleDay(null);
      });
      isShowingListRef.current = false;
    }
  }, [selectedDay, listAnim]);

  const visibleDayData = useMemo((): CalendarDay | null => {
    if (visibleDay == null) return null;
    for (const week of grid) {
      for (const d of week) {
        if (d.day === visibleDay && d.isCurrentMonth) return d;
      }
    }
    return null;
  }, [grid, visibleDay]);

  // === Pan gesture for entire calendar panel ===
  // drag DOWN (positive translationY) = expand, drag UP = collapse
  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      'worklet';
      savedHeight.value = calendarHeight.value;
    })
    .onUpdate((event) => {
      'worklet';
      const newHeight = savedHeight.value + event.translationY;
      calendarHeight.value = Math.max(
        compactHeightSV.value,
        Math.min(expandedHeightSV.value, newHeight)
      );
    })
    .onEnd((event) => {
      'worklet';
      const currentHeight = calendarHeight.value;
      const compact = compactHeightSV.value;
      const expanded = expandedHeightSV.value;

      let targetHeight = compact;

      if (event.velocityY > 500) {
        targetHeight = expanded;
      } else if (event.velocityY < -500) {
        targetHeight = compact;
      } else {
        const dCompact = Math.abs(currentHeight - compact);
        const dExpanded = Math.abs(currentHeight - expanded);
        targetHeight = dExpanded < dCompact ? expanded : compact;
      }

      calendarHeight.value = withSpring(targetHeight, {
        damping: 20,
        stiffness: 90,
      });

      const newState: SnapState =
        targetHeight === compact ? 'compact' : 'expanded';
      runOnJS(setSnapState)(newState);
    });

  const animatedCalendarStyle = useAnimatedStyle(() => ({
    height: calendarHeight.value,
  }));

  // === View mode persistence ===
  const loadViewMode = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@calendar_view_mode');
      if (saved === 'timeline' || saved === 'monthly') {
        setViewMode(saved);
        Animated.timing(slideAnim, {
          toValue: saved === 'timeline' ? 1 : 0,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    } catch (_error) {
      // Silently handle storage read failure
    }
  }, [slideAnim]);

  useEffect(() => {
    loadViewMode();
  }, [loadViewMode]);

  const saveViewMode = async (mode: 'timeline' | 'monthly'): Promise<void> => {
    try {
      await AsyncStorage.setItem('@calendar_view_mode', mode);
    } catch (_error) {
      // Silently handle storage write failure
    }
  };

  const handleViewModeChange = (mode: 'timeline' | 'monthly'): void => {
    setViewMode(mode);
    saveViewMode(mode);

    Animated.spring(slideAnim, {
      toValue: mode === 'timeline' ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();
  };

  const headerMonth =
    viewMode === 'monthly'
      ? `${HEBREW_MONTHS[displayMonth]} ${displayYear}`
      : `${HEBREW_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  const goToPrevMonth = useCallback((): void => {
    setDisplayMonth((m) => {
      if (m === 0) {
        setDisplayYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
    setSelectedDay(null);
  }, []);

  const goToNextMonth = useCallback((): void => {
    setDisplayMonth((m) => {
      if (m === 11) {
        setDisplayYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
    setSelectedDay(null);
  }, []);

  const goToToday = useCallback((): void => {
    const now = new Date();
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth());
    setSelectedDay(now.getDate());
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {/* Top Row: Profile + Title + Bell */}
          <View style={styles.headerTop}>
            {/* Profile Picture */}
            <View style={styles.profileContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.profileImage}
                accessibilityLabel="תמונת פרופיל"
              />
            </View>

            {/* Month Title with optional navigation */}
            <View style={styles.monthNavRow}>
              {viewMode === 'monthly' ? (
                <>
                  <Pressable
                    onPress={goToNextMonth}
                    hitSlop={12}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="חודש הבא"
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={28}
                      color="#647b87"
                    />
                  </Pressable>
                  <Pressable
                    onPress={goToToday}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`לחץ לחזור להיום, ${headerMonth}`}
                  >
                    <Text style={styles.monthYear}>{headerMonth}</Text>
                  </Pressable>
                  <Pressable
                    onPress={goToPrevMonth}
                    hitSlop={12}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="חודש קודם"
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={28}
                      color="#647b87"
                    />
                  </Pressable>
                </>
              ) : (
                <Text style={styles.monthYear}>{headerMonth}</Text>
              )}
            </View>

            {/* Bell Button */}
            <Pressable
              style={styles.bellButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="התראות"
            >
              <MaterialIcons name="notifications" size={24} color="#111517" />
            </Pressable>
          </View>

          {/* View Toggle */}
          <View style={styles.segmentedControl}>
            <Animated.View
              style={[
                styles.segmentedSlider,
                {
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 160],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Pressable
              style={styles.segmentButton}
              onPress={() => handleViewModeChange('monthly')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="תצוגה חודשית"
            >
              <Text
                style={[
                  styles.segmentText,
                  viewMode === 'monthly' && styles.segmentTextActive,
                ]}
              >
                חודשי
              </Text>
            </Pressable>
            <Pressable
              style={styles.segmentButton}
              onPress={() => handleViewModeChange('timeline')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="תצוגת ציר זמן"
            >
              <Text
                style={[
                  styles.segmentText,
                  viewMode === 'timeline' && styles.segmentTextActive,
                ]}
              >
                ציר זמן
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {viewMode === 'timeline' ? (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <TimelineView data={MOCK_TIMELINE_DATA} />
          </ScrollView>
        ) : (
          <View style={styles.content}>
            {/* Animated Calendar Panel - GestureDetector wraps entire area */}
            <GestureDetector gesture={panGesture}>
              <ReAnimated.View
                style={[styles.calendarPanel, animatedCalendarStyle]}
              >
                <MonthlyGrid
                  year={displayYear}
                  month={displayMonth}
                  selectedDay={selectedDay}
                  isExpanded={isExpanded}
                  onSelectDay={setSelectedDay}
                />
                {/* Drag Handle (visual indicator) */}
                <View style={styles.dragHandleContainer}>
                  <View style={styles.dragHandleBar} />
                </View>
              </ReAnimated.View>
            </GestureDetector>

            {/* Daily Events List */}
            <ScrollView
              style={styles.dailyEventsScroll}
              showsVerticalScrollIndicator={false}
            >
              {!isExpanded && visibleDay != null && visibleDayData != null && (
                <DayEventsList
                  dayData={visibleDayData}
                  year={displayYear}
                  month={displayMonth}
                  anim={listAnim}
                  onClose={() => setSelectedDay(null)}
                />
              )}
            </ScrollView>
          </View>
        )}

        {/* FAB */}
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(authenticated)/event/new' as never)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוספת אירוע חדש"
        >
          <MaterialIcons name="add" size={32} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ===== Monthly Grid =====
interface MonthlyGridProps {
  year: number;
  month: number;
  selectedDay: number | null;
  isExpanded: boolean;
  onSelectDay: (day: number | null) => void;
}

function MonthlyGrid({
  year,
  month,
  selectedDay,
  isExpanded,
  onSelectDay,
}: MonthlyGridProps): React.JSX.Element {
  const grid = useMemo(() => generateCalendarGrid(year, month), [year, month]);

  return (
    <View style={mStyles.gridContainer}>
      {/* Day Name Headers */}
      <View style={[mStyles.weekRow, { flexDirection: rtl.flexDirection }]}>
        {HEBREW_DAY_NAMES.map((name, i) => (
          <View key={name} style={mStyles.dayHeaderCell}>
            <Text
              style={[
                mStyles.dayHeaderText,
                i === 6 && mStyles.shabbatHeaderText,
              ]}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Rows */}
      {grid.map((week) => {
        const weekKey = week
          .map((d) => `${d.isCurrentMonth ? 'c' : 'o'}${d.day}`)
          .join('-');
        return (
          <View
            key={weekKey}
            style={[mStyles.weekRow, { flexDirection: rtl.flexDirection }]}
          >
            {week.map((dayData) => (
              <DayCell
                key={`${dayData.isCurrentMonth ? 'c' : 'o'}-${dayData.day}`}
                dayData={dayData}
                isSelected={
                  selectedDay === dayData.day && dayData.isCurrentMonth
                }
                isExpanded={isExpanded}
                onPress={() => {
                  if (dayData.isCurrentMonth) {
                    onSelectDay(
                      selectedDay === dayData.day ? null : dayData.day
                    );
                  }
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ===== Day Cell =====
interface DayCellProps {
  dayData: CalendarDay;
  isSelected: boolean;
  isExpanded: boolean;
  onPress: () => void;
}

function DayCell({
  dayData,
  isSelected,
  isExpanded,
  onPress,
}: DayCellProps): React.JSX.Element {
  const { findBirthdayByName, openBirthdayCard } = useBirthdaySheets();

  const uniqueColors = useMemo(() => {
    const all = dayData.events.flatMap((e) => e.assigneeColors);
    return [...new Set(all)].slice(0, 4);
  }, [dayData.events]);

  const handleBirthdayPress = useCallback((): void => {
    if (dayData.birthday == null) return;
    const found = findBirthdayByName(dayData.birthday.name);
    if (found) openBirthdayCard(found);
  }, [dayData.birthday, findBirthdayByName, openBirthdayCard]);

  return (
    <Pressable
      style={[
        mStyles.dayCell,
        isExpanded && mStyles.dayCellExpanded,
        !dayData.isCurrentMonth && mStyles.dayCellOtherMonth,
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`יום ${dayData.day}${dayData.birthday ? `, יום הולדת ${dayData.birthday.name}` : ''}${dayData.events.length > 0 ? `, ${dayData.events.length} אירועים` : ''}`}
      accessibilityHint={
        isExpanded ? 'לחץ לבחירת יום' : 'לחץ לצפייה באירועי היום'
      }
    >
      {/* Day Number */}
      <View
        style={[
          isExpanded ? mStyles.dayNumWrapperSmall : mStyles.dayNumWrapper,
          dayData.isToday && !isSelected && mStyles.dayNumTodayBg,
          isSelected && mStyles.dayNumSelectedBg,
        ]}
      >
        <Text
          style={[
            isExpanded ? mStyles.dayNumTextSmall : mStyles.dayNumText,
            !dayData.isCurrentMonth && mStyles.dayNumOtherMonth,
            dayData.isToday && !isSelected && mStyles.dayNumTodayText,
            isSelected && mStyles.dayNumSelectedText,
          ]}
        >
          {dayData.day}
        </Text>
      </View>

      {/* === Compact Mode === */}
      {!isExpanded && (
        <>
          {/* Birthday Icon */}
          {dayData.birthday != null && (
            <Pressable
              onPress={handleBirthdayPress}
              hitSlop={6}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
              accessibilityHint="לחץ לצפייה בימי הולדת"
            >
              <Text style={mStyles.birthdayEmoji}>🎂</Text>
            </Pressable>
          )}

          {/* Event Dots */}
          {uniqueColors.length > 0 && (
            <View style={mStyles.dotsRow}>
              {uniqueColors.map((color) => (
                <View
                  key={color}
                  style={[mStyles.dot, { backgroundColor: color }]}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* === Expanded Mode === */}
      {isExpanded && dayData.isCurrentMonth && (
        <View style={mStyles.expandedEvents}>
          {/* Birthday */}
          {dayData.birthday != null && (
            <Pressable
              onPress={handleBirthdayPress}
              style={mStyles.expandedBirthdayRow}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
            >
              <Text style={mStyles.expandedBirthdayText}>
                🎂 {dayData.birthday.name}
              </Text>
            </Pressable>
          )}

          {/* Events - full titles, no time */}
          {dayData.events.slice(0, 2).map((event) => (
            <Text
              key={event.id}
              style={[
                mStyles.expandedEventTitle,
                { backgroundColor: `${event.categoryColor}20` },
              ]}
              numberOfLines={2}
            >
              {event.title}
            </Text>
          ))}

          {/* More indicator */}
          {dayData.events.length > 2 && (
            <Text style={mStyles.expandedMoreText}>
              +{dayData.events.length - 2}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ===== Day Events List =====
interface DayEventsListProps {
  dayData: CalendarDay;
  year: number;
  month: number;
  anim: Animated.Value;
  onClose: () => void;
}

function DayEventsList({
  dayData,
  year,
  month,
  anim,
  onClose,
}: DayEventsListProps): React.JSX.Element {
  const router = useRouter();
  const { findBirthdayByName, openBirthdayCard } = useBirthdaySheets();

  const dayLabel = useMemo((): string => {
    const date = new Date(year, month, dayData.day);
    const weekday = HEBREW_WEEKDAYS_FULL[date.getDay()];
    const monthName = HEBREW_MONTHS[month];
    if (dayData.isToday) {
      return `היום, ${dayData.day} ב${monthName}`;
    }
    return `${weekday}, ${dayData.day} ב${monthName}`;
  }, [dayData.day, dayData.isToday, year, month]);

  const hasContent = dayData.events.length > 0 || dayData.birthday != null;

  return (
    <Animated.View
      style={[
        dStyles.wrapper,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Header */}
      <View style={dStyles.header}>
        <Pressable
          style={dStyles.addBtn}
          onPress={() => router.push('/(authenticated)/event/new' as never)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף אירוע חדש"
        >
          <Text style={dStyles.addBtnText}>+ הוסף אירוע</Text>
        </Pressable>
        <Text style={dStyles.headerTitle}>{dayLabel}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={dStyles.closeBtn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="סגור רשימת אירועים"
        >
          <MaterialIcons name="close" size={20} color="#647b87" />
        </Pressable>
      </View>

      {/* Birthday Card */}
      {dayData.birthday != null && (
        <Pressable
          style={dStyles.birthdayCard}
          onPress={() => {
            const found = findBirthdayByName(dayData.birthday?.name ?? '');
            if (found) openBirthdayCard(found);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
        >
          <Text style={dStyles.birthdayEmoji}>🎂</Text>
          <View style={dStyles.birthdayContent}>
            <Text style={dStyles.birthdayTitle}>
              יום הולדת: {dayData.birthday.name}
            </Text>
            {dayData.birthday.age != null && (
              <Text style={dStyles.birthdayAge}>
                {dayData.birthday.age} שנים
              </Text>
            )}
          </View>
          <MaterialIcons name="chevron-left" size={20} color="#e64980" />
        </Pressable>
      )}

      {/* Event Cards */}
      {dayData.events.map((event) => {
        const duration = calculateDuration(event);
        const iconName = getCategoryIcon(event.category);
        return (
          <Pressable
            key={event.id}
            style={dStyles.card}
            onPress={() =>
              router.push(`/(authenticated)/event/${event.id}` as never)
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${event.time}, ${duration} דקות`}
          >
            {/* Time */}
            <View style={dStyles.timeCol}>
              <Text style={dStyles.timeText}>{event.time}</Text>
              <Text style={dStyles.durationText}>{duration} דק׳</Text>
            </View>

            {/* Divider */}
            <View
              style={[
                dStyles.divider,
                { backgroundColor: `${event.categoryColor}50` },
              ]}
            />

            {/* Content */}
            <View style={dStyles.content}>
              <Text style={dStyles.eventTitle}>{event.title}</Text>
              {event.location != null && event.location !== '' && (
                <View style={dStyles.locationRow}>
                  <View style={dStyles.locationDot} />
                  <Text style={dStyles.locationText}>{event.location}</Text>
                </View>
              )}
              {event.assigneeColors.length > 0 && (
                <View style={dStyles.assigneeDots}>
                  {event.assigneeColors.slice(0, 4).map((color) => (
                    <View
                      key={color}
                      style={[dStyles.assigneeDot, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Icon */}
            <View
              style={[
                dStyles.iconBox,
                { backgroundColor: `${event.categoryColor}20` },
              ]}
            >
              <MaterialIcons
                name={iconName as 'event'}
                size={20}
                color={event.categoryColor}
              />
            </View>
          </Pressable>
        );
      })}

      {/* Empty State */}
      {!hasContent && (
        <View style={dStyles.emptyState}>
          <MaterialIcons name="calendar-today" size={40} color="#d1d5db" />
          <Text style={dStyles.emptyText}>אין אירועים מתוכננים ליום זה</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ===== Timeline View =====
function TimelineView({
  data,
}: {
  data: typeof MOCK_TIMELINE_DATA;
}): React.JSX.Element {
  return (
    <View style={styles.timelineContainer}>
      {data.map((dayGroup) => (
        <View key={dayGroup.dayNumber} style={styles.dayGroup}>
          {/* Day Header */}
          <View style={styles.dayHeader}>
            <View
              style={[
                styles.dayNumberCircle,
                dayGroup.isToday && styles.dayNumberCircleToday,
              ]}
            >
              <Text
                style={[
                  styles.dayNumberText,
                  dayGroup.isToday && styles.dayNumberTextToday,
                ]}
              >
                {dayGroup.dayNumber}
              </Text>
            </View>
            <Text
              style={[
                styles.dayLabel,
                dayGroup.isToday && styles.dayLabelToday,
              ]}
            >
              {dayGroup.dayLabel}
            </Text>
            <View style={styles.dayDivider} />
          </View>

          {/* Vertical Timeline Line */}
          <View style={styles.timelineLineWrapper}>
            <View style={styles.timelineVerticalLine} />

            {/* Events */}
            <View style={styles.eventsWrapper}>
              {dayGroup.events.map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  {/* Color Dot */}
                  <View
                    style={[
                      styles.eventDot,
                      { borderColor: event.categoryColor },
                      event.cancelled && styles.eventDotCancelled,
                    ]}
                  />

                  {/* Event Card */}
                  <Pressable
                    style={[
                      styles.eventCard,
                      event.cancelled && styles.eventCardCancelled,
                    ]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.title}, ${event.time}`}
                  >
                    <View style={styles.eventCardHeader}>
                      {/* Category Tag */}
                      <View
                        style={[
                          styles.categoryTag,
                          {
                            backgroundColor: `${event.categoryColor}20`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryTagText,
                            {
                              color: event.cancelled
                                ? '#9ca3af'
                                : event.categoryColor,
                            },
                          ]}
                        >
                          {event.category}
                        </Text>
                      </View>

                      {/* Time Chip */}
                      <View style={styles.timeChip}>
                        <Text
                          style={[
                            styles.timeChipText,
                            event.cancelled && styles.timeChipTextCancelled,
                          ]}
                        >
                          {event.time}
                        </Text>
                      </View>
                    </View>

                    {/* Event Title */}
                    <Text
                      style={[
                        styles.eventTitle,
                        event.cancelled && styles.eventTitleCancelled,
                      ]}
                    >
                      {event.title}
                    </Text>

                    {/* Location */}
                    {event.location !== '' && (
                      <View style={styles.locationRow}>
                        <MaterialIcons
                          name={event.icon as 'location-on'}
                          size={16}
                          color="#647b87"
                        />
                        <Text style={styles.locationText}>
                          {event.location}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}

      {/* End indicator */}
      <View style={styles.endIndicator}>
        <MaterialIcons name="history" size={30} color="#d1d5db" />
        <Text style={styles.endText}>סוף ההיסטוריה המוצגת</Text>
      </View>
    </View>
  );
}

// ===== General Styles =====
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },

  /* Header */
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileContainer: {
    width: 40,
    height: 40,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  monthNavRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  /* Segmented Control */
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    height: 40,
  },
  segmentedSlider: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 157,
    height: 32,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#647b87',
  },
  segmentTextActive: {
    color: PRIMARY_BLUE,
    fontWeight: '700',
  },

  /* Content */
  content: {
    flex: 1,
  },

  /* Timeline */
  timelineContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  dayGroup: {
    marginBottom: 32,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dayNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberCircleToday: {
    backgroundColor: `${PRIMARY_BLUE}20`,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#647b87',
  },
  dayNumberTextToday: {
    color: PRIMARY_BLUE,
  },
  dayLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#647b87',
  },
  dayLabelToday: {
    color: '#111517',
  },
  dayDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },

  /* Timeline Line */
  timelineLineWrapper: {
    position: 'relative',
    paddingRight: 40,
  },
  timelineVerticalLine: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  eventsWrapper: {
    gap: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventDot: {
    position: 'absolute',
    right: -31,
    top: 24,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  eventDotCancelled: {
    borderColor: '#9ca3af',
  },

  /* Event Card */
  eventCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  eventCardCancelled: {
    opacity: 0.6,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeChip: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111517',
  },
  timeChipTextCancelled: {
    color: '#647b87',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    marginBottom: 8,
    textAlign: 'right',
  },
  eventTitleCancelled: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#9ca3af',
    color: '#9ca3af',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#647b87',
  },

  /* End Indicator */
  endIndicator: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  endText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },

  /* Calendar Panel (monthly view) */
  calendarPanel: {
    backgroundColor: BG_COLOR,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  dailyEventsScroll: {
    flex: 1,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_BLUE,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100,
  },
});

// ===== Monthly View Styles =====
const mStyles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  weekRow: {
    gap: 4,
    marginBottom: 4,
  },

  /* Day Header */
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  shabbatHeaderText: {
    color: PRIMARY_BLUE,
  },

  /* Day Cell */
  dayCell: {
    flex: 1,
    height: COMPACT_CELL_HEIGHT,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dayCellExpanded: {
    height: EXPANDED_CELL_HEIGHT,
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  dayCellOtherMonth: {
    backgroundColor: '#fafafa',
    shadowOpacity: 0,
    elevation: 0,
  },

  /* Day Number */
  dayNumWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumWrapperSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumTodayBg: {
    backgroundColor: `${PRIMARY_BLUE}15`,
  },
  dayNumSelectedBg: {
    backgroundColor: PRIMARY_BLUE,
  },
  dayNumText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  dayNumTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
  },
  dayNumOtherMonth: {
    color: '#d1d5db',
  },
  dayNumTodayText: {
    color: PRIMARY_BLUE,
    fontWeight: '700',
  },
  dayNumSelectedText: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Birthday */
  birthdayEmoji: {
    fontSize: 10,
    lineHeight: 14,
  },

  /* Dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* Expanded Cell Content */
  expandedEvents: {
    flex: 1,
    gap: 2,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  expandedBirthdayRow: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  expandedBirthdayText: {
    fontSize: 9,
    color: '#be185d',
    fontWeight: '600',
    textAlign: 'right',
  },
  expandedEventTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    textAlign: 'right',
    overflow: 'hidden',
  },
  expandedMoreText: {
    fontSize: 8,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
  },
});

// ===== Day Events List Styles =====
const dStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    flex: 1,
    textAlign: 'right',
    marginHorizontal: 12,
  },
  addBtn: {
    backgroundColor: `${PRIMARY_BLUE}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_BLUE,
  },
  closeBtn: {
    padding: 4,
  },

  /* Birthday Card */
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fce7f3',
    marginBottom: 12,
  },
  birthdayEmoji: {
    fontSize: 28,
  },
  birthdayContent: {
    flex: 1,
  },
  birthdayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#be185d',
    textAlign: 'right',
  },
  birthdayAge: {
    fontSize: 13,
    color: '#9d174d',
    marginTop: 2,
    textAlign: 'right',
  },

  /* Event Card - Stitch Design */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeCol: {
    alignItems: 'center',
    minWidth: 52,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111517',
  },
  durationText: {
    fontSize: 11,
    color: '#647b87',
    marginTop: 3,
  },
  divider: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  locationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#647b87',
  },
  locationText: {
    fontSize: 13,
    color: '#647b87',
  },
  assigneeDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  assigneeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty State */
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
