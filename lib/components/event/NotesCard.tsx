import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { rtl } from '@/lib/rtl';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

interface NotesCardProps {
  notes?: string;
  onChange: (notes: string) => void;
}

export function NotesCard({
  notes,
  onChange,
}: NotesCardProps): React.JSX.Element {
  const [visible, setVisible] = useState(notes != null && notes !== '');

  if (!visible) {
    return (
      <Pressable
        style={s.emptyCard}
        onPress={() => setVisible(true)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="הוסף הערה"
      >
        <MaterialIcons name="add" size={20} color="#94a3b8" />
        <Text style={s.emptyText}>הוסף הערה</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        {/* Label is first child = physical RIGHT in RTL */}
        <Text style={s.label}>הערות</Text>
        {/* Icon circle is last child = physical LEFT in RTL */}
        <View style={s.iconCircle}>
          <MaterialIcons name="description" size={20} color={PRIMARY} />
        </View>
      </View>
      <TextInput
        style={s.notesInput}
        value={notes}
        onChangeText={onChange}
        placeholder="הוסף הערה, תיאור האירוע, קישור או מידע חשוב"
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={3}
        textAlign={rtl.inputTextAlign}
      />
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
    gap: 10,
  },
  emptyCard: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyText: { fontSize: 15, color: '#94a3b8', textAlign: rtl.textAlign },
  headerRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: rtl.textAlign,
  },
  notesInput: {
    fontSize: 15,
    color: '#0f172a',
    textAlign: rtl.inputTextAlign,
    minHeight: 60,
    lineHeight: 22,
  },
});
