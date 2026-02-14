import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingPremium() {
  const router = useRouter();
  const { presentPaywallIfNeeded, isPremium } = useRevenueCat();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartTrial = async () => {
    setIsProcessing(true);
    try {
      // מציג את ה-Paywall המקורי של RevenueCat
      // אם המשתמש כבר פרימיום - ידלג אוטומטית
      const success = await presentPaywallIfNeeded();
      if (success || isPremium) {
        router.replace('/(authenticated)');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(authenticated)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header with Close */}
        <View className="flex-row-reverse items-center justify-between p-6">
          <Pressable onPress={handleSkip} className="p-2">
            <MaterialIcons name="close" size={28} color="#94a3b8" />
          </Pressable>
          <Image
            source={require('@/assets/images/logo-icon.png')}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
            accessibilityLabel="InYomi"
          />
        </View>

        {/* Premium Banner */}
        <View className="px-6 mb-6">
          <View className="w-full h-40 bg-[#f0f9ff] rounded-3xl border border-[#36a9e2]/10 items-center justify-center overflow-hidden">
            <View className="items-center">
              <Image
                source={require('@/assets/images/logo-icon.png')}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
                accessibilityLabel="InYomi Pro"
              />
              <View className="px-4 py-1 bg-[#36a9e2] rounded-full mt-2">
                <Text className="text-white text-[10px] font-black tracking-widest">
                  PREMIUM
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Title & Subtitle */}
        <View className="px-6 mb-8">
          <Text className="text-[#111617] text-[28px] font-black leading-tight text-right">
            הצטרפו ל-InYomi Pro ושחררו את הבלגן
          </Text>
          <Text className="text-slate-600 text-[17px] mt-2 text-right leading-snug">
            כל מה שצריך כדי לנהל את הבית ואת החיים בשיא, במקום אחד.
          </Text>
        </View>

        {/* Features List */}
        <View className="px-6 space-y-6 mb-8">
          {[
            {
              id: 'ai',
              title: 'סריקת AI ללא הגבלה',
              desc: 'פענוח אוטומטי של הודעות וואטסאפ ותמונות ישירות ליומן.',
            },
            {
              id: 'sync',
              title: 'סנכרון מלא לקרובים',
              desc: 'מנוי אחד שמכסה את כולם - חברו עד 6 בני משפחה לניהול משותף.',
            },
            {
              id: 'alerts',
              title: 'התראות ציוד חכמות',
              desc: 'מערכת תזכורות אינטליגנטית שלא תיתן לכם לשכוח כלום.',
            },
          ].map((item) => (
            <View key={item.id} className="flex-row-reverse items-start gap-4">
              <View className="w-6 h-6 rounded-full bg-[#36a9e2] items-center justify-center mt-1">
                <MaterialIcons name="check" size={16} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[#111617] text-base font-bold text-right">
                  {item.title}
                </Text>
                <Text className="text-slate-500 text-[13px] text-right mt-0.5">
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Trial Timeline */}
        <View className="mx-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
          {[
            {
              id: 'day0',
              day: 'יום 0',
              title: 'פתיחת אפשרויות',
              desc: 'התחילי בחינם ללא התחייבות',
              icon: 'lock-open',
              primary: false,
            },
            {
              id: 'day12',
              day: 'יום 12',
              title: 'תזכורת ידידותית',
              desc: 'נשלח לך התראה לפני סיום הניסיון',
              icon: 'notifications-active',
              primary: false,
            },
            {
              id: 'day14',
              day: 'יום 14',
              title: 'תחילת מנוי',
              desc: 'המנוי מתחיל באופן אוטומטי',
              icon: 'stars',
              primary: true,
            },
          ].map((step, idx) => (
            <View key={step.id} className="flex-row gap-4 mb-4 items-start">
              <View className="flex-1">
                <Text
                  className={`text-[15px] font-bold text-right ${step.primary ? 'text-[#36a9e2]' : 'text-[#111617]'}`}
                >
                  {step.day} ({step.title})
                </Text>
                <Text className="text-slate-500 text-[13px] text-right">
                  {step.desc}
                </Text>
              </View>
              <View className="items-center">
                <View
                  className={`size-8 rounded-full items-center justify-center ${step.primary ? 'bg-[#36a9e2]' : 'bg-[#36a9e2]/20'}`}
                >
                  <MaterialIcons
                    name={step.icon as never}
                    size={20}
                    color={step.primary ? 'white' : '#36a9e2'}
                  />
                </View>
                {idx < 2 && (
                  <View className="w-[2px] bg-[#36a9e2]/20 h-8 mt-1" />
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View className="px-8 pb-10 pt-4 bg-white border-t border-slate-100">
        <Pressable
          onPress={handleStartTrial}
          disabled={isProcessing}
          className={`w-full h-14 bg-[#36a9e2] rounded-2xl items-center justify-center shadow-lg shadow-[#36a9e2]/20 mb-4 ${isProcessing ? 'opacity-60' : ''}`}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold text-center">
              התחילי 14 ימי ניסיון בחינם
            </Text>
          )}
        </Pressable>
        <Pressable onPress={handleSkip} className="items-center">
          <Text className="text-slate-400 font-medium">אולי מאוחר יותר</Text>
        </Pressable>
        <Text className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          ביטול בכל עת בהגדרות החשבון. המנוי יתחדש אוטומטית בתום 14 ימי הניסיון
          אלא אם יבוטל.
        </Text>
      </View>
    </SafeAreaView>
  );
}
