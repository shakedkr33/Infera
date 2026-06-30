import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useOnboarding } from '../contexts/OnboardingContext';
import { markOnboardingSeen } from '../lib/onboardingState';
import { tw } from '@/lib/rtl';

const sources = [
  { id: 'whatsapp', title: 'הודעות וואטסאפ', icon: 'chat' },
  { id: 'mail_sms', title: 'מיילים ו-SMS', icon: 'mail' },
  { id: 'partner', title: 'בן/בת הזוג (הם מעדכנים אותי)', icon: 'favorite' },
  { id: 'notes', title: 'פתקים, צילומי מסך וזיכרון', icon: 'sticky-note-2' },
  { id: 'calendar', title: 'יומן קיים (גוגל/אפל)', icon: 'calendar-today' },
];

export default function OnboardingStep3() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(data.sources || []);

  const toggleSelection = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    updateData({ sources: selected });
    try {
      await markOnboardingSeen();
    } catch {}
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      {/* Header & Progress — consistent with step 1 / step 2 */}
      <View className="pt-4 px-6">
        <View className={`${tw.flexRow} items-center justify-between mb-4`}>
          <Pressable
            onPress={() => router.replace('/onboarding-step2')}
            className="p-2"
          >
            <MaterialIcons
              name="arrow-forward"
              size={24}
              color={colors.slate}
            />
          </Pressable>
          <Text style={{ color: colors.sage }} className="font-bold">
            שלב 3 מתוך 3
          </Text>
          <View className="w-10" />
        </View>
        <View className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <View
            className="h-full w-full rounded-full"
            style={{ backgroundColor: colors.sage }}
          />
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Title & subtitle — centered, no explanatory paragraph */}
        <View className="py-6">
          <Text
            style={{ color: colors.slate }}
            className="text-[28px] font-extrabold text-center leading-tight"
          >
            מאיפה מגיע רוב המידע שלך?
          </Text>
          <Text
            style={{ color: colors.sage }}
            className="text-sm font-bold mt-2 text-center"
          >
            ניתן לבחור יותר מאפשרות אחת
          </Text>
        </View>

        {/* Source cards */}
        <View className="gap-3 pb-4">
          {sources.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleSelection(item.id)}
                style={[styles.card, isSelected && styles.selectedCard]}
                className={`${tw.flexRow} items-center p-4 rounded-xl border border-[#dce2e5]`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <MaterialIcons
                    name={item.icon as any}
                    size={24}
                    color="#647b87"
                  />
                </View>

                <Text className={`flex-1 mr-4 ${tw.textStart} text-base font-semibold text-[#111418]`}>
                  {item.title}
                </Text>

                <View
                  className="h-6 w-6 rounded-full border-2 items-center justify-center"
                  style={{
                    borderColor: isSelected ? colors.sage : '#dce2e5',
                  }}
                >
                  {isSelected && (
                    <MaterialIcons name="check" size={16} color={colors.sage} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Helper box — anchored above CTA, not scrolling, consistent with step 1 / step 2 */}
      <View className="px-6 pt-3 pb-3 bg-[#f6f7f8]">
        <View
          className={`rounded-2xl p-4 ${tw.flexRow} items-start border`}
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
            className={`text-sm font-medium flex-1 leading-relaxed ${tw.textStart}`}
          >
            ספר/י לנו איפה המידע שלך נמצא, כדי שנוכל לעזור לך לרכז אותו במקום
            אחד
          </Text>
        </View>
      </View>

      {/* Footer Button — non-absolute, consistent with step 1 / step 2 */}
      <View className="px-6 pb-10 pt-2 bg-[#f6f7f8]">
        <Pressable
          onPress={handleContinue}
          disabled={selected.length === 0}
          className="w-full h-16 rounded-3xl flex-row items-center justify-center shadow-lg"
          style={{
            backgroundColor: selected.length > 0 ? colors.sage : '#d1d5db',
          }}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color="white"
            style={{ transform: [{ scaleX: -1 }] }}
          />
          <Text className="text-white text-xl font-bold">המשך</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white' },
  selectedCard: {
    borderColor: '#4A9FE2',
    backgroundColor: 'rgba(74, 159, 226, 0.05)',
  },
});
