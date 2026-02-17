import { MaterialIcons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Participant } from '@/lib/types/event';

const PRIMARY = '#30c9e8';
const AVATAR_SIZE = 40;
const OVERLAP = -8;
const MAX_VISIBLE = 5;

interface ParticipantsCardProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}

export function ParticipantsCard({
  participants,
  onChange,
}: ParticipantsCardProps): React.JSX.Element {
  const visible = participants.slice(0, MAX_VISIBLE);
  const extraCount = Math.max(0, participants.length - MAX_VISIBLE);

  const handleAdd = (): void => {
    Alert.prompt(
      'הוסף משתתף',
      'הכנס שם או אימייל',
      (text) => {
        if (text == null || text.trim() === '') return;
        const colors = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf'];
        const newP: Participant = {
          id: Date.now().toString(),
          name: text.trim(),
          color: colors[participants.length % colors.length],
        };
        onChange([...participants, newP]);
      },
      'plain-text',
      '',
      'default'
    );
  };

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={[s.iconCircle, { backgroundColor: '#ede9fe' }]}>
          <MaterialIcons name="people" size={24} color="#7c3aed" />
        </View>
        <View style={s.headerContent}>
          <Text style={[s.label, { color: '#7c3aed' }]}>משתתפים</Text>
          <Text style={s.countText}>
            {participants.length > 0
              ? `${participants.length} משתתפים`
              : 'אין משתתפים'}
          </Text>
        </View>
        {participants.length > 3 && (
          <Pressable
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="הצג הכל"
          >
            <Text style={s.showAll}>הצג הכל</Text>
          </Pressable>
        )}
      </View>

      {/* Avatars Row */}
      <View style={s.avatarsRow}>
        {visible.map((p, i) => (
          <View
            key={p.id}
            style={[
              s.avatar,
              { backgroundColor: p.color, marginLeft: i > 0 ? OVERLAP : 0 },
            ]}
          >
            <Text style={s.avatarText}>{p.name.charAt(0)}</Text>
          </View>
        ))}
        {extraCount > 0 && (
          <View style={[s.avatar, s.extraBadge, { marginLeft: OVERLAP }]}>
            <Text style={s.extraText}>+{extraCount}</Text>
          </View>
        )}

        {/* Add Button */}
        <Pressable
          style={[
            s.avatar,
            s.addButton,
            { marginLeft: participants.length > 0 ? 8 : 0 },
          ]}
          onPress={handleAdd}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף משתתף"
        >
          <MaterialIcons name="add" size={20} color={PRIMARY} />
        </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  countText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'right',
  },
  showAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c3aed',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 60,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  extraBadge: {
    backgroundColor: '#e2e8f0',
  },
  extraText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  addButton: {
    backgroundColor: `${PRIMARY}10`,
    borderColor: PRIMARY,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
