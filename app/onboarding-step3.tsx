import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOnboarding } from './contexts/OnboardingContext';

// רשימת מקורות מעודכנת
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
  const [selected, setSelected] = useState<string[]>(data.infoSources || []);

  const toggleSelection = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    updateData({ infoSources: selected });
    router.push('/onboarding-step4');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header & Progress */}
      <View className="pt-4 px-6">
        <View className="flex-row-reverse items-center justify-between mb-4">
          <Pressable onPress={() => router.back()} className="p-2">
            <MaterialIcons name="arrow-forward" size={24} color="#111517" />
          </Pressable>
          <Text className="text-gray-400 font-medium text-sm">
            שלב 3 מתוך 4
          </Text>
          <View className="w-10" />
        </View>
        <View className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <View className="bg-[#36a9e2] h-full w-3/4 rounded-full" />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-[#111517] text-[28px] font-bold text-right leading-tight">
            מאיפה מגיע רוב המידע שלך?
          </Text>
          <Text className="text-[#36a9e2] text-sm font-medium mt-1 text-right">
            ניתן לבחור יותר מאפשרות אחת
          </Text>
          <Text className="text-gray-500 text-[15px] leading-relaxed mt-3 text-right">
            זה עוזר לבינה המלאכותית שלנו להבין איפה נמצא הבלגן שלך, כדי שנוכל
            לאסוף את הכל ליומן אחד מסודר.
          </Text>
        </View>

        <View className="gap-3 pb-32">
          {sources.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleSelection(item.id)}
                style={[styles.card, isSelected && styles.selectedCard]}
                className="flex-row-reverse items-center p-4 rounded-xl border border-[#dce2e5]"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <MaterialIcons
                    name={item.icon as any}
                    size={24}
                    color="#647b87"
                  />
                </View>

                <Text className="flex-1 mr-4 text-right text-base font-semibold text-[#111418]">
                  {item.title}
                </Text>

                <View
                  className={`h-6 w-6 rounded-full border-2 items-center justify-center ${isSelected ? 'border-[#36a9e2]' : 'border-[#dce2e5]'}`}
                >
                  {isSelected && (
                    <MaterialIcons name="check" size={16} color="#36a9e2" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white/90 px-6 py-8">
        <View className="flex-row items-center justify-center gap-2 mb-6">
          <View className="h-1.5 w-1.5 rounded-full bg-gray-200" />
          <View className="h-1.5 w-4 rounded-full bg-[#36a9e2]" />
          <View className="h-1.5 w-1.5 rounded-full bg-gray-200" />
          <View className="h-1.5 w-1.5 rounded-full bg-gray-200" />
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={selected.length === 0}
          className={`w-full h-14 rounded-xl flex-row items-center justify-center gap-2 shadow-lg ${selected.length > 0 ? 'bg-[#36a9e2]' : 'bg-gray-300'}`}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color="white"
            style={{ transform: [{ scaleX: -1 }] }}
          />
          <Text className="text-white text-lg font-bold">המשך</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white' },
  selectedCard: {
    borderColor: '#36a9e2',
    backgroundColor: 'rgba(54, 169, 226, 0.05)',
  },
});
