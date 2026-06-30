// FIXED: title → "הגדרות"; logo aligned left; debug panel hidden behind long-press on version footer
import { useAuthActions } from '@convex-dev/auth/react';
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  APP_ENV,
  MOCK_PAYMENTS,
  PAYMENT_SYSTEM_ENABLED,
} from '@/config/appConfig';
import type { EffectiveAccess } from '@/config/devAccessConfig';
import {
  getDevPlanOverride,
  setDevPlanOverride,
  subscribeDevPlanOverride,
} from '@/config/devPlanOverride';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { api } from '@/convex/_generated/api';
import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import { getAvatarInitials } from '@/lib/avatarInitials';
import { APP_IS_RTL, needsExplicitRTL, rtl } from '@/lib/rtl';

const ANDROID_MATCH_IOS_LAYOUT = Platform.OS === 'android' && APP_IS_RTL;

declare const __DEV__: boolean;

// ============================================================================
// מסך פרופיל
// ============================================================================

export default function ProfileScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { signOut } = useAuthActions();
  const { isPremium, isConfigured, isExpoGo, customerData } = useRevenueCat();
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  // Debug panel is hidden in normal UI; revealed only by long-pressing the version footer
  const [isDebugUnlocked, setIsDebugUnlocked] = useState(false);

  // Dev-only: runtime plan override state (mirrors the global devPlanOverride store)
  const [devPlan, setDevPlanState] = useState<EffectiveAccess | null>(() =>
    getDevPlanOverride()
  );
  useEffect(() => {
    return subscribeDevPlanOverride(() => {
      setDevPlanState(getDevPlanOverride());
    });
  }, []);

  const {
    effectiveAccess,
    isTrialActive,
    isExpiredFree,
    isPersonal,
    isFamily,
    trialDaysRemaining,
  } = useEffectiveAccess();
  const { data: onboardingData } = useOnboarding();
  const rawFirstName = onboardingData.firstName ?? '';
  const rawLastName = onboardingData.lastName ?? '';
  const rawNickname = onboardingData.nickname ?? '';
  const displayName =
    rawNickname.trim() ||
    [rawFirstName, rawLastName].filter(Boolean).join(' ').trim() ||
    'המשתמש שלי';
  const avatarInitial =
    getAvatarInitials({
      firstName: rawFirstName,
      lastName: rawLastName,
      fullName: displayName,
    }) || 'מ';
  const avatarColor = onboardingData.personalColor || '#36a9e2';

  // ============================================================================
  // פעולות
  // ============================================================================

  const handleSignOut = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch {
              Alert.alert('שגיאה', 'אירעה שגיאה בהתנתקות');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ מחיקת חשבון',
      'האם אתה בטוח שברצונך למחוק את החשבון שלך?\n\nפעולה זו תמחק לצמיתות את:\n• פרטי החשבון שלך\n• כל הנתונים המשויכים אליך\n• היסטוריית השימוש שלך\n\n⚠️ לא ניתן לשחזר את הנתונים לאחר המחיקה!',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'המשך למחיקה',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '🚨 אישור סופי',
              'זוהי ההזדמנות האחרונה שלך לבטל!\n\nהחשבון שלך וכל הנתונים ימחקו לצמיתות ולא יהיה ניתן לשחזר אותם.\n\nהאם אתה בטוח לחלוטין?',
              [
                { text: 'ביטול - אל תמחק', style: 'cancel' },
                {
                  text: 'כן, מחק את החשבון',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMyAccount();
                      await signOut();
                      Alert.alert(
                        'החשבון נמחק',
                        'החשבון שלך נמחק בהצלחה. תודה שהשתמשת באפליקציה שלנו.'
                      );
                    } catch (_error) {
                      Alert.alert(
                        'שגיאה',
                        'אירעה שגיאה במחיקת החשבון. אנא נסה שוב או צור קשר עם התמיכה.'
                      );
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleClose = (): void => {
    const destination =
      returnTo && returnTo.length > 0 ? returnTo : '/(authenticated)';
    router.replace(destination as never);
  };

  // Debug-only preview helpers — only used inside IS_DEV_MODE block
  const openPaywallPreview = () => router.push('/(auth)/paywall?preview=true');
  const openSignInPreview = () => router.push('/(auth)/sign-in?preview=true');
  const openSignUpPreview = () => router.push('/(auth)/sign-up?preview=true');

  // ============================================================================
  // רינדור
  // ============================================================================

  return (
    <SafeAreaView style={[styles.safeArea, ANDROID_MATCH_IOS_LAYOUT ? styles.safeAreaRtl : null]} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Image
            source={require('@/assets/images/logo-inyomi.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="InYomi logo"
          />
          <View style={styles.headerRightGroup}>
            <Text style={styles.headerTitle}>הגדרות</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="סגור הגדרות"
              hitSlop={8}
            >
              <MaterialIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile card — tapping opens family-profile (profile management) */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(authenticated)/family-profile')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="עריכת פרופיל"
        >
          <View style={styles.profileRow}>
            <MaterialIcons name="chevron-left" size={22} color="#9ca3af" />
            <View style={styles.profileTexts}>
              <Text style={styles.profileName}>{displayName}</Text>
              {/* Subscription status — access-aware label */}
              <Text
                style={[
                  styles.profileSubtitle,
                  (isPersonal || isFamily) && styles.premiumLabel,
                ]}
              >
                {isTrialActive
                  ? 'גישה מלאה פעילה'
                  : isExpiredFree
                    ? 'מסלול חינמי'
                    : isPersonal
                      ? 'מנוי Plus פעיל'
                      : 'מנוי Family פעיל'}
              </Text>
              {isTrialActive && trialDaysRemaining !== null && (
                <Text style={styles.profileSubtitle}>
                  {trialDaysRemaining === 1
                    ? 'נותר לך יום אחד לגישה מלאה'
                    : `נותרו לך ${trialDaysRemaining} ימים לגישה מלאה`}
                </Text>
              )}
              {isExpiredFree && (
                <Text style={styles.profileSubtitle}>
                  {'קהילות נשארות פתוחות בחינם — תמיד.'}
                </Text>
              )}
              {isTrialActive && trialDaysRemaining !== null && (
                <Text style={styles.profileNote}>
                  {'אחרי זה אפשר להמשיך עם קהילות בחינם.'}
                </Text>
              )}
              {(isExpiredFree || isTrialActive) && (
                <TouchableOpacity
                  onPress={() => {
                    router.push('/(authenticated)/subscription' as never);
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="לשדרוג למנוי"
                  hitSlop={8}
                >
                  <Text style={styles.upgradeCta}>לשדרוג למנוי</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Section title */}
        <Text style={styles.sectionTitle}>הגדרות</Text>

        {/* Settings list — MVP structure */}
        <View style={[styles.card, styles.settingsCard]}>
          {/* Import flows */}
          <SettingsRow
            iconName="sync"
            label="העתקת אירועים מיומן חיצוני"
            onPress={() => router.push('/(authenticated)/import-calendar')}
          />
          {/* Notifications */}
          <SettingsRow
            iconName="notifications-none"
            label="התראות"
            onPress={() => console.log('TODO: notifications settings')}
          />
          {/* Recently Deleted */}
          <SettingsRow
            iconName="delete-outline"
            label="נמחקו לאחרונה"
            onPress={() => router.push('/(authenticated)/recently-deleted')}
          />
          <SettingsRow
            iconName="event"
            label="חגים ומועדים"
            note="בחירת חגים וימים מיוחדים להצגה ביומן"
            onPress={() =>
              router.push('/(authenticated)/holiday-overlay-settings')
            }
          />
          {/* Danger zone */}
          <SettingsRow
            iconName="delete-outline"
            label="מחיקת חשבון"
            danger
            onPress={handleDeleteAccount}
          />
          <SettingsRow
            iconName="logout"
            label="התנתקות"
            danger
            hideChevron
            isLast
            onPress={handleSignOut}
          />
        </View>

        {/* Debug panel — hidden by default; revealed by long-pressing the version footer */}
        {isDebugUnlocked && (
          <View style={styles.debugContainer}>
            <TouchableOpacity
              onPress={() => setIsDebugOpen(!isDebugOpen)}
              style={[
                styles.debugHeader,
                isDebugOpen ? styles.debugHeaderOpen : styles.debugHeaderClosed,
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="פתח/סגור פאנל דיבאג"
            >
              <MaterialIcons
                name="chevron-left"
                size={20}
                color="#eab308"
                style={{
                  transform: [{ rotate: isDebugOpen ? '-90deg' : '0deg' }],
                }}
              />
              <Text style={styles.debugHeaderText}>
                קונסולת דיבאג (מצב פיתוח)
              </Text>
              <MaterialIcons name="bug-report" size={20} color="#eab308" />
            </TouchableOpacity>

            {isDebugOpen && (
              <View style={styles.debugBody}>
                <Text style={styles.debugSectionLabel}>מצב אפליקציה</Text>
                <View style={styles.debugRows}>
                  <DebugRow label="סביבה" value={APP_ENV} />
                  <DebugRow
                    label="מערכת תשלומים"
                    value={PAYMENT_SYSTEM_ENABLED ? 'פעיל' : 'כבוי'}
                  />
                  <DebugRow
                    label="תשלומים מדומים"
                    value={MOCK_PAYMENTS ? 'פעיל' : 'כבוי'}
                  />
                  <DebugRow
                    label="RevenueCat מוגדר"
                    value={isConfigured ? 'כן' : 'לא'}
                  />
                  <DebugRow label="Expo Go" value={isExpoGo ? 'כן' : 'לא'} />
                  <DebugRow
                    label="סטטוס פרימיום"
                    value={isPremium ? 'פרימיום' : 'חינמי'}
                  />
                  <DebugRow label="effectiveAccess" value={effectiveAccess} />
                  <DebugRow label="Entitlement" value="InYomi Pro" />
                  {customerData && (
                    <DebugRow
                      label="App User ID"
                      value={customerData.appUserID.substring(0, 20)}
                    />
                  )}
                </View>
                <Text style={[styles.debugSectionLabel, { marginTop: 16 }]}>
                  בדיקות UI
                </Text>
                <View style={styles.debugRows}>
                  <DebugButton
                    iconName="credit-card"
                    label="פתח מסך תשלום (Preview)"
                    onPress={openPaywallPreview}
                  />
                  <DebugButton
                    iconName="login"
                    label="פתח מסך התחברות (Preview)"
                    onPress={openSignInPreview}
                  />
                  <DebugButton
                    iconName="person-add"
                    label="פתח מסך הרשמה (Preview)"
                    onPress={openSignUpPreview}
                  />
                </View>

                {/* Dev subscription plan selector — __DEV__ only */}
                {__DEV__ && (
                  <>
                    <Text style={[styles.debugSectionLabel, { marginTop: 16 }]}>
                      סימולציית מסלול מנוי (בדיקות בלבד)
                    </Text>
                    {devPlan !== null && (
                      <View style={styles.devOverrideBanner}>
                        <Text style={styles.devOverrideBannerText}>
                          {`⚠️ מצב בדיקה פעיל: ${
                            devPlan === 'trial_expired_free'
                              ? 'Free'
                              : devPlan === 'personal'
                                ? 'Plus'
                                : devPlan === 'family'
                                  ? 'Family'
                                  : devPlan
                          }`}
                        </Text>
                      </View>
                    )}
                    <View style={styles.devPlanRow}>
                      {(
                        [
                          { label: 'Free', value: 'trial_expired_free' },
                          { label: 'Plus', value: 'personal' },
                          { label: 'Family', value: 'family' },
                        ] as { label: string; value: EffectiveAccess }[]
                      ).map(({ label, value }) => (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setDevPlanOverride(value)}
                          style={[
                            styles.devPlanBtn,
                            devPlan === value && styles.devPlanBtnActive,
                          ]}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`הפעל סימולציית מסלול ${label}`}
                        >
                          <Text
                            style={[
                              styles.devPlanBtnText,
                              devPlan === value && styles.devPlanBtnTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        onPress={() => setDevPlanOverride(null)}
                        style={styles.devPlanBtnClear}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="איפוס סימולציית מסלול"
                      >
                        <Text style={styles.devPlanBtnClearText}>איפוס</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.devOverrideNote}>
                      {devPlan !== null
                        ? 'האיפוס יחזיר את לוגיקת הגישה האמיתית.'
                        : 'בחר מסלול לסימולציה. השינוי נשמר גם לאחר reload.'}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Version footer — long-press to unlock hidden debug panel */}
        <TouchableOpacity
          onLongPress={() => setIsDebugUnlocked((v) => !v)}
          delayLongPress={800}
          accessible={false}
        >
          <Text style={styles.footer}>InYomi v1.0.0</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// SettingsRow
// ============================================================================

function SettingsRow({
  iconName,
  label,
  onPress,
  danger = false,
  note,
  hideChevron = false,
  isLast = false,
}: {
  iconName: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  note?: string;
  hideChevron?: boolean;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, !isLast && styles.rowBorder]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* Chevron on the left */}
      {!hideChevron && (
        <MaterialIcons name="chevron-left" size={20} color="#d1d5db" />
      )}
      {/* Label + note in the middle */}
      <View
        style={[
          styles.rowTextContainer,
          hideChevron && styles.rowTextNoChevron,
        ]}
      >
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
        {note !== undefined && <Text style={styles.rowNote}>{note}</Text>}
      </View>
      {/* Icon on the right */}
      <MaterialIcons
        name={iconName as never}
        size={21}
        color={danger ? '#ef4444' : '#9ca3af'}
      />
    </TouchableOpacity>
  );
}

// ============================================================================
// Debug helpers
// ============================================================================

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugValue}>{value}</Text>
      <Text style={styles.debugLabel}>{label}</Text>
    </View>
  );
}

function DebugButton({
  iconName,
  label,
  onPress,
}: {
  iconName: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.debugButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name="chevron-left" size={16} color="#71717a" />
      <Text style={styles.debugButtonText}>{label}</Text>
      <MaterialIcons name={iconName as never} size={18} color="#4fc3f7" />
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7f8',
  },
  safeAreaRtl: {
    direction: 'rtl',
  },
  scroll: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 0,
    paddingRight: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLogo: {
    width: 220,
    height: 88,
    backgroundColor: 'transparent',
  },
  headerRightGroup: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsCard: {
    overflow: 'hidden',
  },

  // ── Profile card ───────────────────────────────────────────────────────────
  profileRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  profileTexts: {
    flex: 1,
    alignItems: needsExplicitRTL() ? 'flex-end' : 'flex-start',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111517',
    textAlign: rtl.textAlign,
  },
  profileSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: rtl.textAlign,
    marginTop: 2,
  },
  premiumLabel: {
    color: '#36a9e2',
    fontWeight: '600',
  },
  profileNote: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: rtl.textAlign,
    marginTop: 2,
  },
  upgradeCta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#36a9e2',
    textAlign: rtl.textAlign,
    marginTop: 4,
  },

  // ── Section title ──────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 8,
    textAlign: rtl.textAlign,
  },

  // ── Settings rows ──────────────────────────────────────────────────────────
  row: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowTextContainer: {
    flex: 1,
    ...(needsExplicitRTL() ? { marginRight: 12 } : { marginStart: 12 }),
    alignItems: needsExplicitRTL() ? 'flex-end' : 'flex-start',
  },
  rowTextNoChevron: {
    marginRight: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111517',
    textAlign: rtl.textAlign,
  },
  rowLabelDanger: {
    color: '#ef4444',
  },
  rowNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: rtl.textAlign,
    marginTop: 2,
  },

  // ── Debug panel ────────────────────────────────────────────────────────────
  debugContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  debugHeaderOpen: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  debugHeaderClosed: {
    borderRadius: 20,
  },
  debugHeaderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#eab308',
    textAlign: rtl.textAlign,
  },
  debugBody: {
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  debugSectionLabel: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: rtl.textAlign,
    marginBottom: 8,
  },
  debugRows: {
    gap: 8,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  debugValue: {
    fontSize: 13,
    color: '#374151',
  },
  debugLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  debugButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#111517',
    textAlign: rtl.textAlign,
  },

  // ── Dev banner ─────────────────────────────────────────────────────────────
  devBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  devBannerText: {
    color: '#eab308',
    textAlign: 'center',
    fontSize: 14,
  },

  // ── Dev plan override selector ──────────────────────────────────────────────
  devOverrideBanner: {
    backgroundColor: '#fef9c3',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde047',
    alignItems: 'center',
  },
  devOverrideBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#854d0e',
    textAlign: 'center',
  },
  devPlanRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  devPlanBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  devPlanBtnActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  devPlanBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  devPlanBtnTextActive: {
    color: '#1d4ed8',
  },
  devPlanBtnClear: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  devPlanBtnClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  devOverrideNote: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    fontSize: 12,
    color: '#d1d5db',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
});
