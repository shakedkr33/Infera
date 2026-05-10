import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_ONBOARDING_KEY = 'hasSeenOnboarding';

export const markOnboardingSeen = async (): Promise<void> => {
  await AsyncStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
};

export const getHasSeenOnboarding = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(HAS_SEEN_ONBOARDING_KEY)) === 'true';
