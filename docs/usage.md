# מדריך שימוש ופיתוח - Mobile Template

## תוכן עניינים

1. [הרצת האפליקציה](#הרצת-האפליקציה)
2. [פקודות שימושיות](#פקודות-שימושיות)
3. [מבנה הפרויקט (Expo Router)](#מבנה-הפרויקט-expo-router)
4. [ניהול קונפיגורציה (appConfig.ts)](#ניהול-קונפיגורציה-appconfigts)
5. [עבודה עם RevenueCat](#עבודה-עם-revenuecat)
6. [מחיקת חשבון](#מחיקת-חשבון)
7. [פתרון תקלות נפוצות](#פתרון-תקלות-נפוצות)

---

## הרצת האפליקציה

כדי לפתח, אנו זקוקים לשני טרמינלים:

### טרמינל 1: שרת הפיתוח (Expo)
```bash
bun dev
```
פקודה זו תפעיל את Expo ותציג קוד QR בטרמינל.

**איך מריצים על הטלפון?**
- פתחו את אפליקציית **Expo Go** בטלפון.
- סרקו את ה-QR Code המופיע בטרמינל.
- האפליקציה תיטען בטלפון שלכם ותתעדכן בשידור חי (Hot Reload) עם כל שמירה של הקוד.

**הרצה על אימולטור (מתקדם):**
- **Android:** ודאו ש-Android Studio מותקן והריצו `bun run android`.
- **iOS (Mac בלבד):** ודאו ש-Xcode מותקן והריצו `bun run ios`.

### טרמינל 2: שרת Convex
```bash
bunx convex dev
```
מבטיח שה-Backend מסונכרן וזמין.

---

## פקודות שימושיות

### תפריט Expo למפתחים
כשהאפליקציה רצה בטרמינל, ניתן ללחוץ על מקשים מסוימים:
- `r` - טעינה מחדש של האפליקציה (Reload).
- `m` - פתיחת תפריט המפתחים (Developer Menu) במכשיר.
- `q` - הצגת ה-QR Code שוב.

### בדיקות קוד
- **Linting:** `bun lint`
- **TypeScript:** `bun run type-check`

---

## מבנה הפרויקט (Expo Router)

- `app/`: מסכי האפליקציה. התיקיות והקבצים כאן מגדירים את הניווט (בדומה ל-Next.js).
  - `(auth)/paywall/`: מסך Paywall (תשלום).
- `components/`: רכיבים לשימוש חוזר.
- `config/`: קבצי קונפיגורציה מרכזיים.
  - `appConfig.ts`: דגלי תכונות וקונפיגורציה כללית.
- `contexts/`: קונטקסטים גלובליים.
  - `RevenueCatContext.tsx`: ניהול מנויים ותשלומים.
- `utils/`: כלי עזר.
  - `revenueCatConfig.ts`: קונפיגורציית RevenueCat.
- `assets/`: תמונות, פונטים ואייקונים.
- `convex/`: קוד צד שרת.

---

## ניהול קונפיגורציה (`appConfig.ts`)

קובץ `config/appConfig.ts` מאפשר לשלוט בהתנהגות האפליקציה דרך דגלים:

### דגלים מרכזיים:

#### `PAYMENT_SYSTEM_ENABLED`
- **תפקיד:** קובע האם מערכת התשלומים האמיתית (RevenueCat) פעילה
- **ערכים:** `true` / `false`
- **התנהגות:**
  - `true`: רכישות אמיתיות דרך RevenueCat (דורש הגדרת מפתחות API)
  - `false`: גישה חופשית לתכונות פרימיום (לפיתוח/בדיקות)

#### `MOCK_PAYMENTS`
- **תפקיד:** מצב בדיקה שמאפשר לבדוק את ה-Paywall בלי תשלום אמיתי
- **ערכים:** `true` / `false`
- **התנהגות:**
  - `true`: לחיצה על "המשך" תדמה שדרוג ל"בתשלום" בלי RevenueCat
  - `false`: התנהגות תיקבע לפי `PAYMENT_SYSTEM_ENABLED`

#### `IS_DEV_MODE` ו-`APP_ENV`
- **תפקיד:** זיהוי אוטומטי של סביבת האפליקציה
- **התנהגות:**
  - `IS_DEV_MODE`: `true` בפיתוח מקומי, `false` ב-production builds (נגזר מ-`__DEV__`)
  - `APP_ENV`: `'dev'` או `'prod'` - משמש לבחירה אוטומטית בין API Keys של פיתוח לייצור
- **שימוש:** משמש ב-`revenueCatConfig.ts` לבחירת המפתחות המתאימים
- **הערה:** אין צורך לשנות ידנית - הכל אוטומטי לפי סוג ה-Build

### דוגמה לשימוש:
```typescript
// כיבוי תשלומים לחלוטין (לפיתוח)
export const PAYMENT_SYSTEM_ENABLED = false;
export const MOCK_PAYMENTS = false;

// הפעלת Paywall עם תשלומים מדומים (לבדיקה)
export const PAYMENT_SYSTEM_ENABLED = false;
export const MOCK_PAYMENTS = true;

// הפעלת תשלומים אמיתיים (ייצור)
export const PAYMENT_SYSTEM_ENABLED = true;
export const MOCK_PAYMENTS = false;
```

---

## עבודה עם RevenueCat

### שימוש ב-RevenueCat Context

הקונטקסט `RevenueCatContext` מספק גישה לכל הפונקציונליות של RevenueCat:

```tsx
import { useRevenueCat } from '@/contexts/RevenueCatContext';

function MyComponent() {
  const { 
    isPremium,           // האם המשתמש פרימיום
    isLoading,           // האם טוען
    packages,            // חבילות מנוי זמינות
    purchasePackage,     // פונקציה לרכישה
    restorePurchases,    // פונקציה לשחזור רכישות
    isExpoGo            // האם רץ ב-Expo Go
  } = useRevenueCat();

  // בדיקת סטטוס פרימיום
  if (isPremium) {
    return <PremiumContent />;
  }

  return <FreeContent />;
}
```

### מסך Paywall

המסך `app/(auth)/paywall/index.tsx` מציג את מסך התשלום עם:
- תוכנית חודשית ושנתית
- תמחור ותכונות
- כפתורי רכישה ושחזור
- קישורים לתנאי שימוש ומדיניות פרטיות

**גישה למסך:**
```tsx
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/(auth)/paywall');
```

**מצב Preview (Dev בלבד):**
```tsx
router.push('/(auth)/paywall?preview=true');
```

---

## מחיקת חשבון

משתמשים יכולים למחוק את החשבון שלהם דרך מסך ההגדרות:

1. פתחו את מסך ההגדרות (`app/(authenticated)/settings.tsx`)
2. בחרו "מחק חשבון"
3. אישור דו-שלבי:
   - שלב 1: בחירה בין התנתקות למחיקה
   - שלב 2: אישור סופי למחיקה

⚠️ **אזהרה:** מחיקת חשבון היא פעולה בלתי הפיכה ותמחק את כל הנתונים המשויכים למשתמש.

---

## פתרון תקלות נפוצות

- **שגיאת חיבור לרשת ב-Expo Go:** ודאו שהטלפון והמחשב מחוברים לאותה רשת Wi-Fi.
- **Convex לא מגיב:** ודאו שפקודת `bunx convex dev` רצה בטרמינל נפרד.
