import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoogleCalendarAuth } from '../../lib/hooks/useGoogleCalendarAuth';

const PRIMARY = '#36a9e2';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ImportCalendarScreen(): React.JSX.Element {
  const router = useRouter();
  const { status, errorMessage, startAuthorization, clearAuthorization } =
    useGoogleCalendarAuth();

  // Clear authorization state when the user navigates away from this screen.
  // useFocusEffect cleanup fires on navigation blur, not on component unmount
  // alone — important for Expo Router where screens may stay mounted in the stack.
  //
  // This does NOT fire when the iOS OAuth browser (ASWebAuthenticationSession)
  // opens, because that is a modal overlay that does not change React Navigation
  // screen focus. In-progress authorization is therefore never interrupted here.
  useFocusEffect(
    useCallback(() => {
      return () => {
        clearAuthorization();
      };
    }, [clearAuthorization]),
  );

  const isLoading = status === 'authorizing' || status === 'exchanging';

  const loadingLabel =
    status === 'authorizing' ? 'פותח חלון אישור...' : 'מאמת גישה...';

  return (
    <SafeAreaView style={s.screen}>
      {/* Custom header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="חזור"
        >
          <MaterialIcons name="arrow-forward-ios" size={20} color="#1e293b" />
        </Pressable>
        <Text style={s.headerTitle}>העתקת אירועים</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Idle: initial CTA ──────────────────────────────────────────────── */}
      {status === 'idle' && (
        <View style={s.centerStep}>
          <View style={s.googleIconWrap}>
            <View style={s.googleCircle}>
              <Text style={s.googleLetter}>G</Text>
            </View>
          </View>

          <Text style={s.mainTitle}>העתקת אירועים מ-Google</Text>
          <Text style={s.subtitle}>
            {'ניצור עותק של האירועים שתבחרי ב\u2011InYomi.\nהיומן המקורי לא ישתנה.'}
          </Text>

          <Pressable
            style={s.primaryBtn}
            onPress={startAuthorization}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="המשך ל-Google לאישור גישה ליומן"
          >
            <View style={s.googleBtnIcon}>
              <Text style={s.googleLetter}>G</Text>
            </View>
            <Text style={s.primaryBtnText}>המשך ל־Google</Text>
          </Pressable>

          <View style={s.scopeNote}>
            <MaterialIcons name="lock" size={14} color="#94a3b8" />
            <Text style={s.scopeNoteText}>גישה לקריאה בלבד · לא נשמרת סיסמה</Text>
          </View>
        </View>
      )}

      {/* ─── Authorizing / exchanging: loading ──────────────────────────────── */}
      {isLoading && (
        <View style={s.centerStep}>
          <View style={s.googleIconWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
          <Text style={s.mainTitle}>{loadingLabel}</Text>
        </View>
      )}

      {/* ─── Authorized: success confirmation ───────────────────────────────── */}
      {status === 'authorized' && (
        <View style={s.centerStep}>
          <View style={s.successIconWrap}>
            <MaterialIcons name="check-circle" size={56} color="#22c55e" />
          </View>

          <Text style={s.mainTitle}>הגישה לקריאה ביומן אושרה</Text>
          <Text style={s.subtitle}>היומן המקורי לא השתנה.</Text>

          <Pressable
            style={s.secondaryBtn}
            onPress={clearAuthorization}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="חזור לתחילת התהליך"
          >
            <Text style={s.secondaryBtnText}>חזור</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Denied or error: message + retry ───────────────────────────────── */}
      {(status === 'denied' || status === 'error') && (
        <View style={s.centerStep}>
          <View style={s.errorIconWrap}>
            <MaterialIcons name="error-outline" size={56} color="#f59e0b" />
          </View>

          <Text style={s.errorText}>{errorMessage}</Text>

          <Pressable
            style={s.primaryBtn}
            onPress={clearAuthorization}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="נסי שוב"
          >
            <Text style={s.primaryBtnText}>נסי שוב</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f8' },
  // Header
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  // ─── Shared center layout ────────────────────────────────
  centerStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  googleIconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  googleCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  googleLetter: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4285F4',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  // ─── Primary button ──────────────────────────────────────
  primaryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  // ─── Scope note ──────────────────────────────────────────
  scopeNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scopeNoteText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  // ─── Success state ───────────────────────────────────────
  successIconWrap: {
    marginBottom: 8,
  },
  secondaryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginTop: 8,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  // ─── Error/denied state ──────────────────────────────────
  errorIconWrap: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
});
