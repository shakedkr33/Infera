import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

// מסך 404 - מוצג כאשר המשתמש מנסה לגשת לנתיב שאינו קיים
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'אופס!' }} />
      <View className="flex-1 items-center justify-center p-5">
        <Text className="text-xl font-bold">המסך הזה לא קיים.</Text>

        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-blue-500">חזור למסך הבית</Text>
        </Link>
      </View>
    </>
  );
}
