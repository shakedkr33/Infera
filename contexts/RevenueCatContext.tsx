// ============================================================================
// קונטקסט REVENUECAT
// ============================================================================
// ספק RevenueCat בטוח שעובד ב:
// - Expo Go (ללא רכישות מקוריות)
// - פיתוח ללא מפתחות (מצב תצוגה מקדימה)
// - מצב רכישות מדומות (mock)
// - ייצור עם מפתחות אמיתיים

import Constants from 'expo-constants';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { MOCK_PAYMENTS, PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import {
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

// מבנה הקונטקסט
type RevenueCatContextType = {
  // מצב
  isLoading: boolean;
  isPremium: boolean;
  isConfigured: boolean;
  isExpoGo: boolean;

  // חבילות זמינות
  packages: PackageInfo[];

  // פעולות
  purchasePackage: (packageId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshPurchaserInfo: () => Promise<void>;
};

// ============================================================================
// חבילות ברירת מחדל לתצוגה מקדימה
// ============================================================================

// חבילות ברירת מחדל לתצוגה מקדימה (כשאין מפתחות או ב-Expo Go)
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

  const isExpoGo = isRunningInExpoGo();
  const isConfigured = isRevenueCatConfigured();

  // ============================================================================
  // אתחול
  // ============================================================================

  useEffect(() => {
    async function initialize() {
      // אם מערכת התשלומים כבויה - המשתמש הוא פרימיום אוטומטית
      if (!PAYMENT_SYSTEM_ENABLED) {
        setIsPremium(true);
        // סנכרון userType - במצב זה המשתמש נשאר 'free' כי אין תשלומים
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

        Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
        await Purchases.configure({ apiKey });

        // טעינת ההצעות
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

        // בדיקת סטטוס פרימיום
        const customerInfo = await Purchases.getCustomerInfo();
        const hasPremium =
          customerInfo.entitlements.active.Pro !== undefined ||
          customerInfo.entitlements.active.premium !== undefined;
        setIsPremium(hasPremium);

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
  }, [isExpoGo, isConfigured]);

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
        const hasPremium =
          customerInfo.entitlements.active.Pro !== undefined ||
          customerInfo.entitlements.active.premium !== undefined;
        setIsPremium(hasPremium);

        return hasPremium;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'שגיאה לא ידועה';

        // בדיקה אם המשתמש ביטל
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
      const hasPremium =
        customerInfo.entitlements.active.Pro !== undefined ||
        customerInfo.entitlements.active.premium !== undefined;
      setIsPremium(hasPremium);

      if (hasPremium) {
        Alert.alert('הצלחה', 'הרכישות שוחזרו בהצלחה!');
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
      const hasPremium =
        customerInfo.entitlements.active.Pro !== undefined ||
        customerInfo.entitlements.active.premium !== undefined;
      setIsPremium(hasPremium);
    } catch (_error) {
      // שגיאה בשקט - לא צריך להציג למשתמש
    }
  }, [isConfigured, isExpoGo, isInitialized]);

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
        purchasePackage,
        restorePurchases,
        refreshPurchaserInfo,
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

// ============================================================================
// פונקציות עזר
// ============================================================================

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
