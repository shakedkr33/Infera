import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface RsvpBlockedByTaskDialogProps {
  visible: boolean;
  assignedTaskCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function RsvpBlockedByTaskDialog({
  visible,
  assignedTaskCount,
  onConfirm,
  onClose,
}: RsvpBlockedByTaskDialogProps): React.JSX.Element {
  const message =
    assignedTaskCount > 1
      ? 'כדי לסמן שלא תגיע/י, נבטל את ההשתבצות שלך מהמשימות באירוע.'
      : 'כדי לסמן שלא תגיע/י, נבטל את ההשתבצות שלך מהמשימה.';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="חזרה"
          accessibilityRole="button"
          accessible={true}
          onPress={onClose}
          style={styles.backdropHitArea}
        />
        <View style={styles.card}>
          <Text style={styles.title}>יש לך משימה באירוע הזה</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="בטל/י השתבצות וסמנ/י לא מגיע/ה"
              accessibilityRole="button"
              accessible={true}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                בטל/י השתבצות וסמנ/י לא מגיע/ה
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="חזרה"
              accessibilityRole="button"
              accessible={true}
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>חזרה</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 20,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  backdropHitArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  title: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'right',
  },
  message: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'right',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E6F4FB',
    borderColor: '#0284c7',
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#0369a1',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonPressed: {
    backgroundColor: '#eef2f7',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
});
