import { Redirect } from 'expo-router';

// הפניה ברירת מחדל לדף התחברות
// מונע מהאפליקציה להציג מסכים אחרים בקבוצת (auth)
export default function AuthIndex() {
  return <Redirect href="/(auth)/sign-in" />;
}
