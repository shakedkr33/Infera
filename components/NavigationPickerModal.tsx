import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { hasValidCoords } from '@/lib/utils/geoUri';

const googleMapsIcon = require('@/assets/images/navigation/google-maps.png');
const wazeIcon = require('@/assets/images/navigation/waze.png');

interface NavigationPickerModalProps {
  visible: boolean;
  /** Human-readable address text — used for Google Maps when no coordinates. */
  location: string | null;
  /** Decimal latitude — required for Waze and coordinate-based Google Maps. */
  latitude?: number;
  /** Decimal longitude — required for Waze and coordinate-based Google Maps. */
  longitude?: number;
  onClose: () => void;
}

export function NavigationPickerModal({
  visible,
  location,
  latitude,
  longitude,
  onClose,
}: NavigationPickerModalProps): React.JSX.Element | null {
  const hasCoords = hasValidCoords(latitude, longitude);

  const openApp = (app: 'google' | 'waze'): void => {
    let url: string;

    if (hasCoords) {
      url =
        app === 'google'
          ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
          : `waze://?ll=${latitude},${longitude}&navigate=yes`;
    } else {
      if (!location) return;
      const encoded = encodeURIComponent(location.trim());
      url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    }

    onClose();
    Linking.openURL(url).catch(() =>
      Alert.alert('שגיאה', 'לא ניתן לפתוח ניווט כרגע')
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <Text style={styles.title}>פתיחה בניווט</Text>
        <Pressable
          accessibilityLabel="פתח ב-Google Maps"
          accessibilityRole="button"
          accessible={true}
          onPress={() => openApp('google')}
          style={styles.option}
        >
          <Image
            resizeMode="contain"
            source={googleMapsIcon}
            style={styles.appIcon}
          />
          <Text style={styles.optionText}>Google Maps</Text>
        </Pressable>
        {hasCoords ? (
          <Pressable
            accessibilityLabel="פתח ב-Waze"
            accessibilityRole="button"
            accessible={true}
            onPress={() => openApp('waze')}
            style={styles.option}
          >
            <Image
              resizeMode="contain"
              source={wazeIcon}
              style={styles.appIcon}
            />
            <Text style={styles.optionText}>Waze</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="ביטול"
          accessibilityRole="button"
          accessible={true}
          onPress={onClose}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>ביטול</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  sheet: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 2,
  },
  option: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  appIcon: {
    width: 28,
    height: 28,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
});
