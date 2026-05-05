import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useOnboarding } from '@/contexts/OnboardingContext';
import { api } from '@/convex/_generated/api';

/**
 * Post-OTP routing: Home if family exists / invite join / skipped setup;
 * otherwise optional family-profile-setup.
 */
export default function FamilyBootstrapScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: onboardingData } = useOnboarding();
  const hasLocalOnboardingData = Boolean(onboardingData.spaceType);

  const userStatus = useQuery(api.users.getCurrentUserStatus, {});
  const bootstrap = useQuery(api.users.getFamilyBootstrapStatus, {});

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (userStatus === undefined || bootstrap === undefined) return;

    if (userStatus === null || bootstrap === null) {
      redirectedRef.current = true;
      router.replace('/(auth)/sign-in');
      return;
    }

    const syncingOnboarding =
      hasLocalOnboardingData && !userStatus.onboardingComplete;

    if (syncingOnboarding) return;

    if (!hasLocalOnboardingData && !userStatus.onboardingComplete) {
      redirectedRef.current = true;
      router.replace('/onboarding-hero');
      return;
    }

    redirectedRef.current = true;

    const { hasConfiguredFamily, joinedExistingSpace, familySetupSkippedAt } =
      bootstrap;

    if (
      hasConfiguredFamily ||
      joinedExistingSpace ||
      familySetupSkippedAt !== null
    ) {
      router.replace('/(authenticated)');
      return;
    }

    router.replace('/(authenticated)/family-profile-setup');
  }, [bootstrap, userStatus, hasLocalOnboardingData, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <ActivityIndicator color="#4A9FE2" size="large" />
      <Text className="mt-6 text-center text-base text-gray-600 text-right">
        מכינים את החשבון…
      </Text>
    </View>
  );
}
