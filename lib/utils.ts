import { type ClassValue, clsx } from 'clsx'; // ספרייה למיזוג מחלקות CSS באופן מותנה
import { twMerge } from 'tailwind-merge'; // ספרייה למיזוג חכם של מחלקות Tailwind (מונע התנגשויות)

// פונקציית עזר למיזוג מחלקות CSS/Tailwind
// מאפשרת שימוש נוח בתנאים ובמיזוג מחלקות דינמי
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
