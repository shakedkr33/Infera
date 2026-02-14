import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

const COUNTS = [1, 2, 3, 4, '5+'] as const;

export default function OnboardingChildrenSelect() {
  const router = useRouter();
  const [selected, setSelected] = useState<number | '5+'>(2);
  const [customCount, setCustomCount] = useState('');

  const handleSelect = (value: number | '5+') => {
    setSelected(value);
    if (value !== '5+') {
      setCustomCount('');
    }
  };

  const getFinalCount = (): number => {
    if (selected === '5+') {
      const parsed = Number.parseInt(customCount, 10);
      return parsed > 0 && parsed <= 10 ? parsed : 5;
    }
    return selected;
  };

  const handleContinue = async () => {
    const count = getFinalCount();
    await AsyncStorage.setItem('childrenCount', count.toString());
    router.push('/onboarding-step2');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.beige }}>
      {/* Header */}
      <View className="pt-4 px-6">
        <View className="flex-row-reverse items-center justify-between mb-2">
          <Pressable
            onPress={() => router.back()}
            className="p-2"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <MaterialIcons name="arrow-forward" size={24} color={colors.slate} />
          </Pressable>
          <Text style={{ color: colors.slate }} className="text-sm font-medium">
            מיקוד משפחתי
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <View className="flex-1 justify-between pb-10 pt-4">
        {/* Icon & Title */}
        <View className="items-center px-8">
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 56, height: 56, marginBottom: 20 }}
            resizeMode="contain"
            accessibilityLabel="InYomi"
          />
          <Text
            style={{ color: colors.slate }}
            className="text-[26px] font-extrabold text-center leading-tight mb-2"
          >
            כמה ילדים יש במשפחה?
          </Text>
          <Text
            style={{ color: colors.slateLight }}
            className="text-[15px] text-center leading-relaxed"
          >
            כדי שנתאים את הלוח והתזכורות בדיוק למשפחה שלכם
          </Text>
        </View>

        {/* Selection Circles */}
        <View className="items-center px-6">
          <View className="flex-row items-center justify-center gap-4">
            {COUNTS.map((num) => {
              const isActive = selected === num;
              return (
                <Pressable
                  key={num.toString()}
                  onPress={() => handleSelect(num)}
                  className="items-center"
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${num} ילדים`}
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: isActive ? colors.sage : colors.white,
                      borderWidth: 2,
                      borderColor: isActive ? colors.sage : '#E8E4DD',
                    }}
                  >
                    <Text
                      className="text-xl font-bold"
                      style={{ color: isActive ? colors.white : colors.slate }}
                    >
                      {num}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Input for 5+ */}
          {selected === '5+' && (
            <View className="mt-6 items-center">
              <Text
                style={{ color: colors.slateLight }}
                className="text-sm font-medium mb-2"
              >
                הזיני מספר מדויק (עד 10)
              </Text>
              <TextInput
                value={customCount}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9]/g, '');
                  if (num === '' || (Number.parseInt(num, 10) <= 10)) {
                    setCustomCount(num);
                  }
                }}
                placeholder="5"
                placeholderTextColor={colors.slateMuted}
                keyboardType="number-pad"
                maxLength={2}
                className="w-20 h-12 rounded-2xl text-center text-xl font-bold"
                style={{
                  backgroundColor: colors.white,
                  borderWidth: 1.5,
                  borderColor: colors.sage,
                  color: colors.slate,
                }}
              />
            </View>
          )}
        </View>

        {/* Helper Text */}
        <View className="px-8">
          <Text
            style={{ color: colors.slateMuted }}
            className="text-[13px] text-center leading-relaxed"
          >
            בשלב הבא תוכלי לספר לנו עוד על האתגרים שלך, כדי שנתאים הכל בדיוק
            בשבילך
          </Text>
        </View>

        {/* Continue Button */}
        <View className="px-6">
          <Pressable
            onPress={handleContinue}
            className="w-full h-16 rounded-full flex-row items-center justify-center gap-3"
            style={{ backgroundColor: colors.sage }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="המשך"
          >
            <Text className="text-white text-xl font-bold">המשך</Text>
            <MaterialIcons name="chevron-left" size={24} color="white" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
