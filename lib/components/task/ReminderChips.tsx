import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReminderOption } from '@/lib/types/task';

const PRIMARY = '#308ce8';

const OPTIONS: { key: ReminderOption; label: string }[] = [
  { key: 'none', label: 'ללא' },
  { key: 'in_hour', label: 'בעוד שעה' },
  { key: 'in_two_hours', label: 'בעוד שעתיים' },
  { key: 'hour_before', label: 'שעה לפני' },
  { key: 'custom', label: 'מותאם אישית' },
];

interface ReminderChipsProps {
  value: ReminderOption;
  onChange: (v: ReminderOption) => void;
}

export function ReminderChips({
  value,
  onChange,
}: ReminderChipsProps): React.JSX.Element {
  return (
    <View style={s.wrap}>
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(opt.key)}
            accessible={true}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`תזכורת: ${opt.label}`}
          >
            {opt.key === 'custom' && (
              <MaterialIcons
                name="more-time"
                size={14}
                color={active ? PRIMARY : '#6b7280'}
              />
            )}
            <Text style={[s.chipText, active && s.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}0d`,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  chipTextActive: { color: PRIMARY, fontWeight: '700' },
});
