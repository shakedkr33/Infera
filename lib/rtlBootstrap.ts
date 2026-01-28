/**
 * RTL Bootstrap - Auto-force RTL in Expo Go
 *
 * This module ensures that Expo Go behaves like native builds by forcing
 * RTL mode on first launch. After the reload, I18nManager.isRTL will be
 * true, and the RTL utilities will work correctly without manual hacks.
 *
 * IMPORTANT: This only runs in Expo Go. Native builds use expo-localization
 * plugin which handles RTL automatically.
 */

import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { I18nManager } from 'react-native';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const APP_IS_RTL = true;

/**
 * Bootstraps RTL mode for Expo Go environments.
 * If RTL is not enabled, it forces it and reloads the app.
 *
 * @returns Promise<boolean> - true if app will reload, false otherwise
 */
export async function bootstrapRTL(): Promise<boolean> {
  // Only run in Expo Go and if app is RTL
  if (!isExpoGo || !APP_IS_RTL) {
    return false;
  }

  // Check if RTL is already enabled
  if (!I18nManager.isRTL) {
    // Force RTL mode
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);

    // Reload app to apply changes
    // This is a one-time operation - after reload, isRTL will be true
    await Updates.reloadAsync();
    return true; // App will reload, so this return won't execute
  }

  return false;
}
