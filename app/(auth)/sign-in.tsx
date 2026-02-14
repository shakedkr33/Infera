import { useAuthActions } from '@convex-dev/auth/react';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
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
} from 'react-native'; // SafeAreaView לא כאן
import { SafeAreaView } from 'react-native-safe-area-context'; // רק כאן

export default function SignUpScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSignUpPress = async () => {
    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }
    setLoading(true);
    try {
      // הרשמה ב-Convex Auth מתבצעת בדרך כלל עם flow: 'signUp'
      await signIn('password', { email, password, flow: 'signUp' });
      router.replace('/onboarding-premium'); // מעבר לפיוול אחרי התחברות
    } catch (err: unknown) {
      Alert.alert('שגיאה', 'ההרשמה נכשלה. ייתכן שהמשתמש כבר קיים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          <View className="w-full">
            <Text className="text-white text-[32px] font-bold mb-2 text-right">
              יצירת חשבון
            </Text>
            <Text className="text-zinc-400 text-base mb-8 text-right">
              הצטרפי ל-InYomi והתחילי לסדר את היום
            </Text>

            <View className="mb-5">
              <Text className="text-white text-sm font-medium mb-2 text-right">
                כתובת אימייל
              </Text>
              <TextInput
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-base text-right"
                value={email}
                onChangeText={setEmail}
                placeholder="example@gmail.com"
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-5">
              <Text className="text-white text-sm font-medium mb-2 text-right">
                סיסמה
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-12 text-white text-base text-right"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="בחרי סיסמה חזקה"
                  placeholderTextColor="#52525b"
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#71717a" />
                  ) : (
                    <Eye size={20} color="#71717a" />
                  )}
                </Pressable>
              </View>
            </View>

            <TouchableOpacity
              className={`bg-sky-400 rounded-xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
              onPress={onSignUpPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-bold">צרי חשבון</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center gap-2 mt-6">
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text className="text-sky-400 font-semibold text-base">
                    התחברי כאן
                  </Text>
                </TouchableOpacity>
              </Link>
              <Text className="text-zinc-400 text-base">כבר יש לך חשבון?</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}