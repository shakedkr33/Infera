import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');

// ─── EventItem type ───────────────────────────────────────────────────────────

export interface EventItem {
  id: string;
  time: string;
  endTime?: string;       // e.g. "14:30"
  title: string;
  location?: string;
  type: 'event' | 'task';
  iconColor: string;
  completed: boolean;
  allDay?: boolean;
  pending?: boolean;
  groupName?: string;
  description?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventDetailsBottomSheetProps {
  event: EventItem | null;
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventDetailsBottomSheet({
  event,
  visible,
  onClose,
}: EventDetailsBottomSheetProps) {
  const router = useRouter();

  if (!event) return null;

  const handleEdit = () => {
    onClose();
    router.push({
      pathname: '/(authenticated)/event/[id]',
      params: { id: event.id },
    });
  };

  const timeLabel = event.allDay
    ? 'כל היום'
    : event.endTime
      ? `${event.time}–${event.endTime}`
      : event.time;

  const hasLocation = Boolean(event.location && event.location.trim().length > 0);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      {/* Semi-transparent backdrop — tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Scrollable content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Pending badge */}
          {event.pending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>ממתין לאישור</Text>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Time row */}
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={18} color="#94a3b8" />
            <Text style={styles.infoText}>{timeLabel}</Text>
          </View>

          {/* Location row */}
          {hasLocation && (
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={18} color="#94a3b8" />
              <Text style={styles.infoText}>{event.location}</Text>
            </View>
          )}

          {/* Group name — TODO: לחבר לנתוני קבוצה אמיתיים מ-Convex */}
          {event.groupName ? (
            <View style={styles.infoRow}>
              <MaterialIcons name="group" size={16} color="#94a3b8" />
              <Text style={[styles.infoText, { color: '#64748b', fontSize: 14 }]}>
                {event.groupName}
              </Text>
            </View>
          ) : null}

          {/* Description */}
          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}
        </ScrollView>

        {/* Navigate button — floated above bottom buttons, only when location exists */}
        {hasLocation && (
          <Pressable
            style={styles.navFloatBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`נווט אל ${event.location}`}
          >
            <MaterialIcons name="near-me" size={18} color="#fff" />
            <Text style={styles.navFloatBtnText}>נווט</Text>
          </Pressable>
        )}

        {/* Fixed bottom buttons */}
        <View style={styles.bottomButtons}>
          <Pressable
            style={styles.editBtn}
            onPress={handleEdit}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="עריכת אירוע"
          >
            <Text style={styles.editBtnText}>עריכה</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="סגירה"
          >
            <Text style={styles.closeBtnText}>סגירה</Text>
          </Pressable>
        </View>

        <SafeAreaView edges={['bottom']} />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.67,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Pending badge
  pendingBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },

  // Title
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 20,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    flex: 1,
  },

  // Description
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 10,
    marginTop: 4,
  },

  // Floating navigate button (bottom-left of sheet)
  navFloatBtn: {
    position: 'absolute',
    bottom: 140,
    left: 24,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#36a9e2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#36a9e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navFloatBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Bottom buttons
  bottomButtons: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  editBtn: {
    backgroundColor: '#36a9e2',
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#36a9e2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});
