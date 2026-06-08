import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#36a9e2';

export type BirthdayTaskOptionType = 'buy_gift' | 'call' | 'other';

interface Option {
  id: BirthdayTaskOptionType;
  label: string;
  icon: string;
}

// JSX order matches desired RTL visual order (first child appears on the right in RTL)
const OPTIONS: Option[] = [
  { id: 'buy_gift', label: 'לקנות מתנה', icon: 'card-giftcard' },
  { id: 'call', label: 'להתקשר לברך', icon: 'phone' },
  { id: 'other', label: 'אחר', icon: 'add-task' },
];

interface BirthdayTaskOptionsSheetProps {
  visible: boolean;
  birthdayName: string;
  onClose: () => void;
  onSelect: (option: BirthdayTaskOptionType) => void;
}

export function BirthdayTaskOptionsSheet({
  visible,
  birthdayName,
  onClose,
  onSelect,
}: BirthdayTaskOptionsSheetProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} accessible={false} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handleContainer}>
            <View style={s.handle} />
          </View>

          <Text style={s.title}>יצירת משימה</Text>
          <Text style={s.subtitle}>{birthdayName} 🎂</Text>

          <View style={s.actions}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [s.action, pressed && s.actionPressed]}
                onPress={() => onSelect(opt.id)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <View style={s.actionIcon}>
                  <MaterialIcons
                    name={opt.icon as never}
                    size={26}
                    color={PRIMARY}
                  />
                </View>
                <Text style={s.actionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              s.cancelBtn,
              pressed && s.cancelBtnPressed,
            ]}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="ביטול"
          >
            <Text style={s.cancelBtnText}>ביטול</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  action: {
    alignItems: 'center',
    gap: 10,
    minWidth: 80,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    maxWidth: 84,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginBottom: 4,
    minWidth: 80,
  },
  cancelBtnPressed: {
    opacity: 0.5,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
  },
});
