import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreviewModeBanner } from '@/components/PreviewModeBanner';
import { WebViewModal } from '@/components/WebViewModal';
import { IS_DEV_MODE, PRIVACY_URL, TERMS_URL } from '@/config/appConfig';
import { rtl, tw } from '@/lib/rtl';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

export default function SignUpScreen() {
  const { signIn } = useAuthActions(); // פעולת ההרשמה (משתמשת באותה פונקציה כמו התחברות)
  const router = useRouter(); // ניווט
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // מצב טעינה
  const [rememberMe, setRememberMe] = useState(false); // האם לזכור את האימייל
  const [showPassword, setShowPassword] = useState(false); // הצגת/הסתרת סיסמה
  const [consentAccepted, setConsentAccepted] = useState(false); // הסכמה לתנאי שימוש ופרטיות
  const [termsModalVisible, setTermsModalVisible] = useState(false); // מודל תנאי שימוש
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false); // מודל מדיניות פרטיות

  // טעינת האימייל השמור בעת טעינת המסך
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const rememberedEmail =
          await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (rememberedEmail) {
          setEmail(rememberedEmail);
          setRememberMe(true);
        }
      } catch {
        // התעלמות משגיאות אחסון
      }
    };
    loadRememberedEmail();
  }, []);

  // פונקציית ההרשמה
  const onSignUpPress = async () => {
    // במצב תצוגה מקדימה - לא מבצעים הרשמה אמיתית
    if (isPreviewMode) {
      return;
    }

    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    // בדיקה שהמשתמש אישר את תנאי השימוש ומדיניות הפרטיות
    if (!consentAccepted) {
      Alert.alert('שגיאה', 'אנא קרא ואשר קודם את תנאי השימוש ומדיניות הפרטיות');
      return;
    }

    if (password.length < 6) {
      Alert.alert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);

    try {
      // יצירת משתמש חדש והתחברות (flow: 'signUp')
      await signIn('password', {
        email,
        password,
        flow: 'signUp',
      });

      // שמירה או מחיקה של האימייל מהזיכרון
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      // מעבר למסך הפרימיום (הפיוול מוצג אחרי ההרשמה)
      router.replace('/onboarding-premium');
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || '';

      // מיפוי שגיאות Convex Auth להודעות בעברית ידידותיות למשתמש
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('AccountAlreadyExists')
      ) {
        Alert.alert('שגיאה', 'כתובת האימייל כבר רשומה במערכת');
      } else if (
        errorMessage.includes('password') &&
        errorMessage.includes('weak')
      ) {
        Alert.alert('שגיאה', 'הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר');
      } else if (errorMessage.includes('TooManyRequests')) {
        Alert.alert('שגיאה', 'יותר מדי ניסיונות. אנא נסה שוב מאוחר יותר');
      } else if (
        errorMessage.includes('invalid') &&
        errorMessage.includes('email')
      ) {
        Alert.alert('שגיאה', 'כתובת האימייל אינה תקינה');
      } else {
        Alert.alert('שגיאה', 'הרשמה נכשלה. אנא בדוק את הפרטים ונסה שוב');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTermsPress = () => {
    setTermsModalVisible(true);
  };

  const handlePrivacyPress = () => {
    setPrivacyModalVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* כפתור יציאה במצב תצוגה מקדימה */}
      {isPreviewMode && <PreviewModeBanner onClose={() => router.back()} />}

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

      {/* KeyboardAvoidingView דואג שהמקלדת לא תסתיר את שדות הקלט */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* באנר מצב תצוגה מקדימה */}
        {isPreviewMode && (
          <View className="p-3 bg-yellow-500/20 border-b border-yellow-500/50">
            <Text className="text-yellow-400 text-center text-sm font-medium">
              מצב תצוגה מקדימה - הרשמה מושבתת
            </Text>
          </View>
        )}

        <View className="flex-1 justify-center px-6">
          <View className="w-full">
            <Text
              className="text-white text-[32px] font-bold mb-2"
              style={{ textAlign: rtl.textAlign }}
            >
              צור חשבון חדש
            </Text>
            <Text
              className="text-zinc-400 text-base mb-8"
              style={{ textAlign: rtl.textAlign }}
            >
              הירשם כדי להתחיל להשתמש באפליקציה
            </Text>

            {/* שדה אימייל */}
            <View className="mb-5">
              <Text
                className="text-white text-sm font-medium mb-2"
                style={{ textAlign: rtl.textAlign }}
              >
                כתובת אימייל
              </Text>
              <TextInput
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-base"
                style={{ textAlign: rtl.textAlign }}
                value={email}
                onChangeText={setEmail}
                placeholder="example@gmail.com"
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* שדה סיסמה */}
            <View className="mb-5">
              <Text
                className="text-white text-sm font-medium mb-2"
                style={{ textAlign: rtl.textAlign }}
              >
                סיסמה
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-12 text-white text-base"
                  style={{ textAlign: rtl.textAlign }}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="לפחות 6 תווים"
                  placeholderTextColor="#52525b"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                {/* כפתור הצגת/הסתרת סיסמה */}
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#71717a" />
                  ) : (
                    <Eye size={20} color="#71717a" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* תיבת סימון "זכור אותי" */}
            <View className={`${tw.flexRow} items-center justify-between mb-6`}>
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                className="flex-row items-center gap-2"
                disabled={loading}
              >
                <Text className="text-zinc-300 text-sm">זכור אותי</Text>
                <View
                  className={`w-5 h-5 rounded border-2 items-center justify-center ${
                    rememberMe
                      ? 'bg-sky-400 border-sky-400'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {rememberMe && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
              </Pressable>
            </View>

            {/* תיבת סימון הסכמה לתנאי שימוש ומדיניות פרטיות */}
            <View className="mb-6">
              <TouchableOpacity
                accessibilityLabel="אשר תנאי שימוש ומדיניות פרטיות"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                accessible={true}
                className={`${tw.flexRow} items-center gap-2`}
                onPress={() => setConsentAccepted(!consentAccepted)}
                disabled={loading}
              >
                <View
                  className={`h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                    consentAccepted
                      ? 'bg-sky-400 border-sky-400'
                      : 'bg-transparent border-zinc-600'
                  }`}
                >
                  {consentAccepted && <Check color="#0a0a0a" size={14} />}
                </View>
                <View className="flex-1">
                  <Text className={`${tw.textStart} text-zinc-300 text-sm`}>
                    אני מסכים ל
                    <Text
                      onPress={handleTermsPress}
                      className="text-sky-400 font-semibold"
                    >
                      תנאי השימוש
                    </Text>{' '}
                    ול
                    <Text
                      onPress={handlePrivacyPress}
                      className="text-sky-400 font-semibold"
                    >
                      מדיניות הפרטיות
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* כפתור הרשמה */}
            <TouchableOpacity
              className={`bg-sky-400 rounded-xl py-4 items-center ${loading || isPreviewMode || !consentAccepted ? 'opacity-60' : ''}`}
              onPress={onSignUpPress}
              disabled={loading || isPreviewMode || !consentAccepted}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-bold">הירשם</Text>
              )}
            </TouchableOpacity>

            {/* קישור להתחברות */}
            <View className="flex-row justify-center gap-2 mt-6">
              {isPreviewMode ? (
                <TouchableOpacity disabled={true}>
                  <Text className="text-zinc-500 font-semibold text-base">
                    התחבר כאן
                  </Text>
                </TouchableOpacity>
              ) : (
                <Link href="/(auth)/sign-in" asChild={true}>
                  <TouchableOpacity>
                    <Text className="text-sky-400 font-semibold text-base">
                      התחבר כאן
                    </Text>
                  </TouchableOpacity>
                </Link>
              )}
              <Text className="text-zinc-400 text-base">כבר יש לך חשבון?</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
