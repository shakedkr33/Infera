import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';
import { Platform } from 'react-native';

const PROMPT_SEEN_KEY = 'inyomi_push_permission_prompt_seen';

// ─── Android Notification Channels ───────────────────────────────────────────
// Only "communities" is used in this sprint.
// The other channels (reminders, family, system) are pre-registered here so
// that future sprints can target them without requiring another native build.

export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('communities', {
    name: 'קהילות',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: 'עדכונים ואירועים מקהילות',
  });

  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'תזכורות',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'תזכורות לאירועים ומשימות',
  });

  await Notifications.setNotificationChannelAsync('family', {
    name: 'משפחה',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: 'עדכוני משפחה',
  });

  await Notifications.setNotificationChannelAsync('system', {
    name: 'מערכת',
    importance: Notifications.AndroidImportance.LOW,
    description: 'עדכוני מערכת',
  });
}

// ─── Notification Action Categories ──────────────────────────────────────────
// Registered for BOTH iOS and Android.
// expo-notifications supports setNotificationCategoryAsync on Android via the
// same API — action buttons are shown in the notification shade when the
// notification's categoryId matches a registered category.
// opensAppToForeground: true is intentional on all actions — these are
// state-changing operations (RSVP / calendar add / task add) where foreground
// execution guarantees the JS handler runs and the user sees the result.

export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('COMMUNITY_EVENT_RSVP', [
    {
      identifier: 'RSVP_YES',
      buttonTitle: 'כן',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'RSVP_MAYBE',
      buttonTitle: 'אולי',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'RSVP_NO',
      buttonTitle: 'לא',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('COMMUNITY_EVENT_ADD', [
    {
      identifier: 'ADD_TO_CALENDAR',
      buttonTitle: 'הוסף ליומן',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(
    'COMMUNITY_IMPORTANT_ITEM',
    [
      {
        identifier: 'ADD_TO_TASKS',
        buttonTitle: 'הוסף למשימות שלי',
        options: { opensAppToForeground: true },
      },
    ]
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const seen = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
    if (seen) {
      return null;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(PROMPT_SEEN_KEY, 'true');
    if (status !== 'granted') {
      return null;
    }
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId;

  if (!projectId) {
    console.warn('[Push] Missing EAS projectId for push token registration');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export function setupNotificationHandlers(router: Router): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const actionId = response.actionIdentifier;

      if (
        actionId === 'RSVP_YES' ||
        actionId === 'RSVP_MAYBE' ||
        actionId === 'RSVP_NO'
      ) {
        console.log(
          '[Push] RSVP action received (not wired yet):',
          actionId,
          data
        );
        return;
      }

      if (actionId === 'ADD_TO_CALENDAR') {
        console.log(
          '[Push] ADD_TO_CALENDAR action received (not wired yet):',
          data
        );
        return;
      }

      if (actionId === 'ADD_TO_TASKS') {
        console.log(
          '[Push] ADD_TO_TASKS action received (not wired yet):',
          data
        );
        return;
      }

      if (data?.screen && typeof data.screen === 'string') {
        router.push(data.screen as Parameters<typeof router.push>[0]);
      }
    }
  );

  return () => subscription.remove();
}
