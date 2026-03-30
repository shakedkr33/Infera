import { MaterialIcons } from '@expo/vector-icons';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Redirect, Tabs, useRootNavigationState, useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import { ActionSheetContext } from '@/contexts/ActionSheetContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { api } from '@/convex/_generated/api';

// ─── Regular Tab Button (icon + label wrapped in selection pill) ──────────────

type TabBtnProps = {
  iconName: string;
  label: string;
  onPress?: ((e: unknown) => void) | null;
  onLongPress?: ((e: unknown) => void) | null;
  // React Navigation passes focused state as aria-selected, not accessibilityState
  'aria-selected'?: boolean;
};

function RegularTabButton({
  iconName,
  label,
  onPress,
  onLongPress,
  'aria-selected': ariaSelected,
}: TabBtnProps) {
  const focused = ariaSelected === true;
  const color = focused ? '#36a9e2' : '#94a3b8';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButtonBase}
      accessible={true}
      accessibilityRole="tab"
      aria-selected={focused}
    >
      <View style={focused ? styles.activeTabPill : styles.inactiveTabItem}>
        <MaterialIcons name={iconName as never} size={22} color={color} />
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Central Plus Tab Button (raised circle) ──────────────────────────────────

function PlusCenterButton() {
  const { openActionSheet } = useContext(ActionSheetContext);
  return (
    <Pressable
      onPress={openActionSheet}
      style={styles.tabButtonBase}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="הוסף פריט חדש"
    >
      <View style={styles.plusBtn}>
        <MaterialIcons name="add" size={32} color="white" />
      </View>
    </Pressable>
  );
}

// ─── Action Sheet Modal ───────────────────────────────────────────────────────

function ActionSheetModal({
  isVisible,
  onClose,
}: {
  isVisible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.bottomSheetContainer}
      >
        <View style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetInput}>
            <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
            <TextInput
              style={styles.sheetTextInput}
              placeholder="על מה את חושבת? או הדביקי הודעה..."
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.sheetInputIcons}>
              <MaterialIcons name="photo-camera" size={22} color="#94a3b8" />
              <MaterialIcons name="mic" size={22} color="#94a3b8" />
            </View>
          </View>
          <View style={styles.sheetActions}>
            <ActionButton
              icon="calendar-today"
              label="אירוע"
              onPress={() => {
                onClose();
                router.push('/(authenticated)/event/new');
              }}
            />
            <ActionButton
              icon="check"
              label="משימה"
              onPress={() => {
                onClose();
                router.push('/(authenticated)/task/new');
              }}
            />
            <ActionButton
              icon="cake"
              label="יום הולדת"
              onPress={() => {
                onClose();
                router.push('/birthdays');
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 8 }}>
      <View style={styles.actionBtnCircle}>
        <MaterialIcons name={icon as never} size={28} color="#36a9e2" />
      </View>
      <Text style={styles.actionBtnLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isPremium, isLoading: isRevenueCatLoading } = useRevenueCat();
  // FIXED: deferred saveAll() to authenticated layout to avoid auth race condition
  // hasLocalOnboardingData lets a just-registered user through while Convex
  // propagates the finishOnboarding mutation result (avoids redirect loop).
  const { data: onboardingData, updateData, hydrateFromServer } = useOnboarding();
  const hasLocalOnboardingData = !!onboardingData.spaceType;
  const finishOnboarding = useMutation(api.onboarding.finishOnboarding);
  // Ref guard prevents a second mutation call if a render occurs while the first is in-flight.
  const savingRef = useRef(false);

  const navigationState = useRootNavigationState();
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  // Fetch onboarding status — skip the query while not yet authenticated to avoid
  // an unnecessary round-trip and potential auth errors
  const userStatus = useQuery(
    api.users.getCurrentUserStatus,
    isAuthenticated ? {} : 'skip'
  );

  // FIXED: context now rehydrates from Convex on authenticated app start.
  // Fetches fullName, profileColor, spaceType for the current user.
  // Skip when not authenticated to avoid a needless round-trip.
  const myProfile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : 'skip'
  );
  // Guard: only hydrate once per session.
  const hydratedRef = useRef(false);

  useEffect(() => {
    // Only hydrate for confirmed returning users (onboardingComplete on server)
    // whose context is still empty (app was restarted). The !onboardingData.onboardingCompleted
    // guard ensures a just-completed onboarding session is never overwritten.
    if (
      !isAuthenticated ||
      !userStatus?.onboardingComplete ||
      onboardingData.onboardingCompleted ||
      !myProfile ||
      hydratedRef.current
    ) return;

    hydratedRef.current = true;
    hydrateFromServer(myProfile);
  }, [
    isAuthenticated,
    userStatus,
    myProfile,
    onboardingData.onboardingCompleted,
    hydrateFromServer,
  ]);

  // FIXED: deferred saveAll() to authenticated layout to avoid auth race condition.
  // Called once after the Convex session is confirmed active (userStatus has resolved),
  // so the server never sees an unauthenticated finishOnboarding call.
  useEffect(() => {
    if (
      !isAuthenticated ||
      userStatus === undefined ||
      userStatus.onboardingComplete ||
      !hasLocalOnboardingData ||
      onboardingData.onboardingCompleted ||
      savingRef.current
    ) return;

    savingRef.current = true;
    finishOnboarding({
      fullName:
        [onboardingData.firstName, onboardingData.lastName]
          .filter(Boolean)
          .join(' ') ||
        onboardingData.firstName ||
        'משתמש',
      profileColor: onboardingData.personalColor ?? '#36a9e2',
      spaceType: onboardingData.spaceType ?? 'personal',
      challenges: onboardingData.challenges ?? [],
      sources: onboardingData.sources ?? [],
      childCount: onboardingData.childCount,
      familyContacts: onboardingData.familyData?.familyMembers,
    })
      .catch((err: unknown) =>
        console.warn('[Onboarding] finishOnboarding failed:', err)
      )
      .finally(() => updateData({ onboardingCompleted: true }));
  }, [
    isAuthenticated,
    userStatus,
    hasLocalOnboardingData,
    onboardingData.onboardingCompleted,
    onboardingData.firstName,
    onboardingData.lastName,
    onboardingData.personalColor,
    onboardingData.spaceType,
    onboardingData.challenges,
    onboardingData.sources,
    onboardingData.childCount,
    onboardingData.familyData,
    finishOnboarding,
    updateData,
  ]);

  // Wait for: navigation tree, auth state, RevenueCat, and user profile to resolve
  const isUserStatusLoading = isAuthenticated && userStatus === undefined;
  // FIXED: family profile persistence — for returning users, hold the spinner until hydrateFromServer
  // has actually run (onboardingCompleted flips true). Without this gate, tabs render with empty
  // OnboardingContext before the hydration effect fires, causing a flash of personal-only state in
  // profile.tsx and stale-init of useFamilyProfileEditor's useState in family-profile.tsx.
  // myProfile !== null guard prevents an infinite spinner if the user record is missing (edge case).
  const needsHydration =
    isAuthenticated &&
    userStatus?.onboardingComplete === true &&
    !onboardingData.onboardingCompleted &&
    myProfile !== null;

  if (
    !navigationState?.key ||
    isLoading ||
    isRevenueCatLoading ||
    isUserStatusLoading ||
    needsHydration
  ) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4A9FE2" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Route to onboarding if the user has never completed it (new user or profile missing).
  // Bypass if the user just completed onboarding this session — finishOnboarding may not
  // have propagated to Convex yet, but local context confirms they finished the flow.
  if (!userStatus?.onboardingComplete && !hasLocalOnboardingData) {
    return <Redirect href="/onboarding-hero" />;
  }

  if (PAYMENT_SYSTEM_ENABLED && !isPremium) {
    return <Redirect href="/(auth)/paywall" />;
  }

  return (
    <ActionSheetContext.Provider
      value={{ openActionSheet: () => setIsActionSheetVisible(true) }}
    >
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#36a9e2',
            tabBarInactiveTintColor: '#94a3b8',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopColor: '#f0f0f0',
              height: 90,
              paddingBottom: 25,
              paddingTop: 10,
              overflow: 'visible',
            },
            tabBarLabelStyle: { display: 'none' }, // labels rendered inside our custom buttons
          }}
        >
          {/* ── Visible tabs (left → right): בית | יומן | + | משימות | קהילות ── */}
          <Tabs.Screen
            name="index"
            options={{
              tabBarButton: (props) => (
                <RegularTabButton
                  {...(props as unknown as TabBtnProps)}
                  iconName="home"
                  label="בית"
                />
              ),
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              tabBarButton: (props) => (
                <RegularTabButton
                  {...(props as unknown as TabBtnProps)}
                  iconName="calendar-month"
                  label="יומן"
                />
              ),
            }}
          />
          {/* Central Plus */}
          <Tabs.Screen
            name="plus"
            options={{
              title: '',
              tabBarButton: () => <PlusCenterButton />,
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              tabBarButton: (props) => (
                <RegularTabButton
                  {...(props as unknown as TabBtnProps)}
                  iconName="check-circle-outline"
                  label="משימות"
                />
              ),
            }}
          />
          <Tabs.Screen
            name="communities"
            options={{
              tabBarButton: (props) => (
                <RegularTabButton
                  {...(props as unknown as TabBtnProps)}
                  iconName="people"
                  label="קהילות"
                />
              ),
            }}
          />
          {/* groups מחליף ל-communities – מוסתר */}
          <Tabs.Screen name="groups" options={{ href: null }} />
          {/* Profile is accessible via avatar press / navigation, not from tab bar */}
          <Tabs.Screen name="profile" options={{ href: null }} />

          {/* ── Hidden screens ── */}
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen name="birthdays" options={{ href: null }} />
          <Tabs.Screen name="event/new" options={{ href: null }} />
          <Tabs.Screen name="event/[id]" options={{ href: null }} />
          <Tabs.Screen name="task/new" options={{ href: null }} />
          <Tabs.Screen name="task/[id]" options={{ href: null }} />
          <Tabs.Screen name="import-calendar" options={{ href: null }} />
          <Tabs.Screen name="import-holidays" options={{ href: null }} />
          <Tabs.Screen name="family-profile" options={{ href: null }} />
          <Tabs.Screen name="community-create" options={{ href: null }} />
          <Tabs.Screen name="community-edit/[id]" options={{ href: null }} />
          <Tabs.Screen name="event-edit/[id]" options={{ href: null }} />
          <Tabs.Screen name="community-join/[code]" options={{ href: null }} />
          <Tabs.Screen name="community-members/[id]" options={{ href: null }} />
          <Tabs.Screen name="community/[id]" options={{ href: null }} />
          <Tabs.Screen name="community-reminder/new" options={{ href: null }} />
        </Tabs>

        <ActionSheetModal
          isVisible={isActionSheetVisible}
          onClose={() => setIsActionSheetVisible(false)}
        />
      </View>
    </ActionSheetContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tab bar buttons
  tabButtonBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabPill: {
    backgroundColor: 'rgba(54,169,226,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignItems: 'center',
    gap: 2,
  },
  inactiveTabItem: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabLabelActive: { color: '#36a9e2', fontWeight: '700' },

  // Central plus button — raised circle
  plusBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#36a9e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  // Action sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheetPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sheetHandle: {
    width: 40,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 32,
  },
  sheetTextInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    paddingHorizontal: 12,
    color: '#111517',
  },
  sheetInputIcons: { flexDirection: 'row-reverse', gap: 8 },
  sheetActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionBtnCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLabel: { fontSize: 14, fontWeight: '700', color: '#111418' },
});
