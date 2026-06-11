import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { PACKAGE_IDS } from '@/utils/revenueCatConfig';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';
const PRIMARY_LIGHT = '#eaf6fd';
const BG = '#f8fafb';
const TEXT_DARK = '#1a1a2e';
const TEXT_MUTED = '#6b7280';
const CARD_BG = '#ffffff';
const BORDER = '#e5e7eb';
const LAUNCH_PRICE_COLOR = '#D88A00';
const GIFT_DELAY_MS = 1200;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type PlanType = 'personal' | 'family';
type BillingCycle = 'monthly' | 'annual';
type FeatureItem = { bold: string; rest: string };

// ─── Pricing Data ──────────────────────────────────────────────────────────────

const PRICING = {
  personal: {
    monthly: 25,
    annualRegular: 240,
    annualLaunch: 120,
  },
  family: {
    monthly: 39,
    annualRegular: 370,
    annualLaunch: 185,
  },
} as const;

const PLAN_NAMES: Record<PlanType, string> = {
  personal: 'אישי',
  family: 'משפחתי',
};

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  personal: 'לניהול האירועים, המשימות והתזכורות האישיות שלך.',
  family: 'לניהול משותף של הבית, בני המשפחה, המשימות והיומן.',
};

const PERSONAL_FEATURES: FeatureItem[] = [
  { bold: 'יומן אישי', rest: 'בתצוגה חודשית וציר זמן דינמי' },
  { bold: 'אירועים, משימות ותזכורות', rest: 'אישיות' },
  { bold: 'תתי-משימות מובנות', rest: 'בתוך אירועים ומשימות' },
  { bold: 'המידע שלך נשמר', rest: 'וזמין לצפייה גם בלי מנוי' },
];

const FAMILY_FEATURES: FeatureItem[] = [
  { bold: 'עד 6 בני משפחה', rest: 'מחוברים' },
  { bold: 'ילדים או בני משפחה', rest: 'בלי טלפון — אפשר להוסיף ידנית' },
  { bold: 'עד 5 חיות מחמד', rest: 'בפרופיל המשפחתי' },
  { bold: 'יומן ומשימות', rest: 'משפחתיים' },
  { bold: 'שיתוף תפקידים ומשימות', rest: 'בבית' },
];

const TOOLTIPS: Record<string, string> = {
  'עד 6 בני משפחה מחוברים':
    'המנוי המשפחתי מחבר עד 6 בני משפחה עם חשבון משלהם. ילדים או בני משפחה בלי טלפון — אפשר להוסיף ידנית, והם לא נספרים במכסה.',
  'עד 5 חיות מחמד בפרופיל המשפחתי':
    'אפשר להוסיף עד 5 חיות מחמד לפרופיל המשפחתי — בנוסף ל־6 בני המשפחה, בלי לתפוס מקום במכסה.',
};

// ─── Package Mapping ────────────────────────────────────────────────────────────

const PACKAGE_MAP: Record<PlanType, Record<BillingCycle, string>> = {
  personal: {
    monthly: PACKAGE_IDS.personalMonthly,
    annual: PACKAGE_IDS.personalAnnual,
  },
  family: {
    monthly: PACKAGE_IDS.familyMonthly,
    annual: PACKAGE_IDS.familyAnnual,
  },
};

function getSelectedPackageId(plan: PlanType, cycle: BillingCycle): string {
  return PACKAGE_MAP[plan][cycle];
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { packages, purchasePackage, restorePurchases, isConfigured } =
    useRevenueCat();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('family');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [launchGiftVisible, setLaunchGiftVisible] = useState(false);
  const [launchGiftActivated, setLaunchGiftActivated] = useState(false);
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);

  const giftSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setLaunchGiftVisible(true);
    }, GIFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (launchGiftVisible) {
      Animated.spring(giftSheetY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 110,
      }).start();
    } else {
      Animated.timing(giftSheetY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [launchGiftVisible, giftSheetY]);

  const handleActivateLaunchGift = () => {
    setLaunchGiftActivated(true);
    setLaunchGiftVisible(false);
  };

  const handleDismissGift = () => {
    setLaunchGiftVisible(false);
  };

  const handleCheckout = async (): Promise<void> => {
    if (!isConfigured) {
      Alert.alert('תשלומים', 'התשלומים אינם זמינים כרגע. אפשר לנסות שוב מאוחר יותר.');
      return;
    }

    const packageId = getSelectedPackageId(selectedPlan, billingCycle);

    const packageExists = packages.some((p) => p.identifier === packageId);
    if (!packageExists) {
      Alert.alert('תשלומים', 'המסלול שבחרת לא זמין כרגע. אפשר לנסות שוב מאוחר יותר.');
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePackage(packageId);
      if (success) {
        Alert.alert('הצלחה', 'הרכישה הושלמה בהצלחה! 🎉', [
          { text: 'אישור', onPress: () => router.back() },
        ]);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        router.back();
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleContinueFree = (): void => {
    router.back();
  };

  const pricing = PRICING[selectedPlan];
  const features =
    selectedPlan === 'personal' ? PERSONAL_FEATURES : FAMILY_FEATURES;

  const showLaunchPrice = launchGiftActivated && billingCycle === 'annual';
  const annualPrice = showLaunchPrice
    ? pricing.annualLaunch
    : pricing.annualRegular;
  const renewalText =
    billingCycle === 'annual'
      ? `לאחר השנה הראשונה: ₪${pricing.annualRegular} לשנה`
      : undefined;

  const ctaText =
    billingCycle === 'monthly' ? 'להמשיך עם מנוי חודשי' : 'להמשיך עם מנוי שנתי';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={s.backButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          hitSlop={12}
        >
          <MaterialIcons
            name={Platform.OS === 'ios' ? 'arrow-forward-ios' : 'arrow-forward'}
            size={22}
            color={TEXT_DARK}
          />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={s.title}>סוף סוף הכל במקום אחד</Text>
        <Text style={s.subtitle}>
          InYomi עוזרת לנהל את הבית, המשימות והקהילות — בלי עומס מיותר.
        </Text>

        {/* Free community message */}
        <View style={s.freeMessageContainer}>
          <MaterialIcons name="groups" size={20} color={PRIMARY} />
          <Text style={s.freeMessageText}>קהילות נשארות חינם — תמיד.</Text>
        </View>

        {/* Plan Tabs */}
        <View style={s.tabsRow}>
          <PlanTab
            label="אישי"
            active={selectedPlan === 'personal'}
            onPress={() => setSelectedPlan('personal')}
          />
          <PlanTab
            label="משפחתי"
            active={selectedPlan === 'family'}
            onPress={() => setSelectedPlan('family')}
          />
        </View>

        {/* Plan Card */}
        <View style={s.planCard}>
          <Text style={s.planName}>{PLAN_NAMES[selectedPlan]}</Text>
          <Text style={s.planDescription}>
            {PLAN_DESCRIPTIONS[selectedPlan]}
          </Text>

          {/* Billing Toggle — compact, inside card */}
          <View style={s.billingToggle}>
            <Pressable
              style={[
                s.billingToggleOption,
                billingCycle === 'monthly' && s.billingToggleOptionActive,
              ]}
              onPress={() => setBillingCycle('monthly')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ selected: billingCycle === 'monthly' }}
              accessibilityLabel="תשלום חודשי"
            >
              <Text
                style={[
                  s.billingToggleText,
                  billingCycle === 'monthly' && s.billingToggleTextActive,
                ]}
              >
                חודשי
              </Text>
            </Pressable>
            <Pressable
              style={[
                s.billingToggleOption,
                billingCycle === 'annual' && s.billingToggleOptionActive,
              ]}
              onPress={() => setBillingCycle('annual')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ selected: billingCycle === 'annual' }}
              accessibilityLabel="תשלום שנתי"
            >
              <Text
                style={[
                  s.billingToggleText,
                  billingCycle === 'annual' && s.billingToggleTextActive,
                ]}
              >
                שנתי
              </Text>
            </Pressable>
          </View>

          {/* Price */}
          <View style={s.priceSection}>
            {billingCycle === 'monthly' ? (
              <View style={s.priceRow}>
                <Text style={s.priceMain}>₪{pricing.monthly}</Text>
                <Text style={s.pricePeriod}>לחודש</Text>
              </View>
            ) : (
              <View>
                <View style={s.priceRow}>
                  {showLaunchPrice && (
                    <Text style={s.priceStrikethrough}>
                      ₪{pricing.annualRegular}
                    </Text>
                  )}
                  <Text style={[s.priceMain, showLaunchPrice && s.priceLaunch]}>
                    ₪{annualPrice}
                  </Text>
                  <Text style={s.pricePeriod}>לשנה</Text>
                </View>
                {showLaunchPrice && (
                  <Text style={s.discountLine}>כולל 50% הנחה לשנה הראשונה</Text>
                )}
                {showLaunchPrice && renewalText && (
                  <Text style={s.renewalText}>{renewalText}</Text>
                )}
              </View>
            )}

            {/* Monthly helpers for family */}
            {selectedPlan === 'family' && billingCycle === 'monthly' && (
              <Text style={s.helperText}>כ־₪6.50 למשתמש מחובר</Text>
            )}
            {selectedPlan === 'family' && billingCycle === 'annual' && (
              <View style={s.helperBlock}>
                <Text style={s.helperText}>כ־₪31 למשתמש מחובר בשנה</Text>
                <Text style={s.helperText}>כ־₪2.60 לחודש למשתמש מחובר</Text>
              </View>
            )}

            {/* Launch gift reopen CTA */}
            {billingCycle === 'annual' &&
              !launchGiftActivated &&
              !launchGiftVisible && (
                <Pressable
                  style={s.launchGiftReopenCta}
                  onPress={() => setLaunchGiftVisible(true)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="להפעיל את מתנת ההשקה"
                >
                  <MaterialIcons
                    name="card-giftcard"
                    size={16}
                    color={PRIMARY}
                  />
                  <Text style={s.launchGiftReopenText}>
                    להפעיל את מתנת ההשקה
                  </Text>
                </Pressable>
              )}
          </View>

          {/* Features */}
          <View style={s.featuresList}>
            {selectedPlan === 'family' && (
              <Text style={s.familyLeadIn}>
                כל הפיצ׳רים של המנוי האישי — ועוד:
              </Text>
            )}
            {features.map((item) => {
              const fullText = `${item.bold} ${item.rest}`;
              const tooltip = TOOLTIPS[fullText];
              return (
                <View key={item.bold} style={s.featureRow}>
                  <View style={s.featureItemRow}>
                    <MaterialIcons name="check" size={18} color={PRIMARY} />
                    <View style={s.featureTextRow}>
                      <Text style={s.featureText}>
                        <Text style={s.featureBold}>{item.bold}</Text>{' '}
                        {item.rest}
                      </Text>
                      {tooltip && (
                        <Pressable
                          onPress={() =>
                            setTooltipVisible(
                              tooltipVisible === fullText ? null : fullText
                            )
                          }
                          hitSlop={8}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel="מידע נוסף"
                        >
                          <MaterialIcons
                            name="info-outline"
                            size={16}
                            color={PRIMARY}
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  {tooltipVisible === fullText && tooltip && (
                    <View style={s.tooltip}>
                      <Text style={s.tooltipText}>{tooltip}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Coupon */}
        <Pressable
          style={s.couponLink}
          onPress={() => setCouponExpanded(!couponExpanded)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="יש לך קוד קופון?"
        >
          <Text style={s.couponLinkText}>יש לך קוד קופון?</Text>
          <MaterialIcons
            name={couponExpanded ? 'expand-less' : 'expand-more'}
            size={20}
            color={PRIMARY}
          />
        </Pressable>

        {couponExpanded && (
          <View style={s.couponInputRow}>
            <Pressable
              style={s.couponApplyBtn}
              onPress={() => console.log('TODO: Apply coupon in Phase 3C')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="החלה"
            >
              <Text style={s.couponApplyText}>החלה</Text>
            </Pressable>
            <TextInput
              style={s.couponInput}
              placeholder="הכניסו קוד קופון"
              placeholderTextColor="#9ca3af"
              textAlign="right"
            />
          </View>
        )}

        {/* CTA */}
        <Pressable
          style={[s.primaryCta, isPurchasing && s.primaryCtaDisabled]}
          onPress={handleCheckout}
          disabled={isPurchasing}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={ctaText}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.primaryCtaText}>{ctaText}</Text>
          )}
        </Pressable>

        {/* Secondary CTA */}
        <Pressable
          style={s.secondaryCta}
          onPress={handleContinueFree}
          disabled={isPurchasing}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="להמשיך עם הקהילות בחינם"
        >
          <Text style={s.secondaryCtaText}>להמשיך עם הקהילות בחינם</Text>
        </Pressable>

        {/* Restore purchases */}
        <Pressable
          style={s.secondaryCta}
          onPress={handleRestore}
          disabled={isRestoring || isPurchasing}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="כבר רכשת בעבר? שחזר/י את הרכישה כאן"
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={TEXT_MUTED} />
          ) : (
            <Text style={s.secondaryCtaText}>כבר רכשת בעבר? שחזר/י את הרכישה כאן</Text>
          )}
        </Pressable>

        {/* Free-tier explanation */}
        <Text style={s.freeCtaHint}>
          רוצים להתחיל בקטן? אפשר להמשיך עם הקהילות בחינם, בלי מנוי.
        </Text>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerTitle}>מה נשאר בחינם?</Text>
          <Text style={s.footerBody}>
            קהילות, אירועי קהילה, אישורי הגעה ומשימות קהילה — חינם לנצח. תכונות
            אישיות ומשפחתיות מלאות זמינות במנוי.
          </Text>
        </View>
      </ScrollView>

      {/* Launch Gift Bottom Sheet */}
      <LaunchGiftSheet
        visible={launchGiftVisible}
        translateY={giftSheetY}
        onActivate={handleActivateLaunchGift}
        onDismiss={handleDismissGift}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PlanTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.tab, active && s.tabActive]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`מנוי ${label}`}
    >
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LaunchGiftSheet({
  visible,
  translateY,
  onActivate,
  onDismiss,
}: {
  visible: boolean;
  translateY: Animated.Value;
  onActivate: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={s.giftOverlay}>
        <Pressable
          style={s.giftBackdrop}
          onPress={onDismiss}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="סגור"
        />
        <Animated.View
          style={[
            s.giftSheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={s.giftHandle} />

          <View style={s.giftContent}>
            <MaterialIcons name="card-giftcard" size={36} color={PRIMARY} />
            <Text style={s.giftTitle}>מתנת השקה מחכה לך</Text>
            <Text style={s.giftBody}>
              כחלק ממשתמשי ההשקה הראשונים של InYomi, קיבלת 50% הנחה לשנה
              הראשונה.
            </Text>

            <Pressable
              style={s.giftPrimaryCta}
              onPress={onActivate}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="להפעיל את מחיר ההשקה"
            >
              <Text style={s.giftPrimaryCtaText}>להפעיל את מחיר ההשקה</Text>
            </Pressable>

            <Pressable
              style={s.giftSecondaryCta}
              onPress={onDismiss}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="אולי אחר כך"
            >
              <Text style={s.giftSecondaryCtaText}>אולי אחר כך</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BG,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Title
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
    marginBottom: 16,
  },

  // Free message
  freeMessageContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  freeMessageText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  tabActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: '#ffffff',
  },

  // Billing toggle (compact segmented control inside plan card)
  billingToggle: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  billingToggleOption: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  billingToggleOptionActive: {
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  billingToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  billingToggleTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },

  // Plan card
  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
    marginBottom: 16,
  },

  // Price
  priceSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
  },
  priceMain: {
    fontSize: 28,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  priceStrikethrough: {
    fontSize: 16,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginLeft: 4,
  },
  priceLaunch: {
    color: LAUNCH_PRICE_COLOR,
  },
  discountLine: {
    fontSize: 13,
    fontWeight: '700',
    color: LAUNCH_PRICE_COLOR,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  renewalText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  helperBlock: {
    marginTop: 6,
  },

  // Launch gift reopen
  launchGiftReopenCta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef9e7',
    alignSelf: 'flex-end',
  },
  launchGiftReopenText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },

  // Features
  featuresList: {
    gap: 12,
  },
  familyLeadIn: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  featureRow: {
    gap: 6,
  },
  featureItemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  featureTextRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  featureBold: {
    fontWeight: '800',
    color: TEXT_DARK,
  },
  tooltip: {
    marginTop: 2,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 10,
  },
  tooltipText: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },

  // Coupon
  couponLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: 8,
    paddingVertical: 6,
  },
  couponLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  couponInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  couponInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TEXT_DARK,
    backgroundColor: CARD_BG,
    writingDirection: 'rtl',
  },
  couponApplyBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_LIGHT,
  },
  couponApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },

  // CTAs
  primaryCta: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryCtaDisabled: {
    opacity: 0.6,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
  },
  secondaryCta: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
    textAlign: 'right',
  },
  freeCtaHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
    marginBottom: 24,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 20,
    marginTop: 8,
  },
  footerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  footerBody: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
  },

  // Launch gift sheet
  giftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  giftBackdrop: {
    flex: 1,
  },
  giftSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  giftHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  giftContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  giftTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  giftBody: {
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    writingDirection: 'rtl',
  },
  giftPrimaryCta: {
    width: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  giftPrimaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  giftSecondaryCta: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  giftSecondaryCtaText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
});
