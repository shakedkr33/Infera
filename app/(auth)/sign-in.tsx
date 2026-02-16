import { useAuthActions } from '@convex-dev/auth/react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // התחברות עם Email + Password
  const onSignInPress = async () => {
    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא הזיני אימייל וסיסמה');
      return;
    }

    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
    } catch (err: unknown) {
      Alert.alert('שגיאה', 'ההתחברות נכשלה. ודאי שהאימייל והסיסמה נכונים');
    } finally {
      setLoading(false);
    }
  };

  // Google/Apple - לעתיד
  const onGooglePress = () => {
    Alert.alert('בקרוב', 'התחברות עם Google תהיה זמינה בקרוב! 🚀');
  };

  const onApplePress = () => {
    Alert.alert('בקרוב', 'התחברות עם Apple תהיה זמינה בקרוב! 🚀');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f6f7f8]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-start pt-16 px-6">
          {/* לוגו */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 bg-[#36a9e2]/10 rounded-full items-center justify-center mb-6">
              <Text className="text-[#36a9e2] text-5xl">🧠</Text>
            </View>
            <Text className="text-[#111517] text-3xl font-extrabold tracking-tight text-center">
              ברוכים הבאים ל-InYomi
            </Text>
          </View>

          {/* כפתור Google */}
          <TouchableOpacity
            className="w-full bg-white border border-[#e5e7eb] rounded-3xl h-14 px-5 flex-row items-center justify-center gap-3 mb-3"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
              elevation: 2,
            }}
            onPress={onGooglePress}
            activeOpacity={0.7}
          >
            <Image
              source={{
                uri: 'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9z_hELisAlapwE9LUPh6fcXIfb5vwpbMl4xl9H9TRFPc5NOO8Sb3VSgIBrfRYvW6cUA',
              }}
              style={{ width: 20, height: 20 }}
            />
            <Text className="text-[#111517] text-[17px] font-semibold">
              המשך עם Google
            </Text>
          </TouchableOpacity>

          {/* כפתור Apple */}
          <TouchableOpacity
            className="w-full bg-black rounded-3xl h-14 px-5 flex-row items-center justify-center gap-3 mb-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
              elevation: 2,
            }}
            onPress={onApplePress}
            activeOpacity={0.7}
          >
            <Text className="text-white text-2xl">🍎</Text>
            <Text className="text-white text-[17px] font-semibold">
              המשך עם Apple
            </Text>
          </TouchableOpacity>

          {/* מפריד "או" */}
          <View className="w-full flex-row items-center py-4">
            <View className="flex-1 h-px bg-[#d1d1d6]" />
            <Text className="text-[#8e8e93] text-[15px] font-medium mx-4">
              או
            </Text>
            <View className="flex-1 h-px bg-[#d1d1d6]" />
          </View>

          {/* שדה אימייל */}
          <View className="w-full mb-4">
            <Text className="text-[#8e8e93] text-sm font-semibold mb-2 text-right mr-1">
              אימייל
            </Text>
            <TextInput
              className="w-full bg-white border border-[#d1d1d6] rounded-3xl h-14 px-4 text-[#111517] text-base text-right"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#8e8e93"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* שדה סיסמה */}
          <View className="w-full mb-8">
            <Text className="text-[#8e8e93] text-sm font-semibold mb-2 text-right mr-1">
              סיסמה
            </Text>
            <TextInput
              className="w-full bg-white border border-[#d1d1d6] rounded-3xl h-14 px-4 text-[#111517] text-base text-right"
              value={password}
              onChangeText={setPassword}
              placeholder="לפחות 6 תווים"
              placeholderTextColor="#8e8e93"
              secureTextEntry={true}
              editable={!loading}
            />
          </View>

          {/* כפתור התחברות */}
          <TouchableOpacity
            className="w-full bg-[#36a9e2] rounded-3xl h-14 px-5 items-center justify-center mb-6"
            style={{
              shadowColor: '#36a9e2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
            onPress={onSignInPress}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-lg font-bold">התחברות</Text>
            )}
          </TouchableOpacity>

          {/* טיפ */}
          <Text className="text-[#8e8e93] text-xs text-center mt-2">
            💡 Google/Apple/Magic Link יהיו זמינים בקרוב
          </Text>
        </View>

        {/* סרגל תחתון iOS */}
        <View className="items-center pb-2">
          <View className="w-32 h-1.5 bg-gray-300 rounded-full" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
