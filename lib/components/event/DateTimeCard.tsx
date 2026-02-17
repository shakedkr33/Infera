import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const PRIMARY = '#30c9e8';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = [
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

interface DateTimeCardProps {
  date: number;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  onChange: (updates: {
    date?: number;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
  }) => void;
}

export function DateTimeCard({
  date,
  startTime,
  endTime,
  isAllDay,
  onChange,
}: DateTimeCardProps): React.JSX.Element {
  const d = new Date(date);
  const dayName = DAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];

  return (
    <View style={s.card}>
      <Pressable
        style={s.row}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`תאריך: יום ${dayName}, ${day} ב${month}`}
      >
        <View style={[s.iconCircle, { backgroundColor: `${PRIMARY}15` }]}>
          <MaterialIcons name="calendar-month" size={24} color={PRIMARY} />
        </View>
        <View style={s.content}>
          <Text style={[s.label, { color: PRIMARY }]}>תאריך ושעה</Text>
          <Text style={s.mainText}>
            יום {dayName}, {day} ב{month}
          </Text>
          {!isAllDay && startTime != null && (
            <Text style={s.subText}>
              {startTime}
              {endTime != null ? ` - ${endTime}` : ''}
            </Text>
          )}
        </View>
      </Pressable>

      <View style={s.divider} />

      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>יום שלם</Text>
        <Switch
          value={isAllDay}
          onValueChange={(v) => onChange({ isAllDay: v })}
          trackColor={{ true: PRIMARY, false: '#e2e8f0' }}
          thumbColor="#fff"
          accessible={true}
          accessibilityLabel="יום שלם"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mainText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'right',
  },
  subText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
});
