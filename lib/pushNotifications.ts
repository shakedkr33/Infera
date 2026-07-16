import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';
import { Platform } from 'react-native';

const PROMPT_SEEN_KEY = 'inyomi_push_permission_prompt_seen';

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    // Permission already granted — fall through to token fetch
  } else {
    const seen = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
    if (seen) {
      // Already asked once — do not re-prompt automatically
      return null;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(PROMPT_SEEN_KEY, 'true');
    if (status !== 'granted') return null;
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
