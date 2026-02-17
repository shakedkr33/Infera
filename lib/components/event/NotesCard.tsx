import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
      <View style={s.row}>
        <View style={[s.iconCircle, { backgroundColor: '#d1fae5' }]}>
          <MaterialIcons name="description" size={24} color="#059669" />
        </View>
        <View style={s.content}>
          <Text style={[s.label, { color: '#059669' }]}>הערות</Text>
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={onChange}
            placeholder="הוסף הערה, קישור, זום או מידע חשוב"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            textAlign="right"
            autoFocus
          />
        </View>
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
  emptyCard: {
    flexDirection: 'row',
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
  emptyText: { fontSize: 15, color: '#94a3b8' },
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
    marginBottom: 4,
  },
  notesInput: {
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'right',
    minHeight: 60,
    lineHeight: 22,
  },
});
