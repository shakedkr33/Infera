import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseIsraeliPhone } from '@/lib/phoneUtils';

export default function PhoneInputScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Validate and send OTP — errors only shown after user taps continue
  const handleContinue = async () => {
    // Guard: duplicate submit
    if (isLoading) return;

    const normalized = parseIsraeliPhone(phone.trim());
    if (!normalized) {
      setError('מספר הטלפון לא תקין. אנא הזיני מספר ישראלי בפורמט 05X-XXXXXXX.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn('phone', { phone: normalized });
      // Navigate to verification screen, passing the normalized number as param
      router.push({
        pathname: '/(auth)/verify',
        params: { phone: normalized },
      });
    } catch (err) {
      console.error('[Auth] Failed to send OTP:', err);
      setError('לא הצלחנו לשלוח קוד. בדקי את החיבור לאינטרנט ונסי שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasInput = phone.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* כותרות */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>מה מספר הטלפון שלך?</Text>
            <Text style={styles.subtitle}>
              נשלח לך קוד אימות כדי להיכנס
            </Text>
          </View>

          {/* שדה טלפון */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>מספר טלפון</Text>
            <TextInput
              ref={inputRef}
              style={[styles.input, error ? styles.inputError : null]}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                // Clear error as soon as user starts editing again
                if (error) setError(null);
              }}
              placeholder="050-123-4567"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              autoFocus
              textAlign="right"
              accessible={true}
              accessibilityLabel="מספר טלפון"
              accessibilityHint="הזיני מספר טלפון ישראלי"
            />
            {error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>

          {/* כפתור המשך */}
          <Pressable
            onPress={handleContinue}
            style={[
              styles.continueBtn,
              (!hasInput || isLoading) && styles.continueBtnDisabled,
            ]}
            disabled={!hasInput || isLoading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="המשך"
            accessibilityHint="שלח קוד אימות לטלפון"
            accessibilityState={{ disabled: !hasInput || isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueBtnText}>המשך</Text>
            )}
          </Pressable>

          {/* הסבר בתחתית */}
          <Text style={styles.disclaimer}>
            בהמשך את מאשרת את תנאי השימוש ומדיניות הפרטיות של InYomi
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerBlock: {
    marginTop: 24,
    marginBottom: 40,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111418',
    textAlign: 'right',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'right',
  },
  inputBlock: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#111418',
    backgroundColor: '#f9fafb',
    textAlign: 'right',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'right',
  },
  continueBtn: {
    height: 56,
    backgroundColor: '#4A9FE2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A9FE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: {
    backgroundColor: '#bfdbfe',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
