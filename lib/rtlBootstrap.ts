/**
 * RTL Bootstrap - Force RTL in all runtime environments
 *
 * This module ensures all runtime environments (Expo Go, dev client, production
 * builds) start with RTL active. On the first launch after install or an OTA
 * update that has not yet applied RTL, I18nManager.isRTL is false; we force it
 * and reload the JS bundle so every subsequent render starts with the correct
 * direction. The setting is persistent, so the reload only ever happens once.
 *
 * NOTE for native builds: the expo-localization plugin also sets
 * android:supportsRTL="true" in the manifest and ExpoLocalization_forcesRTL in
 * iOS Info.plist as a build-time safety net. This JS bootstrap is still
 * required because the plugin alone does not call I18nManager.forceRTL().
 */

import * as Updates from 'expo-updates';
import { I18nManager } from 'react-native';

const APP_IS_RTL = true;

/**
 * Forces RTL mode in all runtime environments.
 * If RTL is not yet active, enables it and reloads the JS bundle.
 *
 * @returns Promise<boolean> - true if the app is about to reload, false otherwise
 */
export async function bootstrapRTL(): Promise<boolean> {
  if (!APP_IS_RTL) {
    return false;
  }

  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);

    try {
      // Reload so all StyleSheet.create() calls happen with isRTL = true.
      // In production builds without an active EAS Update channel this may
      // throw — the RTL flag is still saved and takes effect on the next
      // cold start.
      await Updates.reloadAsync();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
