// ============================================================================
// קונפיגורציית CONVEX
// ============================================================================
// ניהול כתובת Convex

/**
 * קבלת כתובת Convex
 * הכתובת נלקחת ממשתנה הסביבה EXPO_PUBLIC_CONVEX_URL
 *
 * הפרדה בין Dev ל-Production מתבצעת ברמת ה-Deployment:
 * - פיתוח מקומי: `bunx convex dev` (משתמש ב-dev deployment)
 * - ייצור: `bunx convex deploy` (משתמש ב-prod deployment)
 */
export function getConvexUrl(): string {
  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error('חסרה כתובת Convex. הגדר EXPO_PUBLIC_CONVEX_URL ב-.env');
  }

  return convexUrl;
}
