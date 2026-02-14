import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native'; // ה-SafeAreaView הוסר מכאן
import { SafeAreaView } from 'react-native-safe-area-context'; // התיקון המודרני
import { useOnboarding } from '../contexts/OnboardingContext';

export default function OnboardingStep1() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState(data.spaceType || '');

  const handleContinue = () => {
    if (selected) {
      updateData({ spaceType: selected });

      // תמיד ממשיכים לשלב 2 (הרצף: step1 → step2 → step3 → step4 → children → sign-up)
      router.push('/onboarding-step2');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      {/* Header & Progress */}
      <View className="pt-4 px-4">
        <View className="flex-row-reverse items-center justify-between mb-4">
          <Pressable onPress={() => router.back()} className="p-2">
            <MaterialIcons name="arrow-forward" size={24} color="#111517" />
          </Pressable>
          <Text className="text-[#111517] text-sm font-medium">
            שלב 1 מתוך 4
          </Text>
          <View className="w-10" />
        </View>
        <View className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
          <View className="bg-[#36a9e2] h-full w-1/4 rounded-full" />
        </View>
      </View>

      {/* Title */}
      <View className="pt-10 pb-10 px-6">
        <Text className="text-[#111517] text-[28px] font-extrabold text-center leading-tight">
          עבור מי אנחנו בונים את הלו"ז?
        </Text>
      </View>

      {/* Options Grid */}
      <View className="flex-1 px-6 items-center">
        {/* Only Me */}
        <Pressable
          onPress={() => setSelected('personal')}
          className="items-center mb-8"
        >
          <View
            className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border ${selected === 'personal' ? 'border-[#36a9e2] border-2' : 'border-gray-100'}`}
          >
            <MaterialIcons name="person" size={48} color="#36a9e2" />
          </View>
          <Text className="text-[#111517] text-lg font-bold mt-2">
            רק עבורי
          </Text>
        </Pressable>

        {/* Couple & Family */}
        <View className="flex-row justify-center gap-8 w-full">
          <Pressable
            onPress={() => setSelected('couple')}
            className="items-center"
          >
            <View
              className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border ${selected === 'couple' ? 'border-[#36a9e2] border-2' : 'border-gray-100'}`}
            >
              <MaterialIcons name="group" size={48} color="#36a9e2" />
            </View>
            <Text className="text-[#111517] text-lg font-bold mt-2 text-center">
              עבורי ועבור{'\n'}בן/בת הזוג
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelected('family')}
            className="items-center"
          >
            <View
              className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border ${selected === 'family' ? 'border-[#36a9e2] border-2' : 'border-gray-100'}`}
            >
              <MaterialIcons name="family-restroom" size={48} color="#36a9e2" />
            </View>
            <Text className="text-[#111517] text-lg font-bold mt-2 text-center">
              עבור כל{'\n'}המשפחה
            </Text>
          </Pressable>
        </View>
      </View>

      {/* AI Tip Box */}
      <View className="px-6 py-6">
        <View className="bg-[#36a9e210] rounded-2xl p-4 flex-row-reverse items-start border border-[#36a9e215]">
          <MaterialIcons
            name="auto-awesome"
            size={20}
            color="#36a9e2"
            style={{ marginLeft: 12 }}
          />
          <Text className="text-[#111517] text-sm font-medium flex-1 leading-relaxed text-right">
            זה עוזר לבינה המלאכותית להבין אילו אירועים ומשימות הכי חשובים לך.
          </Text>
        </View>
      </View>

      {/* Footer Button */}
      <View className="px-6 pb-10">
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          className={`w-full h-16 rounded-full flex-row items-center justify-center gap-3 shadow-lg ${selected ? 'bg-[#36a9e2] shadow-sky-200' : 'bg-gray-300'}`}
        >
          <Text className="text-white text-xl font-bold">המשך</Text>
          <MaterialIcons name="chevron-left" size={24} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
