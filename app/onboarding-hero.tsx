import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingHero() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white px-8 py-12">
      <View className="flex-1 justify-center items-center">
        {/* לוגו InYomi */}
        <Image
          source={require('@/assets/images/logo-icon.png')}
          style={{ width: 140, height: 140, marginBottom: 32 }}
          resizeMode="contain"
          accessibilityLabel="InYomi Logo"
        />

        <Text className="text-3xl font-black text-[#111418] text-right mb-4 leading-tight">
          העוזרת האישית של המשפחה שלך
        </Text>

        <Text className="text-gray-500 text-lg text-right leading-relaxed">
          InYomi לומדת את הלו"ז שלכם, מסנכרנת בין כולם ודואגת שלא תפספסו אף
          איסוף מהגן או חוג כדורגל.
        </Text>
      </View>

      <View className="gap-4">
        <Pressable
          onPress={() => router.push('/onboarding-children')}
          className="w-full h-16 bg-[#308ce8] rounded-2xl items-center justify-center shadow-lg shadow-blue-100"
        >
          <Text className="text-white text-lg font-bold">
            נשמע מעולה, קדימה
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
