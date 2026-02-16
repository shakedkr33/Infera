import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-between py-12 px-8">
      {/* לוגו וכותרת עליונה */}
      <View className="items-center mt-10">
        <Image
          source={require('@/assets/images/logo-with-text.png')}
          style={{ width: 220, height: 80 }}
          resizeMode="contain"
          accessibilityLabel="InYomi Logo"
        />
      </View>

      {/* איור מרכזי */}
      <View className="w-full aspect-square bg-blue-50/50 rounded-[40px] items-center justify-center border border-blue-100/50">
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 180, height: 180 }}
          resizeMode="contain"
          accessibilityLabel="InYomi"
        />
      </View>

      {/* טקסט וכפתור */}
      <View className="w-full items-center">
        <Text className="text-2xl font-bold text-[#111418] text-center mb-2">
          ברוכים הבאים ל-InYomi
        </Text>
        <Text className="text-gray-500 text-center mb-10 px-4">
          הדרך החכמה לנהל את הבית ואת החיים בשיא היעילות
        </Text>
        <Pressable
          onPress={() => router.push('/onboarding-step1')} // מחזיר אותנו למסך מבנה הלו"ז
          className="w-full h-16 bg-[#4A9FE2] rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-blue-200"
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text className="text-white text-lg font-bold">בואו נתחיל</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          className="mt-6"
        >
          <Text className="text-gray-400 font-medium">
            כבר יש לי חשבון? <Text className="text-[#4A9FE2]">התחברות</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
