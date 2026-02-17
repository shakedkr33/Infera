import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useOnboarding } from '../contexts/OnboardingContext';

export default function OnboardingStep1() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState(data.spaceType || '');

  const handleContinue = async () => {
    if (selected) {
      updateData({ spaceType: selected });
      await AsyncStorage.setItem('userType', selected);

      // משפחה → מסך בחירת מספר ילדים, אחרת → ישר לשלב 2
      if (selected === 'family') {
        router.push('/onboarding-children-select');
      } else {
        router.push('/onboarding-step2');
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      {/* Header & Progress */}
      <View className="pt-4 px-4">
        <View className="flex-row-reverse items-center justify-between mb-4">
          <Pressable onPress={() => router.back()} className="p-2">
            <MaterialIcons
              name="arrow-forward"
              size={24}
              color={colors.slate}
            />
          </Pressable>
          <Text style={{ color: colors.slate }} className="text-sm font-medium">
            שלב 1 מתוך 4
          </Text>
          <View className="w-10" />
        </View>
        <View className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
          <View
            className="h-full w-1/4 rounded-full"
            style={{ backgroundColor: colors.sage }}
          />
        </View>
      </View>

      {/* Title */}
      <View className="pt-10 pb-10 px-6">
        <Text
          style={{ color: colors.slate }}
          className="text-[28px] font-extrabold text-center leading-tight"
        >
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
            className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border-2 ${selected === 'personal' ? 'border-[#4A9FE2]' : 'border-gray-100'}`}
          >
            <MaterialIcons name="person" size={48} color={colors.sage} />
          </View>
          <Text
            style={{ color: colors.slate }}
            className="text-lg font-bold mt-2"
          >
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
              className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border-2 ${selected === 'couple' ? 'border-[#4A9FE2]' : 'border-gray-100'}`}
            >
              <MaterialIcons name="group" size={48} color={colors.sage} />
            </View>
            <Text
              style={{ color: colors.slate }}
              className="text-lg font-bold mt-2 text-center"
            >
              עבורי ועבור{'\n'}בן/בת הזוג
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelected('family')}
            className="items-center"
          >
            <View
              className={`w-28 h-28 rounded-full bg-white items-center justify-center shadow-sm border-2 ${selected === 'family' ? 'border-[#4A9FE2]' : 'border-gray-100'}`}
            >
              <MaterialIcons
                name="family-restroom"
                size={48}
                color={colors.sage}
              />
            </View>
            <Text
              style={{ color: colors.slate }}
              className="text-lg font-bold mt-2 text-center"
            >
              עבור כל{'\n'}המשפחה
            </Text>
          </Pressable>
        </View>
      </View>

      {/* AI Tip Box */}
      <View className="px-6 py-6">
        <View
          className="rounded-2xl p-4 flex-row-reverse items-start border"
          style={{
            backgroundColor: 'rgba(74, 159, 226, 0.06)',
            borderColor: 'rgba(74, 159, 226, 0.12)',
          }}
        >
          <MaterialIcons
            name="auto-awesome"
            size={20}
            color={colors.sage}
            style={{ marginLeft: 12 }}
          />
          <Text
            style={{ color: colors.slate }}
            className="text-sm font-medium flex-1 leading-relaxed text-right"
          >
            זה עוזר לבינה המלאכותית להבין אילו אירועים ומשימות הכי חשובים לך.
          </Text>
        </View>
      </View>

      {/* Footer Button */}
      <View className="px-6 pb-10">
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          className="w-full h-16 rounded-full flex-row items-center justify-center gap-3 shadow-lg"
          style={{
            backgroundColor: selected ? colors.sage : '#d1d5db',
          }}
        >
          <Text className="text-white text-xl font-bold">המשך</Text>
          <MaterialIcons name="chevron-left" size={24} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
