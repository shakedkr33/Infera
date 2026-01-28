import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebViewModal } from '@/components/WebViewModal';
import { IS_DEV_MODE, PRIVACY_URL, TERMS_URL } from '@/config/appConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { tw } from '@/lib/rtl';

// ============================================================================
// קונפיגורציית תכונות למסך התשלום
// ============================================================================

const FEATURES = [
  'תכונה #1 - תיאור התכונה',
  'תכונה #2 - תיאור התכונה',
  'תכונה #3 - תיאור התכונה',
];

// ============================================================================
// מסך התשלום (Paywall)
// ============================================================================

export default function PaywallScreen() {
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  const { packages, isLoading, purchasePackage, restorePurchases, isExpoGo } =
    useRevenueCat();

  // מציאת החבילות החודשית והשנתית
  const monthlyPackage = packages.find((p) => p.packageType === 'monthly');
  const annualPackage = packages.find((p) => p.packageType === 'annual');

  // בחירת תוכנית - ברירת מחדל: שנתית
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>(
    'annual'
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  // ============================================================================
  // פעולות
  // ============================================================================

  const handleClose = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (isPreviewMode) {
      // במצב תצוגה מקדימה - לא מבצעים רכישה אמיתית
      return;
    }

    const packageId =
      selectedPlan === 'monthly'
        ? monthlyPackage?.identifier
        : annualPackage?.identifier;

    if (!packageId) {
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePackage(packageId);
      if (success) {
        // ניווט לאזור המאומת לאחר רכישה מוצלחת
        router.replace('/(authenticated)');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (isPreviewMode) {
      return;
    }

    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        // ניווט לאזור המאומת לאחר שחזור מוצלח
        router.replace('/(authenticated)');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTerms = () => {
    setTermsModalVisible(true);
  };

  const handlePrivacy = () => {
    setPrivacyModalVisible(true);
  };

  // ============================================================================
  // רינדור
  // ============================================================================

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#4fc3f7" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]" edges={['top', 'bottom']}>
      {/* מודלים לתנאי שימוש ומדיניות פרטיות */}
      <WebViewModal
        visible={termsModalVisible}
        url={TERMS_URL}
        title="תנאי השימוש"
        onClose={() => setTermsModalVisible(false)}
      />

      <WebViewModal
        visible={privacyModalVisible}
        url={PRIVACY_URL}
        title="מדיניות הפרטיות"
        onClose={() => setPrivacyModalVisible(false)}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* כפתור סגירה */}
        <View className={`${tw.flexRow} ${tw.justifyEnd} px-4 pt-4`}>
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-zinc-800"
            hitSlop={8}
          >
            <X size={24} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* באנר מצב תצוגה מקדימה */}
        {isPreviewMode && (
          <View className="mx-4 mt-2 mb-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
            <Text className="text-yellow-400 text-center text-sm font-medium">
              מצב תצוגה מקדימה - רכישות מושבתות
            </Text>
          </View>
        )}

        {/* באנר Expo Go */}
        {isExpoGo && !isPreviewMode && (
          <View className="mx-4 mt-2 mb-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/50">
            <Text className="text-blue-400 text-center text-sm font-medium">
              Expo Go - רכישות לא זמינות
            </Text>
          </View>
        )}

        {/* כותרת */}
        <View className="px-6 pt-4 pb-6">
          <Text className="text-white text-3xl font-bold text-center mb-2">
            כותרת מסך התשלום
          </Text>
          <Text className="text-zinc-400 text-base text-center">
            כותרת משנה למסך התשלום
          </Text>
        </View>

        {/* רשימת תכונות */}
        <View className="px-6 pb-6">
          {FEATURES.map((feature) => (
            <View
              key={feature}
              className={`${tw.flexRow} items-center gap-3 mb-3`}
            >
              <View className="w-6 h-6 items-center justify-center">
                <ChevronLeft size={20} color="#4fc3f7" />
              </View>
              <Text className={`text-white text-base flex-1 ${tw.textStart}`}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {/* כותרת תמחור */}
        <View className="bg-white py-3 px-6">
          <Text className="text-zinc-900 text-center font-semibold text-base">
            הצטרף היום במחיר הטוב ביותר
          </Text>
        </View>

        {/* כרטיסי תוכניות */}
        <View className="px-4 py-6 gap-3">
          {/* תוכנית חודשית */}
          {monthlyPackage && (
            <TouchableOpacity
              onPress={() => setSelectedPlan('monthly')}
              className={`rounded-xl p-4 border-2 ${
                selectedPlan === 'monthly'
                  ? 'border-[#4fc3f7] bg-zinc-900'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <View className={`${tw.flexRow} items-center justify-between`}>
                <Text className="text-zinc-400 text-lg font-semibold">
                  {monthlyPackage.priceString}
                </Text>
                <View className={`${tw.flexRow} items-center gap-3`}>
                  <Text className="text-white text-lg font-semibold">
                    חודשי
                  </Text>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      selectedPlan === 'monthly'
                        ? 'border-[#4fc3f7] bg-[#4fc3f7]'
                        : 'border-zinc-600'
                    }`}
                  >
                    {selectedPlan === 'monthly' && (
                      <Check size={14} color="#0a0a0a" strokeWidth={3} />
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* תוכנית שנתית */}
          {annualPackage && (
            <TouchableOpacity
              onPress={() => setSelectedPlan('annual')}
              className={`rounded-xl p-4 border-2 ${
                selectedPlan === 'annual'
                  ? 'border-[#4fc3f7] bg-zinc-900'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <View className={`${tw.flexRow} items-center justify-between`}>
                <Text className="text-zinc-400 text-lg font-semibold">
                  {annualPackage.priceString}
                </Text>
                <View className={`${tw.flexRow} items-center gap-3`}>
                  <Text className="text-white text-lg font-semibold">שנתי</Text>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      selectedPlan === 'annual'
                        ? 'border-[#4fc3f7] bg-[#4fc3f7]'
                        : 'border-zinc-600'
                    }`}
                  >
                    {selectedPlan === 'annual' && (
                      <Check size={14} color="#0a0a0a" strokeWidth={3} />
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* טקסט מידע */}
        <Text className="text-zinc-500 text-center text-sm px-6 mb-4">
          הצטרף היום, בטל בכל עת.
        </Text>

        {/* כפתור המשך */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={handleContinue}
            disabled={isPurchasing || isPreviewMode}
            className={`bg-[#4fc3f7] rounded-xl py-4 items-center ${
              isPurchasing || isPreviewMode ? 'opacity-60' : ''
            }`}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text className="text-[#0a0a0a] text-lg font-bold">המשך</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* קישורים תחתונים */}
        <View className={`${tw.flexRow} justify-center gap-8 pb-6`}>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring || isPreviewMode}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#a1a1aa" />
            ) : (
              <Text className="text-zinc-500 text-sm">שחזור</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleTerms}>
            <Text className="text-zinc-500 text-sm">תנאי שימוש</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePrivacy}>
            <Text className="text-zinc-500 text-sm">פרטיות</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
