import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';

export default function OnboardingHero() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-between py-10">
        {/* Top Section: Logo and Brand */}
        <View className="items-center mt-6">
          <View className="w-16 h-16 bg-sky-50 rounded-2xl items-center justify-center mb-4">
            <MaterialCommunityIcons name="blur" size={40} color="#37a3e1" />
          </View>
          <Text
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: 'Inter-Bold' }}
          >
            Infera
          </Text>
          <Text className="text-gray-500 text-sm mt-1">
            infers what matters
          </Text>
        </View>

        {/* Middle Section: Welcome */}
        <View className="items-center">
          <Text
            className="text-2xl font-bold text-slate-900 text-center mb-2"
            style={{ fontFamily: 'Inter-Bold' }}
          >
            ברוכים הבאים ל-Infera
          </Text>
          <Text className="text-gray-500 text-base text-center px-4 leading-6">
            הדרך החכמה לנהל את הבית ואת החיים
          </Text>

          {/* Decorative Visual Placeholder */}
          <View className="mt-10 w-full h-64 bg-sky-50 rounded-3xl items-center justify-center overflow-hidden border border-sky-100">
            <Ionicons
              name="home-outline"
              size={80}
              color="rgba(55, 163, 225, 0.2)"
            />
            {/* כאן אפשר להוסיף את תבנית הנקודות מהעיצוב בעתיד */}
          </View>
        </View>

        {/* Bottom Section: Actions */}
        <View className="mb-4">
          <Pressable
            onPress={() => router.push('/onboarding-step1')}
            className="bg-[#37a3e1] h-14 rounded-xl flex-row items-center justify-center shadow-lg shadow-sky-200"
          >
            <Text className="text-white text-lg font-bold mr-2">
              בואו נתחיל
            </Text>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>

          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500 text-sm">כבר יש לי חשבון? </Text>
            <Pressable onPress={() => router.push('/login')}>
              <Text className="text-[#37a3e1] text-sm font-bold">התחברות</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
