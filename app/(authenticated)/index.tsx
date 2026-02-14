import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [showToast, setShowToast] = useState(true);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  // לוגיקת המשימות
  const [items, setItems] = useState([
    {
      id: '1',
      time: '13:30',
      title: 'איסוף מהגן',
      location: 'גן שושנים',
      type: 'event',
      icon: 'child-care',
      iconBg: '#FFF4E6',
      iconColor: '#FF922B',
      assigneeColor: '#36a9e2',
    },
    {
      id: '2',
      time: '16:00',
      title: 'לקנות חלב ולחם',
      location: 'סופר שכונתי',
      type: 'task',
      completed: false,
      icon: 'shopping-cart',
      iconBg: '#E7F5FF',
      iconColor: '#228BE6',
      assigneeColor: '#FFD1DC',
    },
    {
      id: '3',
      time: '17:30',
      title: 'חוג כדורגל (בן 6)',
      location: 'מגרש ספורט קהילתי',
      type: 'event',
      icon: 'fitness-center',
      iconBg: '#F3F0FF',
      iconColor: '#7950F2',
      assigneeColor: '#FFD1DC',
    },
  ]);

  const toggleTask = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const birthdays = [
    { id: '1', name: 'אמא', time: 'מחר', color: '#FFD1DC' },
    { id: '2', name: 'דנה', time: 'בעוד 5 ימים', color: '#E0F2F1' },
    { id: '3', name: 'מיכל', time: 'בעוד 8 ימים', color: '#FFF9C4' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      {/* Header */}
      <View className="flex-row-reverse items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <View className="flex-row-reverse items-center gap-3">
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
            accessibilityLabel="InYomi"
          />
          <View>
            <Text className="text-gray-400 text-[10px] text-right">
              צהריים טובים
            </Text>
            <Text className="text-[#111517] text-lg font-bold text-right">
              ברוכה הבאה, שקד
            </Text>
          </View>
        </View>
        <Pressable className="size-10 rounded-full items-center justify-center bg-gray-50">
          <MaterialIcons name="notifications-none" size={24} color="#111517" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-6 pt-6 mb-6">
          <Text className="text-[#111517] text-2xl font-black text-right leading-tight">
            יום שלישי, 10 בפברואר
          </Text>
          <Text className="text-gray-400 text-sm text-right mt-1">
            יש לך {items.length + 1} פעילויות היום
          </Text>
        </View>

        {/* כרטיס ראשי */}
        <View className="px-6 mb-8">
          <View
            style={styles.cardShadow}
            className="bg-white rounded-3xl overflow-hidden border border-gray-50"
          >
            <View className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#36a9e2]" />
            <View className="p-6 pr-8">
              <View className="flex-row-reverse justify-between items-start mb-2">
                <View className="bg-blue-50 px-2 py-0.5 rounded">
                  <Text className="text-[#36a9e2] text-[11px] font-bold">
                    האירוע הקרוב
                  </Text>
                </View>
                <Text className="text-[#36a9e2] text-2xl font-bold">09:00</Text>
              </View>
              <Text className="text-xl font-bold text-[#111517] text-right">
                פגישה בבית הספר
              </Text>
              <View className="flex-row-reverse items-center gap-1.5 mt-1 mb-4">
                <MaterialIcons name="location-on" size={16} color="#94a3b8" />
                <Text className="text-gray-400 text-sm">
                  בית ספר יסודי "אלונים"
                </Text>
              </View>
              <View className="bg-[#fff5f5] flex-row-reverse items-center p-3 rounded-2xl mb-4">
                <MaterialIcons name="traffic" size={20} color="#ff6b6b" />
                <Text className="text-[#ff6b6b] text-xs font-bold mr-2 text-right flex-1">
                  עומס כבד באיילון: מומלץ לצאת ב-08:15
                </Text>
              </View>
              <Pressable className="bg-[#8d6e63]/10 px-4 py-2 rounded-xl flex-row items-center gap-2 self-start">
                <MaterialIcons name="near-me" size={18} color="#8d6e63" />
                <Text className="text-[#8d6e63] font-bold text-sm">נווט</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ימי הולדת */}
        <View className="mb-8">
          <View className="flex-row-reverse justify-between px-6 mb-3 items-center">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              🎂 ימי הולדת קרובים
            </Text>
            <Pressable onPress={() => router.push('/birthdays')}>
              <Text className="text-[#36a9e2] text-xs font-bold">ראה הכל</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pr-6"
          >
            <View className="flex-row-reverse gap-3 pl-6">
              {birthdays.map((b) => (
                <View
                  key={b.id}
                  className="bg-white border border-gray-100 rounded-xl px-3 py-2 flex-row-reverse items-center gap-2 w-36 shadow-sm"
                >
                  <View
                    style={{ backgroundColor: b.color }}
                    className="size-9 rounded-full border border-gray-100"
                  />
                  <View className="flex-1">
                    <Text className="text-[#36a9e2] font-bold text-[9px] text-right leading-tight">
                      {b.time}:
                    </Text>
                    <Text className="text-[#111517] text-[13px] font-bold text-right truncate">
                      {b.name}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ציר זמן */}
        <View className="px-6 mb-4 flex-row-reverse justify-between items-center">
          <Text className="text-[#111517] text-lg font-bold">המשך היום</Text>
        </View>
        <View className="px-6 pb-48">
          {items.map((item, idx) => (
            <View key={item.id} className="flex-row-reverse gap-4">
              <View className="items-center w-12 pt-2">
                <Text className="text-base font-bold text-gray-400">
                  {item.time}
                </Text>
                {idx !== items.length - 1 && (
                  <View className="w-[2px] bg-gray-200 grow my-1 rounded-full" />
                )}
              </View>
              <View className="flex-1 pb-8">
                <View className="flex-row-reverse justify-between items-start mb-1">
                  <View className="flex-row-reverse items-start gap-3 flex-1">
                    {item.type === 'task' && (
                      <Pressable
                        onPress={() => toggleTask(item.id)}
                        className={`size-5 border-2 rounded mt-1 items-center justify-center ${item.completed ? 'bg-[#36a9e2] border-[#36a9e2]' : 'border-gray-300'}`}
                      >
                        {item.completed && (
                          <MaterialIcons name="check" size={14} color="white" />
                        )}
                      </Pressable>
                    )}
                    <View className="flex-1">
                      <View className="flex-row-reverse items-center gap-2">
                        <Text
                          style={[
                            styles.taskTitle,
                            item.completed && styles.completedText,
                          ]}
                          className="text-[#111517] text-base font-bold text-right"
                        >
                          {item.title}
                        </Text>
                        <View
                          style={{ backgroundColor: item.assigneeColor }}
                          className="size-6 rounded-full border border-white shadow-sm"
                        />
                      </View>
                      <Text className="text-gray-400 text-sm text-right mt-0.5">
                        {item.location}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{ backgroundColor: item.iconBg }}
                    className="size-8 rounded-full items-center justify-center shadow-sm"
                  >
                    <MaterialIcons
                      name={item.icon as any}
                      size={18}
                      color={item.iconColor}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* הודעת ברוכים הבאים - מיקום מתוקן */}
      {showToast && (
        <View className="absolute bottom-10 left-4 right-4 z-40 flex items-center pointer-events-none">
          <View
            style={styles.toastShadow}
            className="bg-white border border-[#36a9e2] rounded-[24px] px-4 py-4 flex-row-reverse items-start gap-3 w-full max-w-sm pointer-events-auto"
          >
            <View className="flex-1">
              <Text className="text-gray-700 text-sm leading-snug text-right">
                ברוכים הבאים הביתה, שקד! הכל מוכן. ה-AI של InYomi כבר התחילה
                לעבוד לסנכרן לך את היום.
              </Text>
            </View>
            <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
          </View>
        </View>
      )}

      {/* לחצן פלוס שפותח חלונית */}
      <Pressable
        onPress={() => setIsActionSheetVisible(true)}
        style={styles.fab}
        className="absolute bottom-28 left-5 bg-[#308ce8] size-14 rounded-2xl items-center justify-center"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      {/* חלונית פעולות (Action Sheet) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isActionSheetVisible}
        onRequestClose={() => setIsActionSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsActionSheetVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomSheetContainer}
        >
          <View className="bg-white rounded-t-[32px] px-6 pt-3 pb-12 shadow-2xl">
            <View className="w-10 h-1.5 bg-gray-200 rounded-full self-center mb-6" />
            <View className="bg-gray-50 border border-gray-100 rounded-2xl flex-row-reverse items-center px-4 py-3 mb-8">
              <MaterialIcons name="auto-awesome" size={20} color="#36a9e2" />
              <TextInput
                className="flex-1 text-right text-base font-medium px-3"
                placeholder="על מה את חושבת? או הדביקי הודעה..."
                placeholderTextColor="#94a3b8"
              />
              <View className="flex-row-reverse items-center gap-2">
                <MaterialIcons name="photo-camera" size={22} color="#94a3b8" />
                <MaterialIcons name="mic" size={22} color="#94a3b8" />
              </View>
            </View>
            <View className="flex-row-reverse justify-around items-center">
              <ActionButton
                icon="calendar-today"
                label="אירוע"
                onPress={() => setIsActionSheetVisible(false)}
              />
              <ActionButton
                icon="check"
                label="משימה"
                onPress={() => setIsActionSheetVisible(false)}
              />
              <ActionButton
                icon="cake"
                label="יום הולדת"
                onPress={() => {
                  setIsActionSheetVisible(false);
                  router.push('/birthdays');
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// קומפוננטת עזר
function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="items-center gap-2">
      <View className="size-16 rounded-full bg-[#f0f7ff] items-center justify-center">
        <MaterialIcons name={icon as any} size={28} color="#36a9e2" />
      </View>
      <Text className="text-sm font-bold text-[#111418]">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  toastShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  fab: {
    elevation: 8,
    shadowColor: '#308ce8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    zIndex: 100,
  },
  taskTitle: { textDecorationLine: 'none' },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
    opacity: 0.7,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
