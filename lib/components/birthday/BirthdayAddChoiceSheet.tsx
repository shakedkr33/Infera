import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_IS_RTL, rtl } from '@/lib/rtl';

const ANDROID_MATCH_IOS_LAYOUT = Platform.OS === 'android' && APP_IS_RTL;

const PRIMARY = '#36a9e2';

interface BirthdayAddChoiceSheetProps {
  visible: boolean;
  onClose: () => void;
  onManual: () => void;
  onFromContacts: () => void;
  /** iOS-only: called after the sheet's dismiss animation fully completes. */
  onDismiss?: () => void;
}

export function BirthdayAddChoiceSheet({
  visible,
  onClose,
  onManual,
  onFromContacts,
  onDismiss,
}: BirthdayAddChoiceSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }, ANDROID_MATCH_IOS_LAYOUT && { direction: 'rtl' }]}>
          {/* Drag handle */}
          <View style={s.handleContainer}>
            <View style={s.handle} />
          </View>

          <Text style={s.title}>הוספת יום הולדת</Text>

          {/* Option 1: from contacts */}
          <Pressable
            style={s.optionRow}
            onPress={onFromContacts}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="בחירה מאנשי קשר"
            accessibilityHint="בחירה מתוך אנשי הקשר שלך"
          >
            <View style={[s.optionIcon, { backgroundColor: `${PRIMARY}18` }]}>
              <MaterialIcons name="contact-page" size={26} color={PRIMARY} />
            </View>
            <View style={s.optionTexts}>
              <Text style={s.optionTitle}>בחירה מאנשי קשר</Text>
              <Text style={s.optionSub}>ייבוא שם מתוך אנשי הקשר שלך.</Text>
            </View>
          </Pressable>

          {/* Option 2: manual entry */}
          <Pressable
            style={s.optionRow}
            onPress={onManual}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="הוספה ידנית"
            accessibilityHint="הוספה באמצעות הזנת שם ופרטים"
          >
            <View style={[s.optionIcon, { backgroundColor: `${PRIMARY}18` }]}>
              <MaterialIcons name="person-add" size={26} color={PRIMARY} />
            </View>
            <View style={s.optionTexts}>
              <Text style={s.optionTitle}>הוספה ידנית</Text>
              <Text style={s.optionSub}>הוספה באמצעות הזנת שם ופרטים.</Text>
            </View>
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
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: rtl.textAlign,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f6f7f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    minHeight: 44,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: rtl.textAlign,
  },
  optionSub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: rtl.textAlign,
    marginTop: 2,
  },
});
