import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
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
import { IS_DEV_MODE } from '@/config/appConfig';
import { rtl, tw } from '@/lib/rtl';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

export default function SignInScreen() {
  const { signIn } = useAuthActions(); // פעולת ההתחברות מ-Convex Auth
  const router = useRouter(); // ניווט
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  // #region agent log
  useEffect(() => {
    // biome-ignore format: debug log
    fetch('http://127.0.0.1:7243/ingest/1ea5e66d-d528-4bae-a881-fff31ff26db7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(auth)/sign-in.tsx:render',message:'Sign-in screen rendered',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
  }, []);
  // #endregion

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // מצב טעינה
  const [rememberMe, setRememberMe] = useState(false); // האם לזכור את האימייל
  const [showPassword, setShowPassword] = useState(false); // הצגת/הסתרת סיסמה

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

  // פונקציית ההתחברות
  const onSignInPress = async () => {
    // במצב תצוגה מקדימה - לא מבצעים התחברות אמיתית
    if (isPreviewMode) {
      return;
    }

    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    setLoading(true);

    try {
      // ניסיון התחברות מול השרת
      await signIn('password', { email, password, flow: 'signIn' });

      // שמירה או מחיקה של האימייל מהזיכרון בהתאם לתיבת הסימון
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      // מעבר לאזור המאומת (Authenticated)
      router.replace('/(authenticated)');
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || '';

      // מיפוי שגיאות Convex Auth להודעות בעברית ידידותיות למשתמש
      if (errorMessage.includes('InvalidSecret')) {
        Alert.alert('שגיאה', 'הסיסמה שהוזנה שגויה');
      } else if (
        errorMessage.includes('InvalidAccountId') ||
        errorMessage.includes('Could not find')
      ) {
        Alert.alert('שגיאה', 'לא נמצא חשבון עם כתובת האימייל הזו');
      } else if (errorMessage.includes('TooManyRequests')) {
        Alert.alert(
          'שגיאה',
          'יותר מדי ניסיונות התחברות. אנא נסה שוב מאוחר יותר'
        );
      } else {
        Alert.alert('שגיאה', 'התחברות נכשלה. אנא בדוק את הפרטים ונסה שוב');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* כפתור יציאה במצב תצוגה מקדימה */}
      {isPreviewMode && <PreviewModeBanner onClose={() => router.back()} />}

      {/* KeyboardAvoidingView דואג שהמקלדת לא תסתיר את שדות הקלט */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* באנר מצב תצוגה מקדימה */}
        {isPreviewMode && (
          <View className="p-3 bg-yellow-500/20 border-b border-yellow-500/50">
            <Text className="text-yellow-400 text-center text-sm font-medium">
              מצב תצוגה מקדימה - התחברות מושבתת
            </Text>
          </View>
        )}

        <View className="flex-1 justify-center px-6">
          <View className="w-full">
            <Text
              className="text-white text-[32px] font-bold mb-2"
              style={{ textAlign: rtl.textAlign }}
            >
              התחבר לחשבון
            </Text>
            <Text
              className="text-zinc-400 text-base mb-8"
              style={{ textAlign: rtl.textAlign }}
            >
              ברוך שובך! אנא התחבר כדי להמשיך
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
                  placeholder="הזן סיסמה"
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

            {/* כפתור התחברות */}
            <TouchableOpacity
              className={`bg-sky-400 rounded-xl py-4 items-center ${loading || isPreviewMode ? 'opacity-60' : ''}`}
              onPress={onSignInPress}
              disabled={loading || isPreviewMode}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-bold">התחבר</Text>
              )}
            </TouchableOpacity>

            {/* קישור להרשמה */}
            <View className="flex-row justify-center gap-2 mt-6">
              {isPreviewMode ? (
                <TouchableOpacity disabled={true}>
                  <Text className="text-zinc-500 font-semibold text-base">
                    הירשם כאן
                  </Text>
                </TouchableOpacity>
              ) : (
                <Link href="/(auth)/sign-up" asChild={true}>
                  <TouchableOpacity>
                    <Text className="text-sky-400 font-semibold text-base">
                      הירשם כאן
                    </Text>
                  </TouchableOpacity>
                </Link>
              )}
              <Text className="text-zinc-400 text-base">
                עדיין אין לך חשבון?
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
