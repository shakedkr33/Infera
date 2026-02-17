import 'react-native-gesture-handler';

import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { bootstrapRTL } from '@/lib/rtlBootstrap';
import { getConvexUrl } from '@/utils/convexConfig';
import { OnboardingProvider } from '../contexts/OnboardingContext';

const convexUrl = getConvexUrl();
const convex = new ConvexReactClient(convexUrl);

const secureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

export default function RootLayout() {
  useEffect(() => {
    bootstrapRTL().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          style="light"
          translucent={false}
          backgroundColor="#0a0a0a"
        />
        <ConvexAuthProvider client={convex} storage={secureStorage}>
          <OnboardingProvider>
            <RevenueCatProvider>
              <Slot />
            </RevenueCatProvider>
          </OnboardingProvider>
        </ConvexAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
