import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { EventDetailsBottomSheet } from '@/components/EventDetailsBottomSheet';
import { TaskDetailsBottomSheet } from '@/components/tasks/TaskDetailsBottomSheet';
import { UpgradeModal } from '@/components/UpgradeModal';
import { api } from '@/convex/_generated/api';
import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import type { Birthday } from '@/lib/types/birthday';
import {
  formatBirthdayDate,
  getAge,
  getCountdownLabel,
} from '@/lib/utils/birthday';
import type { BirthdayTaskOptionType } from './BirthdayTaskOptionsSheet';
import { BirthdayTaskOptionsSheet } from './BirthdayTaskOptionsSheet';
import { BottomSheet } from './BottomSheet';

function formatEventDate(startTime: number): string {
  return new Date(startTime).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

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
  const { isExpiredFree } = useEffectiveAccess();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedRelatedEventId, setSelectedRelatedEventId] = useState<
    string | null
  >(null);
  const [selectedRelatedTaskId, setSelectedRelatedTaskId] = useState<
    string | null
  >(null);

  const relatedTasks = useQuery(
    api.tasks.listByRelatedBirthday,
    birthday ? { birthdayId: birthday.id } : 'skip'
  );

  const relatedEvents = useQuery(
    api.events.listByRelatedBirthday,
    birthday ? { birthdayId: birthday.id } : 'skip'
  );

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
    if (isExpiredFree) {
      setUpgradeModalVisible(true);
      return;
    }
    onClose();
    router.push({
      pathname: '/(authenticated)/event/new',
      params: {
        prefillTitle: `יום הולדת ל${birthday.name}`,
        relatedBirthdayId: birthday.id,
        relatedBirthdayName: birthday.name,
        returnTo: '/(authenticated)/birthdays',
      },
    } as never);
  };

  const handleCreateTask = (): void => {
    if (isExpiredFree) {
      setUpgradeModalVisible(true);
      return;
    }
    setOptionsVisible(true);
  };

  const handleTaskOptionSelected = (option: BirthdayTaskOptionType): void => {
    setOptionsVisible(false);

    let prefillTitle: string;
    if (option === 'buy_gift') {
      prefillTitle = `לקנות מתנה ל${birthday.name}`;
    } else if (option === 'call') {
      prefillTitle = `להתקשר לברך את ${birthday.name}`;
    } else {
      prefillTitle = '';
    }

    onClose();
    router.push({
      pathname: '/(authenticated)/task/new',
      params: {
        prefillTitle,
        relatedBirthdayId: birthday.id,
        relatedBirthdayName: birthday.name,
        returnTo: '/(authenticated)/birthdays',
      },
    } as never);
  };

  const hasRelatedTasks = relatedTasks && relatedTasks.length > 0;
  const hasRelatedEvents = relatedEvents && relatedEvents.length > 0;
  const extraHeight =
    (hasRelatedTasks ? 1 : 0) * 100 + (hasRelatedEvents ? 1 : 0) * 100;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight={560 + extraHeight}
    >
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

      {/* Related tasks */}
      {hasRelatedTasks ? (
        <View style={s.relatedSection}>
          <Text style={s.relatedTitle}>משימות קשורות</Text>
          {relatedTasks.map((task) => (
            <Pressable
              key={task._id as string}
              style={s.relatedTaskRow}
              onPress={() => setSelectedRelatedTaskId(task._id as string)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`פתח משימה: ${task.title}`}
            >
              <MaterialIcons name="chevron-left" size={16} color="#94a3b8" />
              <Text style={s.relatedTaskTitle} numberOfLines={1}>
                {task.title}
              </Text>
              <View
                style={[
                  s.relatedTaskStatus,
                  { backgroundColor: task.completed ? '#dcfce7' : '#fef3c7' },
                ]}
              >
                <Text
                  style={[
                    s.relatedTaskStatusText,
                    { color: task.completed ? '#16a34a' : '#d97706' },
                  ]}
                >
                  {task.completed ? 'הושלמה' : 'פתוחה'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Related events */}
      {hasRelatedEvents ? (
        <View style={s.relatedSection}>
          <Text style={s.relatedTitle}>אירועים קשורים</Text>
          {relatedEvents.map((ev) => (
            <Pressable
              key={ev._id as string}
              style={s.relatedEventRow}
              onPress={() => setSelectedRelatedEventId(ev._id as string)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`פתח אירוע: ${ev.title}`}
            >
              <MaterialIcons name="chevron-left" size={16} color="#94a3b8" />
              <View style={s.relatedEventInfo}>
                <Text style={s.relatedEventTitle} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={s.relatedEventDate}>
                  {formatEventDate(ev.startTime)}
                </Text>
              </View>
              <MaterialIcons
                name="event"
                size={16}
                color={PRIMARY}
                style={s.relatedEventIcon}
              />
            </Pressable>
          ))}
        </View>
      ) : null}

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

      {/* Task options sheet — rendered inside this Modal so it layers correctly on iOS */}
      <BirthdayTaskOptionsSheet
        visible={optionsVisible}
        birthdayName={birthday.name}
        onClose={() => setOptionsVisible(false)}
        onSelect={handleTaskOptionSelected}
      />

      {/* Upgrade prompt for gated actions (add event / add task) */}
      <UpgradeModal
        visible={upgradeModalVisible}
        reason="personal"
        onClose={() => setUpgradeModalVisible(false)}
      />

      {/* Related event details sheet — rendered inside this Modal so it layers correctly on iOS */}
      <EventDetailsBottomSheet
        eventId={selectedRelatedEventId}
        visible={selectedRelatedEventId !== null}
        onClose={() => setSelectedRelatedEventId(null)}
        onNavigate={() => {}}
      />

      {/* Related task details sheet — rendered inside this Modal so it layers correctly on iOS */}
      <TaskDetailsBottomSheet
        taskId={selectedRelatedTaskId}
        visible={selectedRelatedTaskId !== null}
        onClose={() => setSelectedRelatedTaskId(null)}
      />
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
  relatedSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'right',
    marginBottom: 8,
  },
  relatedTaskRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  relatedTaskStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relatedTaskStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  relatedTaskTitle: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    textAlign: 'right',
  },
  relatedEventRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  relatedEventIcon: {
    marginLeft: 2,
  },
  relatedEventInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  relatedEventTitle: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    textAlign: 'right',
  },
  relatedEventDate: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 1,
  },
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
