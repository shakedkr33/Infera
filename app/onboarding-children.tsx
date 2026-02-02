import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useOnboarding } from './contexts/OnboardingContext';

const counts = [1, 2, 3, 4, '5+'];

export default function OnboardingChildren() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState(data.childCount || 2);

  const handleContinue = () => {
    updateData({ childCount: typeof selected === 'number' ? selected : 5 });
    router.push('/onboarding-step2');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="pt-4 px-4">
        <View className="flex-row-reverse items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2">
            <MaterialIcons name="arrow-forward" size={24} color="#111517" />
          </Pressable>
          <View className="w-10" />
        </View>
      </View>

      <View className="flex-1 justify-between py-6">
        <View className="px-4">
          <Text className="text-[#111517] text-[28px] font-bold text-center leading-tight">
            כמה ילדים יש לך?
          </Text>
        </View>

        <View className="px-4">
          <View className="flex-row-reverse flex-wrap justify-center gap-4">
            {counts.map((num) => (
              <Pressable
                key={num.toString()}
                onPress={() => setSelected(num)}
                className={`w-14 h-14 rounded-full border items-center justify-center ${
                  selected === num
                    ? 'bg-[#36a9e2] border-[#36a9e2]'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${selected === num ? 'text-white' : 'text-[#111517]'}`}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="items-center justify-center">
          <View className="w-52 h-52 rounded-full bg-sky-50 items-center justify-center border-4 border-dashed border-sky-100">
            <MaterialIcons
              name="family-restroom"
              size={84}
              color="rgba(54, 169, 226, 0.2)"
            />
          </View>
        </View>

        <View className="px-6">
          <Pressable
            onPress={handleContinue}
            className="w-full h-14 bg-[#36a9e2] rounded-full flex-row items-center justify-center gap-3 shadow-lg shadow-sky-200"
          >
            <Text className="text-white text-lg font-bold">המשך</Text>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color="white"
              style={{ transform: [{ scaleX: -1 }] }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
