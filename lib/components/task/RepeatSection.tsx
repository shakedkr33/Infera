import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RepeatOption } from '@/lib/types/task';

const PRIMARY = '#308ce8';

const OPTIONS: { key: RepeatOption; label: string }[] = [
  { key: 'daily', label: 'כל יום' },
  { key: 'weekly', label: 'כל שבוע' },
  { key: 'specific_days', label: 'ימים מסוימים' },
];

interface RepeatSectionProps {
  value?: RepeatOption;
  onChange: (v: RepeatOption | undefined) => void;
}

export function RepeatSection({
  value,
  onChange,
}: RepeatSectionProps): React.JSX.Element {
  return (
    <View>
      <View style={s.header}>
        <MaterialIcons name="cached" size={20} color={PRIMARY} />
        <Text style={s.title}>משימה חוזרת</Text>
      </View>
      <View style={s.chips}>
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.chip, active && s.chipActive]}
              onPress={() => onChange(active ? undefined : opt.key)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`חזרה: ${opt.label}`}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: '700', color: '#111418' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: `${PRIMARY}10`, borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  chipTextActive: { color: PRIMARY, fontWeight: '700' },
});
