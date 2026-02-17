import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PRIMARY = '#308ce8';

interface Assignee {
  id: string;
  name: string;
  initial: string;
  color: string;
}

interface AssigneesChipsProps {
  assignees: Assignee[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function AssigneesChips({
  assignees,
  selected,
  onChange,
}: AssigneesChipsProps): React.JSX.Element {
  const toggle = (id: string): void => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.row}>
        {assignees.map((a) => {
          const active = selected.includes(a.id);
          return (
            <Pressable
              key={a.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => toggle(a.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`אחראי: ${a.name}`}
            >
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: active
                      ? 'rgba(255,255,255,0.25)'
                      : `${a.color}20`,
                  },
                ]}
              >
                <Text
                  style={[s.avatarText, { color: active ? '#fff' : a.color }]}
                >
                  {a.initial}
                </Text>
              </View>
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {a.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={s.addBtn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף אחראי"
        >
          <MaterialIcons name="group-add" size={22} color="#9ca3af" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
