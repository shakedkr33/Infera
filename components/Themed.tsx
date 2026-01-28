/**
 * ניהול ערכות נושא (Themes) - תמיכה במצב בהיר (Light) וכהה (Dark)
 * קובץ זה מספק רכיבי טקסט ותצוגה (View, Text) שמשנים צבע אוטומטית לפי הגדרות המכשיר.
 * למידע נוסף: https://docs.expo.io/guides/color-schemes/
 */

import {
  Text as DefaultText,
  View as DefaultView,
  useColorScheme,
} from 'react-native';

import Colors from '@/constants/Colors'; // ייבוא צבעים מהקבועים

// הגדרת טיפוסים עבור ה-Props של ה-Theme
type ThemeProps = {
  lightColor?: string; // צבע אופציונלי למצב בהיר
  darkColor?: string; // צבע אופציונלי למצב כהה
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

// Hook מותאם אישית להחזרת הצבע הנכון לפי ערכת הנושא הנוכחית
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light'; // ברירת מחדל למצב בהיר אם לא מזוהה
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

// רכיב טקסט מותאם אישית התומך ב-Theme
export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

// רכיב View מותאם אישית התומך ב-Theme
export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
