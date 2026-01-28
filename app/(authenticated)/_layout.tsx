import { PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { IS_RTL } from '@/lib/rtl';
import { MaterialIcons } from '@expo/vector-icons'; // שימוש באייקונים מהעיצוב
import { useConvexAuth } from 'convex/react';
import { Redirect, Tabs, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isPremium, isLoading: isRevenueCatLoading } = useRevenueCat();
  const navigationState = useRootNavigationState();

  if (!navigationState?.key || isLoading || isRevenueCatLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#308ce8" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (PAYMENT_SYSTEM_ENABLED && !isPremium) {
    return <Redirect href="/(auth)/paywall" />;
  }

  // הגדרת הטאבים המעודכנת (ללא הגדרות)
  const tabs = [
    {
      name: 'index',
      title: 'בית',
      icon: 'home',
    },
    {
      name: 'calendar',
      title: 'יומן',
      icon: 'calendar-today',
    },
    {
      name: 'tasks',
      title: 'משימות',
      icon: 'check-circle-outline',
    },
  ];

  const isNativeRTLEnabled = I18nManager.isRTL === true;
  const orderedTabs = isNativeRTLEnabled
    ? tabs
    : IS_RTL
      ? [...tabs].reverse()
      : tabs;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#308ce8', // הכחול של Infera
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff', // רקע לבן נקי
          borderTopColor: '#f0f0f0',
          height: 90,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 5,
        },
      }}
    >
      {orderedTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={
                  focused
                    ? styles.activeTabHighlight
                    : styles.inactiveTabWrapper
                }
              >
                <MaterialIcons name={tab.icon as any} size={24} color={color} />
              </View>
            ),
          }}
        />
      ))}

      {/* הסתרת דף ההגדרות מהתפריט התחתון אך שמירה על הניתוב */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeTabHighlight: {
    backgroundColor: '#e0ecff',
    width: 55,
    height: 32,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  inactiveTabWrapper: {
    width: 55,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
