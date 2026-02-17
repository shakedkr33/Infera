import { MaterialIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SubTask } from '@/lib/types/task';

const PRIMARY = '#308ce8';

interface SubtasksSectionProps {
  subtasks: SubTask[];
  allowEditing: boolean;
  onSubtasksChange: (st: SubTask[]) => void;
  onAllowEditingChange: (v: boolean) => void;
}

export function SubtasksSection({
  subtasks,
  allowEditing,
  onSubtasksChange,
  onAllowEditingChange,
}: SubtasksSectionProps): React.JSX.Element {
  const addSubtask = (): void => {
    onSubtasksChange([
      ...subtasks,
      { id: Date.now().toString(), title: '', completed: false },
    ]);
  };

  const updateSubtask = (id: string, title: string): void => {
    onSubtasksChange(
      subtasks.map((st) => (st.id === id ? { ...st, title } : st))
    );
  };

  const removeSubtask = (id: string): void => {
    onSubtasksChange(subtasks.filter((st) => st.id !== id));
  };

  return (
    <View>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.addBtn}
          onPress={addSubtask}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף תת-משימה"
        >
          <MaterialIcons name="add-circle" size={20} color={PRIMARY} />
          <Text style={s.addBtnText}>הוספה</Text>
        </Pressable>
        <View style={s.titleRow}>
          <Text style={s.title}>תתי-משימות</Text>
          <View style={s.routineBadge}>
            <MaterialIcons name="cached" size={12} color="#16a34a" />
            <Text style={s.routineText}>חוזר</Text>
          </View>
        </View>
      </View>

      {/* Toggle */}
      <View style={s.toggleRow}>
        <Switch
          value={allowEditing}
          onValueChange={onAllowEditingChange}
          trackColor={{ true: PRIMARY, false: '#e2e8f0' }}
          thumbColor="#fff"
          accessible={true}
          accessibilityLabel="אפשר עריכה של תתי-משימות למשתתפים"
        />
        <Text style={s.toggleLabel}>אפשר עריכה של תתי-משימות למשתתפים</Text>
      </View>

      {/* Subtask list */}
      {subtasks.length > 0 && (
        <View style={s.list}>
          {subtasks.map((st, idx) => (
            <View key={st.id}>
              <View style={s.subtaskRow}>
                <Pressable
                  onLongPress={() => removeSubtask(st.id)}
                  style={s.checkbox}
                  accessible={true}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: st.completed }}
                  accessibilityHint="לחיצה ארוכה למחיקה"
                  accessibilityLabel={st.title || 'תת-משימה חדשה'}
                />
                <TextInput
                  style={s.subtaskInput}
                  value={st.title}
                  onChangeText={(t) => updateSubtask(st.id, t)}
                  placeholder={
                    idx === 0
                      ? 'למשל: לארוז בגדים...'
                      : 'הוספת תת-משימה נוספת...'
                  }
                  placeholderTextColor="#9ca3af"
                  textAlign="right"
                />
              </View>
              {idx < subtasks.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, fontWeight: '700', color: '#111418' },
  routineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  routineText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
  },
  list: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    gap: 12,
  },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  subtaskInput: { flex: 1, fontSize: 13, color: '#374151' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
});
