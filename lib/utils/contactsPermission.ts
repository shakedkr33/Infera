import * as Contacts from 'expo-contacts';
import { Alert, Linking } from 'react-native';

export interface ContactsAccessResult {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Ensures contacts access, requesting permission only if not already granted.
 * Pure permission logic — no Alert, no state, no Modal, no UI side effects.
 * Callers must invoke this BEFORE showing any contacts-related Modal/sheet.
 */
export async function ensureContactsAccess(): Promise<ContactsAccessResult> {
  const existing = await Contacts.getPermissionsAsync();
  if (existing.status === 'granted') {
    return { granted: true, canAskAgain: existing.canAskAgain };
  }
  const requested = await Contacts.requestPermissionsAsync();
  return {
    granted: requested.status === 'granted',
    canAskAgain: requested.canAskAgain,
  };
}

/**
 * Shows a denied-access alert with a button to open device settings.
 * Always shows both "ביטול" and "פתיחת הגדרות" regardless of canAskAgain.
 */
export function presentContactsAccessDeniedAlert(
  _canAskAgain: boolean
): void {
  Alert.alert(
    'גישה לאנשי קשר',
    'כדי לבחור אדם מאנשי הקשר, יש לאפשר ל־InYomi גישה בהגדרות המכשיר.',
    [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'פתיחת הגדרות',
        onPress: async () => {
          try {
            await Linking.openSettings();
          } catch {
            Alert.alert('שגיאה', 'לא הצלחנו לפתוח את הגדרות המכשיר.');
          }
        },
      },
    ]
  );
}
