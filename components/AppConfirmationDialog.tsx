import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { rtl } from '@/lib/rtl';

interface AppConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDestructive?: boolean;
}

export function AppConfirmationDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDestructive = false,
}: AppConfirmationDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable accessible={false} onPress={onCancel} style={styles.overlay}>
        <Pressable onPress={() => undefined} style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.divider} />
          <View style={styles.buttons}>
            <Pressable
              accessibilityLabel={confirmLabel}
              accessibilityRole="button"
              accessible={true}
              onPress={onConfirm}
              style={styles.button}
            >
              <Text
                style={[
                  styles.buttonText,
                  confirmDestructive ? styles.destructiveText : null,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
            <View style={styles.buttonDivider} />
            <Pressable
              accessibilityLabel={cancelLabel}
              accessibilityRole="button"
              accessible={true}
              onPress={onCancel}
              style={styles.button}
            >
              <Text style={[styles.buttonText, styles.cancelText]}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  box: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 6,
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  message: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
    textAlign: rtl.textAlign,
    writingDirection: 'rtl',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
  },
  buttons: {
    flexDirection: rtl.flexDirection,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  destructiveText: {
    color: '#ef4444',
  },
  cancelText: {
    color: '#36a9e2',
  },
});
