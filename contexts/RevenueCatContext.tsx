// ============================================================================
// קונטקסט REVENUECAT - InYomi
// ============================================================================
// ספק RevenueCat מלא עם תמיכה ב:
// - Expo Go (תצוגה מקדימה ללא רכישות מקוריות)
// - Development builds עם Test Store key
// - Production builds עם מפתחות iOS/Android
// - RevenueCat Paywall (native UI)
// - Customer Center (ניהול מנויים)
// - Entitlement checking עבור "InYomi Pro"

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
  getCurrentPlatformRevenueCatApiKey,
  isRevenueCatConfigured,
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

// מבנה הקונטקסט
type RevenueCatContextType = {
  // מצב
  isLoading: boolean;
  isPremium: boolean;
  isConfigured: boolean;
  isExpoGo: boolean;

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
 * בדיקה האם ל-entitlement "InYomi Pro" יש גישה פעילה
 */
function checkHasPremium(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}): boolean {
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
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
  const [packages, setPackages] = useState<PackageInfo[]>(PREVIEW_PACKAGES);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

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
      // אם מערכת התשלומים כבויה - המשתמש הוא פרימיום אוטומטית
      if (!PAYMENT_SYSTEM_ENABLED) {
        setIsPremium(true);
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

        // ייבוא דינמי למניעת קריסות ב-Expo Go
        const Purchases = (await import('react-native-purchases')).default;

        // הגדרת רמת לוג - VERBOSE בפיתוח, INFO בייצור
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);

        // קונפיגורציית SDK - Modern API
        Purchases.configure({
          apiKey,
          // appUserID ייקבע אוטומטית על ידי RevenueCat (anonymous)
          // אפשר להעביר Convex user ID בעתיד עם Purchases.logIn()
        });

        // טעינת ההצעות (Offerings)
        const offerings = await Purchases.getOfferings();
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
      } catch (_error) {
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
        const hasPremium = checkHasPremium(customerInfo);
        setIsPremium(hasPremium);

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
    [isExpoGo, isConfigured]
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
      const hasPremium = checkHasPremium(customerInfo);
      setIsPremium(hasPremium);

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
  }, [isExpoGo, isConfigured]);

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

  return (
    <RevenueCatContext.Provider
      value={{
        isLoading,
        isPremium,
        isConfigured,
        isExpoGo,
        packages,
        customerData,
        purchasePackage,
        restorePurchases,
        refreshPurchaserInfo,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
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
