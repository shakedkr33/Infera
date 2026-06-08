import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Birthday } from '@/lib/types/birthday';
import {
  formatBirthdayDate,
  getAge,
  getCountdownLabel,
} from '@/lib/utils/birthday';
import { BottomSheet } from './BottomSheet';

const PRIMARY = '#36a9e2';

interface BirthdayCardSheetProps {
  birthday: Birthday | null;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BirthdayCardSheet({
  birthday,
  visible,
  onClose,
  onEdit,
  onDelete,
}: BirthdayCardSheetProps): React.JSX.Element | null {
  if (!birthday) return null;

  const age = getAge(birthday);
  const countdown = getCountdownLabel(birthday);

  const handleDelete = (): void => {
    Alert.alert('מחיקה', 'האם למחוק את יום ההולדת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: onDelete,
      },
    ]);
  };

  const handleCreateEvent = (): void => {
    onClose();
    router.push({
      pathname: '/(authenticated)/event/new',
      params: { prefillTitle: `יום הולדת ${birthday.name}` },
    } as never);
  };

  const handleCreateTask = (): void => {
    onClose();
    router.push({
      pathname: '/(authenticated)/task/new',
      params: { prefillTitle: `הכנות ליום הולדת ${birthday.name}` },
    } as never);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={560}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>יום הולדת 🎂</Text>
        <Pressable
          onPress={onClose}
          style={s.closeBtn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="סגור"
        >
          <MaterialIcons name="close" size={24} color="#64748b" />
        </Pressable>
      </View>

      {/* Profile */}
      <View style={s.profile}>
        {birthday.photoUri ? (
          <Image source={{ uri: birthday.photoUri }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.initials}>{birthday.name.substring(0, 2)}</Text>
          </View>
        )}
        <Text style={s.name}>{birthday.name}</Text>
        <Text style={s.date}>{formatBirthdayDate(birthday)}</Text>
        {age != null && <Text style={s.age}>גיל {age}</Text>}
        <View style={s.badge}>
          <Text style={s.badgeText}>{countdown}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <Pressable
          style={s.action}
          onPress={onEdit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="עריכה"
        >
          <View style={s.actionIcon}>
            <MaterialIcons name="edit" size={24} color={PRIMARY} />
          </View>
          <Text style={s.actionText}>עריכה</Text>
        </Pressable>

        <Pressable
          style={s.action}
          onPress={handleCreateEvent}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="יצירת אירוע"
        >
          <View style={s.actionIcon}>
            <MaterialIcons name="calendar-month" size={24} color={PRIMARY} />
          </View>
          <Text style={s.actionText}>יצירת אירוע</Text>
        </Pressable>

        <Pressable
          style={s.action}
          onPress={handleCreateTask}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="יצירת משימה"
        >
          <View style={s.actionIcon}>
            <MaterialIcons name="add-task" size={24} color={PRIMARY} />
          </View>
          <Text style={s.actionText}>יצירת משימה</Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Pressable
          style={s.footerBtn}
          onPress={() => {
            onClose();
            router.push('/(authenticated)/birthdays' as never);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="צפייה בכל ימי ההולדת"
        >
          <Text style={s.footerBtnText}>צפייה בכל ימי ההולדת</Text>
        </Pressable>
        <Pressable
          style={s.deleteBtn}
          onPress={handleDelete}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="מחק יום הולדת"
        >
          <MaterialIcons name="delete" size={18} color="#ef4444" />
          <Text style={s.deleteBtnText}>מחק יום הולדת</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profile: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    marginBottom: 10,
  },
  initials: { fontSize: 24, fontWeight: '700', color: '#64748b' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  date: { fontSize: 15, color: '#64748b', marginBottom: 2 },
  age: { fontSize: 13, color: '#94a3b8', marginBottom: 10 },
  badge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  action: { alignItems: 'center', gap: 8 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: { fontSize: 13, fontWeight: '500', color: '#475569' },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 4 },
  footerBtn: {
    backgroundColor: '#f1f5f9',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
});
