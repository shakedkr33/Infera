import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker'; // יש לוודא שהספרייה מותקנת
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BirthdaysScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('הכל');

  // נתוני ימי הולדת (בפרויקט אמיתי זה יגיע מה-Convex)
  const [birthdays, setBirthdays] = useState([
    { id: '1', name: 'דני כהן', date: new Date(2024, 0, 15), initials: 'דכ' },
    { id: '2', name: 'נועה לוי', date: new Date(), initials: 'נל' }, // היום
  ]);

  // לוגיקה להוספה חדשה
  const [showPicker, setShowPicker] = useState(false);
  const [tempContact, setTempContact] = useState<any>(null);

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'הכל'];

  const pickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const contact = await Contacts.presentContactPickerAsync();
      if (contact) {
        setTempContact(contact);
        setShowPicker(true); // שלב 2: פתיחת תאריכון מיד
      }
    }
  };

  const onDateSelect = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate && tempContact) {
      const newBirthday = {
        id: Date.now().toString(),
        name: tempContact.name,
        date: selectedDate,
        initials: tempContact.name.substring(0, 2),
      };
      setBirthdays((prev) => [...prev, newBirthday]); // שלב 3: הוספה רק עם תאריך
      setTempContact(null);
    }
  };

  const deleteBirthday = (id: string) => {
    Alert.alert('מחיקה', 'האם למחוק את יום ההולדת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => setBirthdays((prev) => prev.filter((b) => b.id !== id)),
      },
    ]);
  };

  const filteredBirthdays = useMemo(() => {
    return birthdays.filter(
      (b) =>
        b.name.includes(search) &&
        (selectedMonth === 'הכל' || months[b.date.getMonth()] === selectedMonth)
    );
  }, [search, selectedMonth, birthdays]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View className="flex-row-reverse items-center justify-between px-6 py-4 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2">
          <MaterialIcons name="arrow-forward" size={24} color="#111517" />
        </Pressable>
        <Text className="text-xl font-bold text-[#111517]">🎂 ימי הולדת</Text>
        <Pressable onPress={pickContact} className="bg-sky-50 p-2 rounded-full">
          <MaterialIcons name="add" size={24} color="#36a9e2" />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View className="px-6 py-4">
        <View className="bg-gray-100 rounded-2xl flex-row-reverse items-center px-4 h-12">
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="חיפוש לפי שם..."
            className="flex-1 text-right mr-2 h-full"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Months Filter */}
      <View>
        <FlatList
          horizontal
          inverted
          data={months}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedMonth(item)}
              className={`px-6 py-2 rounded-full ml-2 border ${selectedMonth === item ? 'bg-[#36a9e2] border-[#36a9e2]' : 'border-gray-200'}`}
            >
              <Text
                className={`font-bold ${selectedMonth === item ? 'text-white' : 'text-gray-500'}`}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredBirthdays}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 24 }}
        renderItem={({ item }) => (
          <View
            style={styles.card}
            className="bg-white border border-gray-100 rounded-3xl p-4 mb-4 flex-row-reverse items-center justify-between shadow-sm"
          >
            <View className="flex-row-reverse items-center gap-4 flex-1">
              <View className="size-12 rounded-full bg-gray-100 items-center justify-center border border-gray-200">
                <Text className="font-bold text-gray-500">{item.initials}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-right font-bold text-lg text-[#111517]">
                  {item.name}
                </Text>
                <View className="bg-blue-50 self-end px-2 py-0.5 rounded mt-1">
                  <Text className="text-[#36a9e2] text-xs font-bold">
                    בעוד 5 ימים
                  </Text>
                </View>
              </View>
            </View>

            {/* לחצני פעולה בתוך הריבוע */}
            <View className="flex-row items-center gap-2">
              <Text className="text-gray-400 text-xs ml-4">
                {`${item.date.getDate()}.${item.date.getMonth() + 1}`}
              </Text>
              <Pressable
                onPress={() => deleteBirthday(item.id)}
                className="p-2 bg-red-50 rounded-full"
              >
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color="#ff6b6b"
                />
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Date Picker - קופץ מיד לאחר בחירת איש קשר */}
      {showPicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateSelect}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
});
