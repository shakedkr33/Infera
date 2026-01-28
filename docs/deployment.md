# מדריך העלאה לחנויות (Deployment) - Mobile Template

אנו משתמשים ב-**EAS (Expo Application Services)** לבניית והפצת האפליקציה.

## תוכן עניינים

1. [דרישות מקדימות ל-EAS](#דרישות-מקדימות-ל-eas)
2. [שלב 1: הגדרת הפרויקט ב-EAS](#שלב-1-הגדרת-הפרויקט-ב-eas)
3. [שלב 2: הגדרת משתני סביבה](#שלב-2-הגדרת-משתני-סביבה)
4. [שלב 3: בניית האפליקציה (Build)](#שלב-3-בניית-האפליקציה-build)
5. [שלב 4: העלאת ה-Backend](#שלב-4-העלאת-ה-backend)
6. [שלב 5: שליחה לחנויות (Submit)](#שלב-5-שליחה-לחנויות-submit)
7. [עדכונים מהירים (OTA Updates)](#עדכונים-מהירים-ota-updates)
8. [בדיקות לפני פריסה לייצור](#בדיקות-לפני-פריסה-לייצור)
9. [פתרון בעיות נפוצות](#פתרון-בעיות-נפוצות)

---

## דרישות מקדימות ל-EAS

1. **חשבון Expo:** הרשמו ב-[expo.dev](https://expo.dev).
2. **התקנת EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```
3. **התחברות:**
   ```bash
   eas login
   ```

## שלב 1: הגדרת הפרויקט ב-EAS

בפעם הראשונה, הריצו:
```bash
eas build:configure
```
עקבו אחרי ההוראות כדי ליצור קובץ `eas.json` בפרויקט.

## שלב 2: הגדרת משתני סביבה

עבור גרסת ה-Production, יש להגדיר את משתני הסביבה ב-EAS Secrets:

### משתנים בסיסיים (חובה):
1. **Convex URL:**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_CONVEX_URL --value https://your-prod-url.convex.cloud
   ```

### משתנים למערכת תשלומים (RevenueCat) - אופציונלי:
אם אתם משתמשים במערכת התשלומים, הוסיפו גם:

2. **iOS API Key (Production):**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY_PROD --value appl_...
   ```

3. **Android API Key (Production):**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY_PROD --value goog_...
   ```

4. **iOS API Key (Development - אופציונלי):**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY_DEV --value appl_...
   ```

5. **Android API Key (Development - אופציונלי):**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY_DEV --value goog_...
   ```

📖 **מדריך הגדרה מפורט:** ראה `docs/REVENUECAT_SETUP.md` להגדרה מלאה של מערכת התשלומים.

**הערה:** ניתן לעשות זאת גם דרך האתר של Expo תחת הגדרות הפרויקט → Secrets.

## שלב 3: בניית האפליקציה (Build)

לבניית קובץ התקנה (APK לאנדרואיד או IPA לאייפון):

```bash
eas build --platform all
```
או לפלטפורמה ספציפית:
```bash
eas build --platform android
eas build --platform ios
```

*הערה: בנייה ל-iOS דורשת חשבון מפתח של Apple (בתשלום), אך בנייה ל-Android אפשרית גם ללא חשבון Google Play בשלב הבדיקות.*

## שלב 4: העלאת ה-Backend

ודאו שה-Convex Backend מעודכן ב-Production:

```bash
bunx convex deploy
```

## שלב 5: שליחה לחנויות (Submit)

לאחר שהבנייה הסתיימה בהצלחה, ניתן לשלוח לחנויות:

```bash
eas submit --platform all
```

## עדכונים מהירים (OTA Updates)

לתיקוני קוד קטנים (JS/CSS) ללא שינוי Native, ניתן לעדכן את המשתמשים מיידית:

```bash
eas update
```

---

## בדיקות לפני פריסה לייצור

לפני פריסה לייצור, ודאו:

### ✅ קונפיגורציה (`config/appConfig.ts`):
- [ ] `PAYMENT_SYSTEM_ENABLED` מוגדר ל-`true` אם אתם משתמשים בתשלומים אמיתיים
- [ ] `MOCK_PAYMENTS` מוגדר ל-`false` בייצור (אלא אם כן אתם רוצים תשלומים מדומים)
- [ ] הערה: `APP_ENV` נגזר אוטומטית מ-`__DEV__` - אין צורך לשנות ידנית

### ✅ משתני סביבה:
- [ ] כל משתני הסביבה הנדרשים מוגדרים ב-EAS Secrets
- [ ] משתני RevenueCat מוגדרים אם אתם משתמשים במערכת התשלומים
- [ ] כתובות URL (Terms, Privacy) מעודכנות ב-`appConfig.ts`

### ✅ בדיקות פונקציונליות:
- [ ] אימות משתמשים עובד
- [ ] Paywall מוצג למשתמשים חינמיים (אם מופעל)
- [ ] תשלומים עובדים (אם מופעלים)
- [ ] מחיקת חשבון עובדת

---

## פתרון בעיות נפוצות

### Paywall לא מוצג
- ודאו ש-`PAYMENT_SYSTEM_ENABLED = true` או `MOCK_PAYMENTS = true` ב-`config/appConfig.ts`
- בדקו שהמשתמש לא מסומן כ-"premium" ב-Database

### תשלומים לא עובדים
- ודאו שכל משתני RevenueCat מוגדרים ב-EAS Secrets
- בדקו ש-`PAYMENT_SYSTEM_ENABLED = true` ו-`MOCK_PAYMENTS = false`
- ודאו שהאפליקציה בנויה כ-Development Build או Production Build (לא Expo Go)

### שגיאות Convex
- ודאו ש-`EXPO_PUBLIC_CONVEX_URL` מוגדר נכון ב-EAS Secrets
- הרצו `bunx convex deploy` כדי לעדכן את ה-Backend
