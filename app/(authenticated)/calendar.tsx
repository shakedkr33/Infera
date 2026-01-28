import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_BLUE = '#36a9e2';

// Mock data for events
const MOCK_EVENTS = [
  {
    id: '1',
    category: 'משפחה',
    categoryColor: '#ff6b6b',
    title: 'ארוחת צהריים עם ההורים',
    time: '13:00',
    location: 'מסעדת הדולפין',
    date: '2024-01-28',
    done: false,
  },
  {
    id: '2',
    category: 'בריאות',
    categoryColor: '#51cf66',
    title: 'תור לרופא שיניים',
    time: '10:30',
    location: 'מרכז רפואי מכבי',
    date: '2024-01-28',
    done: true,
  },
  {
    id: '3',
    category: 'עבודה',
    categoryColor: '#4dabf7',
    title: 'פגישת צוות שבועית',
    time: '15:00',
    location: 'משרד ראשי',
    date: '2024-01-29',
    done: false,
  },
];

export default function CalendarScreen() {
  const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');
  const [isExpanded, setIsExpanded] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

  const loadViewMode = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@calendar_view_mode');
      if (saved === 'timeline' || saved === 'monthly') {
        setViewMode(saved);
        // Animate toggle to saved position
        Animated.timing(slideAnim, {
          toValue: saved === 'timeline' ? 0 : 1,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    } catch (error) {
      console.error('Failed to load view mode:', error);
    }
  }, [slideAnim]);

  // Load saved view mode from AsyncStorage
  useEffect(() => {
    loadViewMode();
  }, [loadViewMode]);

  const saveViewMode = async (mode: 'timeline' | 'monthly') => {
    try {
      await AsyncStorage.setItem('@calendar_view_mode', mode);
    } catch (error) {
      console.error('Failed to save view mode:', error);
    }
  };

  const handleViewModeChange = (mode: 'timeline' | 'monthly') => {
    setViewMode(mode);
    saveViewMode(mode);

    // Animate toggle
    Animated.spring(slideAnim, {
      toValue: mode === 'timeline' ? 0 : 1,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();
  };

  const currentMonth = 'אוקטובר 2024';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.monthYear}>{currentMonth}</Text>
            <Pressable style={styles.todayButton}>
              <Text style={styles.todayButtonText}>היום</Text>
            </Pressable>
          </View>

          {/* View Toggle - Segmented Control */}
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
              onPress={() => handleViewModeChange('timeline')}
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
            <Pressable
              style={styles.segmentButton}
              onPress={() => handleViewModeChange('monthly')}
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
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {viewMode === 'timeline' ? (
            <TimelineView events={MOCK_EVENTS} />
          ) : (
            <MonthlyView
              events={MOCK_EVENTS}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ===== Timeline View Component =====
function TimelineView({ events }: { events: typeof MOCK_EVENTS }) {
  return (
    <View style={styles.timelineContainer}>
      {events.map((event, index) => (
        <View key={event.id} style={styles.timelineRow}>
          {/* Timeline dot and line */}
          <View style={styles.timelineLineContainer}>
            <View
              style={[
                styles.timelineDot,
                event.done && styles.timelineDotDone,
                { backgroundColor: event.categoryColor },
              ]}
            />
            {index < events.length - 1 && <View style={styles.timelineLine} />}
          </View>

          {/* Event card */}
          <View
            style={[styles.timelineCard, event.done && styles.timelineCardDone]}
          >
            <View style={styles.timelineCardHeader}>
              <View
                style={[
                  styles.categoryChip,
                  { backgroundColor: event.categoryColor + '20' },
                ]}
              >
                <Text
                  style={[styles.categoryText, { color: event.categoryColor }]}
                >
                  {event.category}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.eventTime}>{event.time}</Text>
                <MaterialIcons
                  name="access-time"
                  size={14}
                  color="#637588"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </View>

            <Text
              style={[styles.eventTitle, event.done && styles.eventTitleDone]}
            >
              {event.title}
            </Text>

            <View style={styles.locationRow}>
              <Text style={styles.locationText}>{event.location}</Text>
              <MaterialIcons
                name="location-on"
                size={14}
                color="#637588"
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ===== Monthly View Component =====
function MonthlyView({
  events,
  isExpanded,
  onToggleExpand,
}: {
  events: typeof MOCK_EVENTS;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  // Generate days for current month (January 2024 example)
  const daysInMonth = 31;
  const firstDayOfWeek = 1; // Monday
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Hebrew day names
  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  return (
    <View style={styles.monthlyContainer}>
      {/* Day names header */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((day) => (
          <View key={day} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => i).map((i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dayEvents = events.filter((e) => {
            const eventDay = Number.parseInt(e.date.split('-')[2]);
            return eventDay === day;
          });
          const hasBirthday = day === 15; // Mock birthday
          const isToday = day === 28;

          return (
            <Pressable
              key={day}
              style={[styles.dayCell, isToday && styles.dayCellToday]}
              onPress={onToggleExpand}
            >
              <View style={styles.dayCellContent}>
                <Text
                  style={[styles.dayNumber, isToday && styles.dayNumberToday]}
                >
                  {day}
                </Text>

                {!isExpanded && (
                  <View style={styles.dayIndicators}>
                    {/* Event dots */}
                    {dayEvents.slice(0, 3).map((event) => (
                      <View
                        key={event.id}
                        style={[
                          styles.eventDot,
                          { backgroundColor: event.categoryColor },
                        ]}
                      />
                    ))}
                    {/* Birthday indicator */}
                    {hasBirthday && <Text style={styles.birthdayIcon}>🎂</Text>}
                  </View>
                )}

                {isExpanded && dayEvents.length > 0 && (
                  <View style={styles.expandedEventsList}>
                    {dayEvents.map((event) => (
                      <View
                        key={event.id}
                        style={[
                          styles.expandedEventChip,
                          { backgroundColor: event.categoryColor },
                        ]}
                      >
                        <Text
                          style={styles.expandedEventText}
                          numberOfLines={2}
                        >
                          {event.title}
                        </Text>
                      </View>
                    ))}
                    {hasBirthday && (
                      <View
                        style={[
                          styles.expandedEventChip,
                          { backgroundColor: '#ff6b6b' },
                        ]}
                      >
                        <Text style={styles.expandedEventText}>
                          🎂 יום הולדת
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Expand/Collapse hint */}
      <View style={styles.expandHint}>
        <MaterialIcons
          name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={24}
          color="#637588"
        />
        <Text style={styles.expandHintText}>
          {isExpanded ? 'הסתר פרטים' : 'הצג פרטים'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f7f8',
    direction: 'rtl',
  },

  /* Header */
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthYear: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111418',
  },
  todayButton: {
    backgroundColor: PRIMARY_BLUE + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },

  /* Segmented Control */
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 3,
    position: 'relative',
  },
  segmentedSlider: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 157,
    height: 36,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#637588',
  },
  segmentTextActive: {
    color: PRIMARY_BLUE,
    fontWeight: '700',
  },

  /* Content */
  content: {
    flex: 1,
  },

  /* Timeline View */
  timelineContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLineContainer: {
    width: 40,
    alignItems: 'center',
    marginLeft: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineDotDone: {
    opacity: 0.4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    minHeight: 60,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineCardDone: {
    opacity: 0.5,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#637588',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111418',
    marginBottom: 8,
    textAlign: 'right',
  },
  eventTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  locationText: {
    fontSize: 13,
    color: '#637588',
    textAlign: 'right',
  },

  /* Monthly View */
  monthlyContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  dayNamesRow: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  calendarGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCell: {
    width: '13.14%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  dayCellToday: {
    borderColor: PRIMARY_BLUE,
    borderWidth: 2,
    backgroundColor: PRIMARY_BLUE + '05',
  },
  dayCellContent: {
    flex: 1,
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111418',
    marginBottom: 4,
  },
  dayNumberToday: {
    color: PRIMARY_BLUE,
    fontWeight: '800',
  },
  dayIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  birthdayIcon: {
    fontSize: 10,
  },

  /* Expanded Monthly View */
  expandedEventsList: {
    marginTop: 4,
    gap: 4,
    width: '100%',
  },
  expandedEventChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expandedEventText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  expandHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  expandHintText: {
    fontSize: 14,
    color: '#637588',
    fontWeight: '600',
  },
});
