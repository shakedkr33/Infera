// ============================================================================
// קונטקסט REVENUECAT - InYomi
// ============================================================================
// ספק RevenueCat מלא עם תמיכה ב:
// - Expo Go (תצוגה מקדימה ללא רכישות מקוריות)
// - Development builds עם Test Store key
// - Production builds עם מפתחות iOS/Android
// - RevenueCat Paywall (native UI)
// - Customer Center (ניהול מנויים)
// - Two-tier entitlement model: "personal" and "family"

import Constants from 'expo-constants';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';

import { MOCK_PAYMENTS, PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import {
  ENTITLEMENT_ID,
  FAMILY_ENTITLEMENT_ID,
  getCurrentPlatformRevenueCatApiKey,
  isRevenueCatConfigured,
  PERSONAL_ENTITLEMENT_ID,
  type SubscriptionTier,
} from '@/utils/revenueCatConfig';

// ============================================================================
// טיפוסים
// ============================================================================

// מבנה מידע על חבילת מנוי
export type PackageInfo = {
  identifier: string;
  priceString: string;
  price: number;
  currencyCode: string;
  title: string;
  description: string;
  packageType: 'monthly' | 'annual' | 'lifetime' | 'unknown';
};

// מידע מלא על הלקוח
export type CustomerData = {
  appUserID: string;
  activeEntitlements: string[];
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate: string | null;
  firstSeen: string | null;
  managementURL: string | null;
};

// ============================================================================
// DEBUG ONLY — remove after TestFlight investigation
// ============================================================================
export type RevenueCatDebugInfo = {
  initError: string | null;
  offeringsCurrentId: string | null;
  offeringsPackagesCount: number | null;
  usingPreviewPackages: boolean;
  apiKeyPrefix: string | null; // first 12 chars + *** mask
};

// מבנה הקונטקסט
type RevenueCatContextType = {
  // מצב
  isLoading: boolean;
  isPremium: boolean;
  isConfigured: boolean;
  isExpoGo: boolean;

  // Two-tier subscription state
  subscriptionTier: SubscriptionTier;
  isPersonal: boolean;
  isFamily: boolean;

  // חבילות זמינות
  packages: PackageInfo[];

  // מידע על הלקוח
  customerData: CustomerData | null;

  // פעולות רכישה
  purchasePackage: (packageId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshPurchaserInfo: () => Promise<void>;

  // RevenueCat UI - Paywall
  presentPaywall: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;

  // RevenueCat UI - Customer Center
  presentCustomerCenter: () => Promise<void>;

  // DEBUG ONLY — remove after TestFlight investigation
  _debug: RevenueCatDebugInfo;
};

// ============================================================================
// חבילות ברירת מחדל לתצוגה מקדימה
// ============================================================================

const PREVIEW_PACKAGES: PackageInfo[] = [
  {
    identifier: '$rc_monthly',
    priceString: '₪9.99/חודש',
    price: 9.99,
    currencyCode: 'ILS',
    title: 'מנוי חודשי',
    description: 'גישה מלאה לכל התכונות',
    packageType: 'monthly',
  },
  {
    identifier: '$rc_annual',
    priceString: '₪69.99/שנה',
    price: 69.99,
    currencyCode: 'ILS',
    title: 'מנוי שנתי',
    description: 'חסכון של 40% לעומת מנוי חודשי',
    packageType: 'annual',
  },
  {
    identifier: '$rc_lifetime',
    priceString: '₪199.99',
    price: 199.99,
    currencyCode: 'ILS',
    title: 'רכישה לצמיתות',
    description: 'גישה מלאה לכל החיים - תשלום חד-פעמי',
    packageType: 'lifetime',
  },
];

// ============================================================================
// פונקציות עזר
// ============================================================================

/**
 * בדיקה האם רצים ב-Expo Go
 */
function isRunningInExpoGo(): boolean {
  try {
    return Constants.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
}

/**
 * Derives the subscription tier from RevenueCat customerInfo entitlements.
 * Priority: family wins if both personal and family are active.
 */
function getSubscriptionTierFromCustomerInfo(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}): SubscriptionTier {
  if (customerInfo.entitlements.active[FAMILY_ENTITLEMENT_ID] !== undefined) {
    return 'family';
  }
  if (customerInfo.entitlements.active[PERSONAL_ENTITLEMENT_ID] !== undefined) {
    return 'personal';
  }
  return null;
}

/**
 * Legacy backward-compatible check. Returns true if ANY paid entitlement
 * is active (personal, family, or legacy "InYomi Pro").
 */
function checkHasPremium(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}): boolean {
  return (
    getSubscriptionTierFromCustomerInfo(customerInfo) !== null ||
    customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined
  );
}

/**
 * מיפוי סוג חבילה מ-RevenueCat ל-PackageType שלנו
 */
function mapPackageType(
  type: string
): 'monthly' | 'annual' | 'lifetime' | 'unknown' {
  switch (type) {
    case 'MONTHLY':
      return 'monthly';
    case 'ANNUAL':
      return 'annual';
    case 'LIFETIME':
      return 'lifetime';
    default:
      return 'unknown';
  }
}

// ============================================================================
// קונטקסט
// ============================================================================

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(
  undefined
);

// ============================================================================
// ספק (Provider)
// ============================================================================

export function RevenueCatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>(null);
  const [packages, setPackages] = useState<PackageInfo[]>(PREVIEW_PACKAGES);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  // DEBUG ONLY — remove after TestFlight investigation
  const [_debugInfo, _setDebugInfo] = useState<RevenueCatDebugInfo>({
    initError: null,
    offeringsCurrentId: null,
    offeringsPackagesCount: null,
    usingPreviewPackages: true,
    apiKeyPrefix: null,
  });

  const isExpoGo = isRunningInExpoGo();
  const isConfigured = isRevenueCatConfigured();
  const listenerRef = useRef<(() => void) | null>(null);

  // ============================================================================
  // עדכון נתוני לקוח מ-CustomerInfo
  // ============================================================================

  const updateCustomerData = useCallback(
    async (customerInfo: {
      entitlements: { active: Record<string, unknown> };
      activeSubscriptions: string[];
      allPurchasedProductIdentifiers: string[];
      latestExpirationDate: string | null;
      firstSeen: string;
      managementURL: string | null;
    }) => {
      const hasPremium = checkHasPremium(customerInfo);
      setIsPremium(hasPremium);

      const tier = getSubscriptionTierFromCustomerInfo(customerInfo);
      setSubscriptionTier(tier);

      try {
        const Purchases = (await import('react-native-purchases')).default;
        const appUserID = await Purchases.getAppUserID();
        setCustomerData({
          appUserID,
          activeEntitlements: Object.keys(customerInfo.entitlements.active),
          allPurchasedProductIdentifiers:
            customerInfo.allPurchasedProductIdentifiers,
          latestExpirationDate: customerInfo.latestExpirationDate,
          firstSeen: customerInfo.firstSeen,
          managementURL: customerInfo.managementURL,
        });
      } catch {
        // שגיאה שקטה - עדיין מעדכנים סטטוס פרימיום
      }
    },
    []
  );

  // ============================================================================
  // אתחול
  // ============================================================================

  useEffect(() => {
    async function initialize() {
      // Legacy dev mode — isPremium is true for all users, but no real
      // subscription tier is set. useEffectiveAccess falls back to
      // DEV_ACCESS_OVERRIDE or trial_active default.
      if (!PAYMENT_SYSTEM_ENABLED) {
        setIsPremium(true);
        setSubscriptionTier(null);
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      // ב-Expo Go אין גישה למודולים מקוריים
      if (isExpoGo) {
        setPackages(PREVIEW_PACKAGES);
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      // אם אין מפתחות מוגדרים - עובדים במצב תצוגה מקדימה
      if (!isConfigured) {
        if (!__DEV__) {
          console.error(
            '[RevenueCat] CRITICAL: API key missing in non-DEV build. ' +
            'Payments will not work. Check EAS Environment Variables for ' +
            'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.'
          );
        }
        setPackages(PREVIEW_PACKAGES);
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      // ניסיון לאתחל את RevenueCat SDK
      try {
        const apiKey = getCurrentPlatformRevenueCatApiKey();
        if (!apiKey) {
          throw new Error('אין מפתח API לפלטפורמה הנוכחית');
        }

        // DEBUG ONLY — capture masked API key prefix
        const maskedKey =
          apiKey.length > 12
            ? `${apiKey.substring(0, 12)}***`
            : `${apiKey.substring(0, 4)}***`;
        _setDebugInfo((prev) => ({ ...prev, apiKeyPrefix: maskedKey }));

        // ייבוא דינמי למניעת קריסות ב-Expo Go
        const Purchases = (await import('react-native-purchases')).default;

        // הגדרת רמת לוג - VERBOSE בפיתוח, INFO בייצור
        await Purchases.setLogLevel(
          __DEV__ ? Purchases.LOG_LEVEL.VERBOSE : Purchases.LOG_LEVEL.ERROR
        );

        // קונפיגורציית SDK - Modern API
        Purchases.configure({
          apiKey,
          // appUserID ייקבע אוטומטית על ידי RevenueCat (anonymous)
          // אפשר להעביר Convex user ID בעתיד עם Purchases.logIn()
        });

        // טעינת ההצעות (Offerings)
        const offerings = await Purchases.getOfferings();

        // DEBUG ONLY — capture offerings metadata before checking packages
        _setDebugInfo((prev) => ({
          ...prev,
          offeringsCurrentId: offerings.current?.identifier ?? null,
          offeringsPackagesCount:
            offerings.current?.availablePackages?.length ?? 0,
        }));

        if (offerings.current?.availablePackages) {
          const loadedPackages: PackageInfo[] =
            offerings.current.availablePackages.map((pkg) => ({
              identifier: pkg.identifier,
              priceString: pkg.product.priceString,
              price: pkg.product.price,
              currencyCode: pkg.product.currencyCode,
              title: pkg.product.title,
              description: pkg.product.description,
              packageType: mapPackageType(pkg.packageType),
            }));
          setPackages(loadedPackages);
          // DEBUG ONLY — real packages loaded, not preview
          _setDebugInfo((prev) => ({ ...prev, usingPreviewPackages: false }));
        }

        // בדיקת סטטוס פרימיום ועדכון נתוני לקוח
        const customerInfo = await Purchases.getCustomerInfo();
        await updateCustomerData(customerInfo as never);

        // הוספת listener לעדכוני מצב מנוי (רכישות, ביטולים, שחזורים)
        const listener = (info: unknown) => {
          updateCustomerData(info as never);
        };
        Purchases.addCustomerInfoUpdateListener(listener);
        listenerRef.current = () => {
          Purchases.removeCustomerInfoUpdateListener(listener);
        };

        setIsInitialized(true);
      } catch (error) {
        // DEBUG ONLY — log error instead of silently swallowing it
        console.error('[RevenueCat] init/getOfferings error:', error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        _setDebugInfo((prev) => ({
          ...prev,
          initError: errorMessage,
          usingPreviewPackages: true,
        }));

        // במקרה של שגיאה - עובדים במצב תצוגה מקדימה
        setPackages(PREVIEW_PACKAGES);
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    }

    initialize();

    // ניקוי listener בעת unmount
    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [isExpoGo, isConfigured, updateCustomerData]);

  // ============================================================================
  // רכישת חבילה
  // ============================================================================

  const purchasePackage = useCallback(
    async (packageId: string): Promise<boolean> => {
      // מצב רכישות מדומות
      if (MOCK_PAYMENTS) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsPremium(true);
        Alert.alert('הצלחה', 'הרכישה הושלמה בהצלחה (מצב בדיקה)');
        return true;
      }

      // Expo Go - לא ניתן לבצע רכישות
      if (isExpoGo) {
        Alert.alert(
          'מצב פיתוח',
          'רכישות לא זמינות ב-Expo Go.\n\nכדי לבדוק רכישות אמיתיות, בנה גרסת פיתוח (development build).'
        );
        return false;
      }

      // אין מפתחות מוגדרים
      if (!isConfigured) {
        Alert.alert(
          'לא מוגדר',
          'מפתחות RevenueCat לא מוגדרים.\n\nהגדר את המפתחות ב-.env כדי לאפשר רכישות.'
        );
        return false;
      }

      try {
        const Purchases = (await import('react-native-purchases')).default;
        const offerings = await Purchases.getOfferings();
        const packageToPurchase = offerings.current?.availablePackages.find(
          (pkg) => pkg.identifier === packageId
        );

        if (!packageToPurchase) {
          throw new Error(`חבילה ${packageId} לא נמצאה`);
        }

        const { customerInfo } =
          await Purchases.purchasePackage(packageToPurchase);
        await updateCustomerData(customerInfo as never);
        const hasPremium = checkHasPremium(customerInfo);

        return hasPremium;
      } catch (error: unknown) {
        const purchasesError = error as {
          userCancelled?: boolean;
          message?: string;
          code?: string;
        };

        // בדיקה אם המשתמש ביטל - לא מציגים שגיאה
        if (purchasesError.userCancelled) {
          return false;
        }

        // בדיקה לפי קוד שגיאה
        const errorMessage = purchasesError.message || 'שגיאה לא ידועה';
        if (
          errorMessage.includes('cancelled') ||
          errorMessage.includes('canceled')
        ) {
          return false;
        }

        Alert.alert('שגיאה', 'הרכישה נכשלה. אנא נסה שוב.');
        return false;
      }
    },
    [isExpoGo, isConfigured, updateCustomerData]
  );

  // ============================================================================
  // שחזור רכישות
  // ============================================================================

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    // מצב רכישות מדומות
    if (MOCK_PAYMENTS) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert('שחזור', 'לא נמצאו רכישות קודמות (מצב בדיקה)');
      return false;
    }

    // Expo Go
    if (isExpoGo) {
      Alert.alert('מצב פיתוח', 'שחזור רכישות לא זמין ב-Expo Go.');
      return false;
    }

    // אין מפתחות
    if (!isConfigured) {
      Alert.alert('לא מוגדר', 'מפתחות RevenueCat לא מוגדרים.');
      return false;
    }

    try {
      const Purchases = (await import('react-native-purchases')).default;
      const customerInfo = await Purchases.restorePurchases();
      await updateCustomerData(customerInfo as never);
      const hasPremium = checkHasPremium(customerInfo);

      if (hasPremium) {
        Alert.alert('הצלחה', 'הרכישות שוחזרו בהצלחה! 🎉');
      } else {
        Alert.alert('שחזור', 'לא נמצאו רכישות קודמות.');
      }

      return hasPremium;
    } catch (_error) {
      Alert.alert('שגיאה', 'שחזור הרכישות נכשל. אנא נסה שוב.');
      return false;
    }
  }, [isExpoGo, isConfigured, updateCustomerData]);

  // ============================================================================
  // רענון מידע רוכש
  // ============================================================================

  const refreshPurchaserInfo = useCallback(async () => {
    if (!isConfigured || isExpoGo || !isInitialized) {
      return;
    }

    try {
      const Purchases = (await import('react-native-purchases')).default;
      const customerInfo = await Purchases.getCustomerInfo();
      await updateCustomerData(customerInfo as never);
    } catch (_error) {
      // שגיאה בשקט - לא צריך להציג למשתמש
    }
  }, [isConfigured, isExpoGo, isInitialized, updateCustomerData]);

  // ============================================================================
  // RevenueCat Paywall - הצגת מסך תשלום native
  // ============================================================================

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    // מצב רכישות מדומות
    if (MOCK_PAYMENTS) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsPremium(true);
      Alert.alert('הצלחה', 'הרכישה הושלמה בהצלחה (מצב בדיקה)');
      return true;
    }

    // Expo Go - לא ניתן להציג paywall native
    if (isExpoGo) {
      Alert.alert(
        'מצב פיתוח',
        'מסך תשלום מקורי לא זמין ב-Expo Go.\n\nכדי לבדוק, בנה גרסת פיתוח.'
      );
      return false;
    }

    if (!isConfigured) {
      Alert.alert('לא מוגדר', 'מפתחות RevenueCat לא מוגדרים.');
      return false;
    }

    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      const result = await RevenueCatUI.presentPaywall({
        displayCloseButton: true,
      });

      // בדיקת תוצאה - PURCHASED או RESTORED = הצלחה
      if (
        result === RevenueCatUI.PAYWALL_RESULT.PURCHASED ||
        result === RevenueCatUI.PAYWALL_RESULT.RESTORED
      ) {
        await refreshPurchaserInfo();
        return true;
      }

      return false;
    } catch (_error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בהצגת מסך התשלום.');
      return false;
    }
  }, [isExpoGo, isConfigured, refreshPurchaserInfo]);

  // ============================================================================
  // RevenueCat Paywall If Needed - מציג רק אם אין entitlement
  // ============================================================================

  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    // אם כבר פרימיום - לא צריך להציג
    if (isPremium) {
      return true;
    }

    // מצב רכישות מדומות
    if (MOCK_PAYMENTS) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsPremium(true);
      Alert.alert('הצלחה', 'הרכישה הושלמה בהצלחה (מצב בדיקה)');
      return true;
    }

    // Expo Go
    if (isExpoGo) {
      Alert.alert(
        'מצב פיתוח',
        'מסך תשלום מקורי לא זמין ב-Expo Go.\n\nכדי לבדוק, בנה גרסת פיתוח.'
      );
      return false;
    }

    if (!isConfigured) {
      Alert.alert('לא מוגדר', 'מפתחות RevenueCat לא מוגדרים.');
      return false;
    }

    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
        displayCloseButton: true,
      });

      if (
        result === RevenueCatUI.PAYWALL_RESULT.PURCHASED ||
        result === RevenueCatUI.PAYWALL_RESULT.RESTORED
      ) {
        await refreshPurchaserInfo();
        return true;
      }

      return false;
    } catch (_error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בהצגת מסך התשלום.');
      return false;
    }
  }, [isPremium, isExpoGo, isConfigured, refreshPurchaserInfo]);

  // ============================================================================
  // Customer Center - ניהול מנויים
  // ============================================================================

  const presentCustomerCenter = useCallback(async () => {
    // Expo Go
    if (isExpoGo) {
      Alert.alert(
        'מצב פיתוח',
        'Customer Center לא זמין ב-Expo Go.\n\nכדי לבדוק, בנה גרסת פיתוח.'
      );
      return;
    }

    if (!isConfigured) {
      Alert.alert('לא מוגדר', 'מפתחות RevenueCat לא מוגדרים.');
      return;
    }

    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: ({ customerInfo }) => {
            updateCustomerData(customerInfo as never);
            Alert.alert('הצלחה', 'הרכישות שוחזרו בהצלחה!');
          },
          onRestoreFailed: () => {
            Alert.alert('שגיאה', 'שחזור הרכישות נכשל.');
          },
        },
      });
    } catch (_error) {
      // Fallback: אם Customer Center לא נתמך, פתח manage subscriptions
      try {
        if (Platform.OS === 'ios') {
          const Purchases = (await import('react-native-purchases')).default;
          await Purchases.showManageSubscriptions();
        } else {
          Alert.alert(
            'ניהול מנוי',
            'כדי לנהל את המנוי שלך, פתח את הגדרות חנות Google Play.'
          );
        }
      } catch {
        Alert.alert('שגיאה', 'אירעה שגיאה בפתיחת ניהול המנויים.');
      }
    }
  }, [isExpoGo, isConfigured, updateCustomerData]);

  // ============================================================================
  // רינדור
  // ============================================================================

  const isPersonal =
    subscriptionTier === 'personal' || subscriptionTier === 'family';
  const isFamily = subscriptionTier === 'family';

  return (
    <RevenueCatContext.Provider
      value={{
        isLoading,
        isPremium,
        isConfigured,
        isExpoGo,
        subscriptionTier,
        isPersonal,
        isFamily,
        packages,
        customerData,
        purchasePackage,
        restorePurchases,
        refreshPurchaserInfo,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        // DEBUG ONLY — remove after TestFlight investigation
        _debug: _debugInfo,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

// ============================================================================
// הוק (Hook)
// ============================================================================

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat חייב להיות בשימוש בתוך RevenueCatProvider');
  }
  return context;
}
