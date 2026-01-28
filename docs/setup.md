# מדריך התקנה והגדרה - Mobile Template

בשלב הזה תצטרכו להתקין כמה דברים כדי להריץ את האפליקציה שלכם.

> **יש לנו שיעור מוקלט בפלטפורמה שמסביר את כל השלבים שתראו פה - ממליץ לכם לראות ולעקוב אחריו בנוסף לתוכן שמוצג כאן.**

אנחנו נצטרך לעבוד עם 6 דברים עיקריים:

1. Node.JS
2. Git
3. GitHub (יצירת משתמש)
4. Cursor
5. Bun
6. Convex (יצירת משתמש)

> 💡 **חשוב למשתמשי Windows:** שימו לב לא לשמור שום הורדה ב-OneDrive או כונן חיצוני של המחשב. התקינו את זה ב-C כדי שלא יהיו בעיות בהמשך הפיתוח!

---

## 1. התקנת Node.js

### 🪟 Windows:

1. גשו ל-[nodejs.org](https://nodejs.org)
2. לחצו על **Download** למעלה
3. לחצו על הכפתור הירוק השמאלי (גרסת LTS)
4. פתחו את ההורדה ותנו אישורים לכל השלבים עד שההתקנה מסתיימת
5. **חשוב:** וודאו שהאפשרות **"Add to PATH"** מסומנת במהלך ההתקנה

### 🍎 Mac:

**אפשרות 1 - הורדה ישירה (מומלץ למתחילים):**
1. גשו ל-[nodejs.org](https://nodejs.org)
2. לחצו על הכפתור הירוק השמאלי (גרסת LTS) - האתר יזהה אוטומטית שאתם ב-Mac
3. פתחו את קובץ ה-`.pkg` שהורדתם
4. עקבו אחרי ההוראות ולחצו **Continue** עד סוף ההתקנה

**אפשרות 2 - דרך Homebrew (למי שמכיר):**
```bash
brew install node
```

---

## 2. התקנת Git

### 🪟 Windows:

1. גשו ל-[git-scm.com/download/win](https://git-scm.com/download/win)
2. הורידו את **Git for Windows / 64-bit Setup**
3. פתחו את ההורדה ותנו OK לכל השלבים עד הסיום

### 🍎 Mac:

**אפשרות 1 - התקנה אוטומטית (הכי פשוט):**

פתחו את ה-Terminal (חפשו "Terminal" ב-Spotlight עם `Cmd+Space`) והריצו:
```bash
git --version
```

אם Git לא מותקן, Mac יציע להתקין את **Xcode Command Line Tools** - לחצו **Install** והמתינו לסיום.

**אפשרות 2 - דרך Homebrew:**
```bash
brew install git
```

**אפשרות 3 - הורדה ישירה:**
1. גשו ל-[git-scm.com/download/mac](https://git-scm.com/download/mac)
2. הורידו והתקינו

---

## 3. יצירת משתמש ב-GitHub

1. גשו ל-[github.com](https://github.com)
2. לחצו על **Sign Up** (הרשמה)
3. התחברו עם גוגל
4. השלימו את תהליך ההרשמה עד שתגיעו לדף הבית של GitHub

---

## 4. התקנת Cursor

1. גשו ל-[cursor.com](https://cursor.com)
2. לחצו על הורדה והתקינו את Cursor למחשב
3. הירשמו למערכת עם גוגל

---

## 5. פתיחת ה-Template ב-Cursor

לפני שממשיכים להתקין את הכלים הבאים, צריך לפתוח את Cursor ולבצע כמה דברים:

### פתיחת ה-Template:

1. הורידו את ה-template מהפלטפורמה הדיגיטלית
2. גררו את התיקייה מה-ZIP אל שולחן העבודה (Desktop)
   - אתם יכולים לשנות את שם התיקייה למה שתרצו עכשיו
3. פתחו את **Cursor**
4. גררו את תיקיית ה-template פנימה לתוך Cursor, או מצאו אותה דרך **File → Open Folder**

### הגדרת שמירה אוטומטית:

1. ב-Cursor לחצו `Ctrl+Shift+P` (או ב-Mac: `Cmd+Shift+P`)
   - זה יפתח לכם מנוע חיפוש עם סימנית `>` למעלה
2. הקלידו: `File: Toggle Auto Save` ולחצו Enter

עכשיו הקבצים שלכם יישמרו אוטומטית עם כל שינוי!

### 🪟 הגדרת טרמינל למשתמשי Windows:

> 💡 **שימו לב:** אם אתם משתמשים במחשב Windows, עליכם להגדיר עוד דבר נוסף:

1. ב-Cursor לחצו `Ctrl+Shift+P`
2. הקלידו: `Terminal: Select Default Profile` ולחצו Enter
3. בחרו באופציה **Git Bash** (זכרו שעליכם להוריד Git כדי שזה יעבוד)
4. פתחו את ה-Terminal ב-Cursor עם `` Ctrl+` `` (מקש משמאל למספר 1 על המקלדת)
5. ודאו שהוא נפתח תחת **Git Bash** (יופיע בצד ימין של הטרמינל)

---

## 6. התקנת Bun

עכשיו שפתחתם את האפליקציה ב-Cursor והגדרתם אותו, בצעו את השלבים הבאים:

1. פתחו את הטרמינל ב-Cursor עם `` Ctrl+` ``

2. בדקו ש-Node מותקן:
   ```bash
   node -v
   ```
   אתם אמורים לקבל מספר גרסה (לדוגמה `v22.0.1`)

3. התקינו Bun:
   ```bash
   npm i -g bun
   ```

4. בדקו שהכלים הותקנו נכון:
   ```bash
   git -v
   bun -v
   ```
   אתם אמורים לקבל מספרי גרסה לכל אחד

> ❌ **אם `node -v` לא עובד:**
> 1. סגרו את Cursor לחלוטין (לא רק את הטרמינל!)
> 2. פתחו מחדש
> 3. נסו שוב
>
> אם עדיין לא עובד - התקינו Node.js מחדש ווודאו ש-"Add to PATH" מסומן.

---

## 7. יצירת משתמש Convex

1. גשו ל-[convex.dev](https://convex.dev)
2. לחצו על **Log In** (התחברות)
3. הירשמו עם גוגל
4. תגיעו לדף ה-Dashboard - לכרגע זה הסוף

---

## 8. התקנת החבילות (Packages)

1. פתחו את ה-Terminal בתוך Cursor
2. הקלידו:
   ```bash
   bun install
   ```

זה יתקין את כל החבילות וה-dependencies כדי שהאפליקציה תרוץ כמו שצריך.

---

## 9. הגדרת Convex (Backend)

1. הקלידו בטרמינל:
   ```bash
   bunx convex dev
   ```

2. כשתראו את ההודעה הזו, לחצו Enter:
   ```
   ? Device name: (Your Device Name)
   ```

3. כשתראו את ההודעה הבאה, הקלידו `y` ולחצו Enter:
   ```
   ? Open the browser? (Y/n)
   ```

4. ייפתח חלון בדפדפן - ודאו שהקוד בדפדפן זהה לקוד ב-Terminal ולחצו **Confirm**

5. כשתראו את ההודעה הזו, לחצו Enter ליצירת פרויקט חדש:
   ```
   ? What would you like to configure?
   ❯ create a new project
     choose an existing project
   ```

6. בחרו שם לפרויקט והקלידו אותו:
   ```
   ? Project name: (your-app)
   ```

7. בחרו **cloud deployment** ולחצו Enter:
   ```
   ? Use cloud or local dev deployment?
   ❯ cloud deployment
     local deployment (BETA)
   ```

8. כשתראו הודעה כזו, הפרויקט נוצר בהצלחה:
   ```
   ✔ Created project your-app-123abc
   ✔ Convex functions ready!
   ```

9. עצרו את ה-Terminal עם **Ctrl+C** (גם ב-Windows וגם ב-Mac, לא Cmd+C)

> 💡 **תזכורת:** Ctrl+C עוצר כל פקודה ב-Terminal

---

## 10. העתקת משתני הסביבה

1. כנסו ל-[convex.dev](https://convex.dev) וודאו שהפרויקט נוצר

2. ב-Cursor, חפשו קובץ בשם `.env.local` - תמצאו בפנים שני משתנים

3. העתיקו את שני המשתנים מ-`.env.local`

4. עברו לקובץ `.env` בפרויקט והדביקו אותם שם (החליפו את מה שהיה קודם)

---

## 11. הגדרת מפתחות אימות (Auth Keys)

1. הקלידו בטרמינל:
   ```bash
   bunx @convex-dev/auth
   ```

2. כשתתבקשו ליצור את המפתחות, לחצו על `y` ועקבו אחרי ההוראות

3. לבדיקה: כנסו ל-Dashboard של Convex בדפדפן:
   - גשו ל-**Settings**
   - לכו ל-**Environment Variables**
   - ודאו שקיימים: `JWKS` ו-`JWT_PRIVATE_KEY`

4. **למפתחות Production:** הריצו גם:
   ```bash
   bunx @convex-dev/auth --prod
   ```
   ובדקו שהמפתחות קיימים גם ב-Production (החליפו בין development ל-production למעלה ב-Dashboard)

---

## 12. הרצת האפליקציה

הריצו את האפליקציה עם:

```bash
bun dev
```

### למה לצפות:

יופיע **QR Code** שאותו אתם סורקים בעזרת הטלפון:
- **iOS:** השתמשו במצלמה לסריקת ה-QR Code
- **Android:** היכנסו ל-Expo Go וסרקו עם הכפתור לסריקת ברקוד

> 💡 **חשוב:** הטלפון והמחשב חייבים להיות מחוברים לאותו Wi-Fi כדי שתוכלו לראות את האפליקציה!

---

## פתרון בעיות נפוצות

### ❌ `'node' is not recognized`
1. סגרו את Cursor לחלוטין
2. פתחו מחדש
3. נסו שוב: `node -v`

### ❌ `Cannot find module`
```bash
rm -rf node_modules
rm bun.lock
bun install
bun expo start --clear
```

### ❌ QR Code לא נסרק
- ודאו שהטלפון והמחשב באותה רשת Wi-Fi
- נסו: `bun expo start --tunnel`

### ❌ `EXPO_PUBLIC_CONVEX_URL is not defined`
- ודאו שהעתקתם את המשתנים מ-`.env.local` לקובץ `.env`

---

## סיימנו!

עברו ל**מדריך שימוש ופיתוח** (`usage.md`) להמשך עבודה.
