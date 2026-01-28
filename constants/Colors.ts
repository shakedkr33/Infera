// קבועי צבעים עבור האפליקציה
// קובץ זה מרכז את פלטת הצבעים עבור מצב בהיר (Light) ומצב כהה (Dark)

const tintColorLight = '#2f95dc'; // צבע הדגשה למצב בהיר
const tintColorDark = '#fff'; // צבע הדגשה למצב כהה

export default {
  light: {
    text: '#000', // צבע טקסט ראשי
    background: '#fff', // צבע רקע ראשי
    tint: tintColorLight, // צבע הדגשה (למשל לאייקונים פעילים)
    tabIconDefault: '#ccc', // צבע אייקון בטאב-בר (לא פעיל)
    tabIconSelected: tintColorLight, // צבע אייקון בטאב-בר (פעיל)
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
