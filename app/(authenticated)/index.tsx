import { Redirect } from 'expo-router';

export default function Index() {
  // השורה הזו אומרת לאפליקציה: "כשאת נפתחת, לכי ישר לתחילת האונבורדינג"
  return <Redirect href="/onboarding-hero" />;
}
