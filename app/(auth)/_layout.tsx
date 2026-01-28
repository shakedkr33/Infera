import { useConvexAuth } from 'convex/react';
import { Redirect, Slot, useLocalSearchParams, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { IS_DEV_MODE } from '@/config/appConfig';

export default function AuthRoutesLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const { preview } = useLocalSearchParams<{ preview?: string }>();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/1ea5e66d-d528-4bae-a881-fff31ff26db7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/(auth)/_layout.tsx:mount',
        message: 'Auth layout state',
        data: { isAuthenticated, isLoading, segments: segments, preview },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'B,E',
      }),
    }).catch(() => {});
  }, [isAuthenticated, isLoading, segments, preview]);
  // #endregion

  // המתנה לטעינת סטטוס האימות
  if (isLoading) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/1ea5e66d-d528-4bae-a881-fff31ff26db7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/(auth)/_layout.tsx:loading',
        message: 'Auth loading - returning null',
        data: {},
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'B',
      }),
    }).catch(() => {});
    // #endregion
    return null;
  }

  // בדיקה אם זה מצב תצוגה מקדימה (preview mode)
  // במצב תצוגה מקדימה, משתמשים מחוברים יכולים לגשת לדפי auth לצורך דיבאג
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  // בדיקה האם המסלול הנוכחי הוא paywall
  // מסלול זה צריך להיות נגיש גם למשתמשים מחוברים (למשל מהגדרות/דיבאג)
  // המרה למערך מחרוזות כללי כדי לאפשר בדיקת includes
  const segmentStrings = segments as string[];
  const isPaywallRoute = segmentStrings.includes('paywall');
  const isAllowedForAuthenticated = isPaywallRoute || isPreviewMode;

  // אם המשתמש כבר מחובר, הפנה אותו לאזור המאומת
  // אלא אם הוא במסלול paywall או במצב תצוגה מקדימה
  // זה מונע ממשתמשים מחוברים לגשת למסכי התחברות/הרשמה
  // אבל מאפשר להם לגשת דרך הגדרות/דיבאג במצב preview
  if (isAuthenticated && !isAllowedForAuthenticated) {
    return <Redirect href="/(authenticated)" />;
  }

  // שימוש ב-Slot כדי לעבד את המסכים הפנימיים (sign-in, sign-up, paywall)
  // אנחנו משתמשים ב-Slot במקום Stack כי ה-Layout הראשי כבר מספק את הקונטקסט הדרוש
  return <Slot />;
}
