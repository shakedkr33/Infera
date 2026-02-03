import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useOnboarding } from './contexts/OnboardingContext';

const colors = [
  '#FFD1DC',
  '#E0F2F1',
  '#FFF9C4',
  '#E1BEE7',
  '#F5F5F5',
  '#36a9e2',
];

export default function OnboardingStep4() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const [firstName, setFirstName] = useState(data.firstName || '');
  const [selectedColor, setSelectedColor] = useState(
    data.personalColor || '#36a9e2'
  );
  const [relatives, setRelatives] = useState<any[]>(data.relatives || []);

  const [pendingContact, setPendingContact] = useState<{
    name: string;
    phone?: string;
  } | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isNameEdited, setIsNameEdited] = useState(false);

  const pickContact = async () => {
    if (relatives.length >= 6) {
      Alert.alert('הגעת למכסה', 'ניתן להוסיף עד 6 קרובים בלבד.');
      return;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const contact = await Contacts.presentContactPickerAsync();
      if (contact) {
        const phone = contact.phoneNumbers?.[0]?.number;
        if (relatives.some((r) => r.phone === phone)) {
          Alert.alert('איש קשר כבר קיים', 'כבר הוספת את הקרוב הזה.');
          return;
        }
        setPendingContact({ name: contact.name, phone });
        setEditedName(contact.name);
        setIsNameEdited(false);
      }
    }
  };

  const confirmRelative = (color: string) => {
    if (pendingContact && editedName.trim()) {
      const newRel = {
        id: Date.now().toString(),
        name: editedName.trim(),
        phone: pendingContact.phone,
        initials: editedName.trim().substring(0, 2),
        color: color,
      };

      setRelatives([...relatives, newRel]);
      setPendingContact(null);
      setEditedName('');
      setIsNameEdited(false);

      setTimeout(() => {
        Alert.alert(
          'להזמין את ' + newRel.name + '?',
          'האם לשלוח הזמנה להצטרפות ל-Infera במייל?',
          [
            { text: 'לא עכשיו', style: 'cancel' },
            {
              text: 'שלח הזמנה',
              onPress: () => console.log('Invite sent to: ' + newRel.phone),
            },
          ]
        );
      }, 500);
    }
  };

  const handleFinish = () => {
    updateData({ firstName, personalColor: selectedColor, relatives });
    router.replace('/home-preview');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1 px-8"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 40, paddingBottom: 160 }}
          keyboardShouldPersistTaps="always"
        >
          {/* Header */}
          <View className="mb-6">
            <View className="flex-row-reverse items-center justify-between mb-4">
              <Pressable onPress={() => router.back()} className="p-2">
                <MaterialIcons name="arrow-forward" size={24} color="#36a9e2" />
              </Pressable>
              <Text className="text-gray-400 font-medium text-xs">
                שלב 4 מתוך 4
              </Text>
              <View className="w-10" />
            </View>
            <View className="flex-row gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <View
                  key={s}
                  className="h-1.5 flex-1 rounded-full bg-[#36a9e2]"
                />
              ))}
            </View>
          </View>

          <Text className="text-[28px] font-bold text-center mb-8 text-gray-900">
            המרחב האישי שלך ב-Infera
          </Text>

          {/* שם פרטי */}
          <View className="mb-8">
            <Text className="text-sm font-bold mb-2 text-gray-800 text-right">
              שם פרטי (חובה)
            </Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="איך לקרוא לך?"
              className="w-full bg-[#f6f7f8] h-14 px-4 rounded-2xl text-lg text-right"
              style={styles.iosShadow}
            />
          </View>

          {/* צבע אישי */}
          <View className="mb-8">
            <Text className="text-sm font-bold mb-5 text-gray-800 text-right">
              בחירת צבע אישי (אופציונלי)
            </Text>
            <View className="flex-row justify-between">
              {colors.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    selectedColor === color && {
                      borderColor: '#111517',
                      borderWidth: 2,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* קרובים */}
          <View className="mb-10">
            <View className="flex-row-reverse items-center gap-1.5 mb-2">
              <MaterialIcons name="crown" size={18} color="#0ea5e9" />
              <Text className="text-sm font-bold text-gray-800">
                קרובים (עד 6)
              </Text>
            </View>

            {/* רשימת קרובים קיימת */}
            {relatives.map((rel) => (
              <View
                key={rel.id}
                className="bg-[#f6f7f8] p-4 rounded-2xl flex-row items-center justify-between mb-4"
                style={styles.iosShadow}
              >
                <Pressable
                  onPress={() =>
                    setRelatives(relatives.filter((r) => r.id !== rel.id))
                  }
                  className="p-2"
                >
                  <MaterialIcons name="close" size={20} color="#9ca3af" />
                </Pressable>
                <View className="flex-row items-center gap-3">
                  <Text className="font-bold text-[15px] text-gray-900">
                    {rel.name}
                  </Text>
                  <View
                    style={{ backgroundColor: rel.color }}
                    className="w-10 h-10 rounded-full items-center justify-center"
                  >
                    <Text className="text-xs font-bold opacity-70">
                      {rel.initials}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* תיבת עריכה והוספה */}
            {pendingContact ? (
              <View
                className="bg-white border-2 border-[#36a9e2] p-5 rounded-2xl mb-4"
                style={styles.iosShadow}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Pressable onPress={() => setPendingContact(null)}>
                    <MaterialIcons name="close" size={20} color="#9ca3af" />
                  </Pressable>
                  <Text className="text-right text-xs text-gray-400">
                    עריכת שם ובחירת צבע:
                  </Text>
                </View>

                <View className="flex-row-reverse items-center bg-[#f6f7f8] rounded-xl px-3 mb-4">
                  {isNameEdited && (
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsNameEdited(false);
                      }}
                      className="p-1"
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={28}
                        color="#10b981"
                      />
                    </Pressable>
                  )}
                  <TextInput
                    value={editedName}
                    onChangeText={(t) => {
                      setEditedName(t);
                      setIsNameEdited(true);
                    }}
                    className="flex-1 h-12 text-right text-lg font-bold text-[#111517] pr-2"
                  />
                </View>

                <View className="flex-row justify-between">
                  {colors.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => confirmRelative(color)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : (
              relatives.length < 6 && (
                <Pressable
                  onPress={pickContact}
                  className="w-full py-5 border-2 border-dashed border-gray-200 rounded-2xl flex-row items-center justify-center gap-2"
                >
                  <MaterialIcons
                    name="contact-page"
                    size={20}
                    color="#36a9e2"
                  />
                  <Text className="text-[#36a9e2] font-bold text-lg">
                    {relatives.length === 0
                      ? 'הוספת קרוב מאנשי הקשר'
                      : 'הוספת קרוב נוסף'}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </ScrollView>

        {/* Footer קבוע בתחתית - מחוץ ל-ScrollView כדי שלא יוכפל */}
        <View className="absolute bottom-0 left-0 right-0 px-8 pb-10 pt-4 bg-white/95 border-t border-gray-100">
          <Pressable
            onPress={handleFinish}
            disabled={!firstName}
            className={`w-full h-16 rounded-2xl items-center justify-center ${firstName ? 'bg-[#36a9e2]' : 'bg-gray-200'}`}
          >
            <Text className="text-white font-bold text-lg">
              סיימנו, בואו נתחיל!
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
