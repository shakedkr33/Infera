import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useOnboarding } from '../contexts/OnboardingContext';

const profileColors = [
  '#FFD1DC',
  '#E0F2F1',
  '#FFF9C4',
  '#E1BEE7',
  '#F5F5F5',
  '#8B9F87',
];

export default function OnboardingStep4() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const [firstName, setFirstName] = useState(data.firstName || '');
  const [selectedColor, setSelectedColor] = useState(
    data.personalColor || '#8B9F87'
  );
  const [relatives, setRelatives] = useState<any[]>(data.relatives || []);
  const [expectedChildren, setExpectedChildren] = useState<number>(0);

  // ניהול עריכה והוספה
  const [pendingContact, setPendingContact] = useState<{
    id?: string;
    name: string;
    phone?: string;
    color?: string;
  } | null>(null);
  const [editedName, setEditedName] = useState('');
  const [tempColor, setTempColor] = useState('#8B9F87');

  // טעינת מספר ילדים צפוי מ-AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('childrenCount').then((count) => {
      if (count) {
        setExpectedChildren(Number.parseInt(count, 10));
      }
    });
  }, []);

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
          Alert.alert('איש קשר כבר קיים', 'הקרוב הזה כבר נמצא ברשימה.');
          return;
        }
        setPendingContact({ name: contact.name, phone });
        setEditedName(contact.name);
        setTempColor('#8B9F87');
      }
    }
  };

  const startEdit = (rel: any) => {
    setPendingContact(rel);
    setEditedName(rel.name);
    setTempColor(rel.color);
  };

  const saveEdit = () => {
    if (pendingContact && editedName.trim()) {
      if (pendingContact.id) {
        setRelatives((prev) =>
          prev.map((r) =>
            r.id === pendingContact.id
              ? {
                  ...r,
                  name: editedName.trim(),
                  color: tempColor,
                  initials: editedName.trim().substring(0, 2),
                }
              : r
          )
        );
      } else {
        const newRel = {
          id: Date.now().toString(),
          name: editedName.trim(),
          phone: pendingContact.phone,
          initials: editedName.trim().substring(0, 2),
          color: tempColor,
        };
        setRelatives([...relatives, newRel]);
        showInviteAlert(newRel.name, newRel.phone || '');
      }
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setPendingContact(null);
    setEditedName('');
    setTempColor('#8B9F87');
    Keyboard.dismiss();
  };

  const showInviteAlert = (name: string, _phone: string) => {
    setTimeout(() => {
      Alert.alert(
        `להזמין את ${name}?`,
        'שלחי הזמנה במייל כדי להתחיל לשתף משימות.',
        [
          { text: 'לא עכשיו', style: 'cancel' },
          { text: 'שלח הזמנה' },
        ]
      );
    }, 500);
  };

  const handleFinish = () => {
    updateData({ firstName, personalColor: selectedColor, relatives });
    // ישר להרשמה — כל נתוני ה-onboarding נאספו
    router.push('/(auth)/sign-up');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1 px-8"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 40, paddingBottom: 200 }}
          keyboardShouldPersistTaps="always"
        >
          {/* Header & Progress */}
          <View className="mb-6">
            <View className="flex-row-reverse items-center justify-between mb-4">
              <Pressable onPress={() => router.back()} className="p-2">
                <MaterialIcons
                  name="arrow-forward"
                  size={24}
                  color={colors.sage}
                />
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
                  className="h-1.5 flex-1 rounded-full"
                  style={{ backgroundColor: colors.sage }}
                />
              ))}
            </View>
          </View>

          <Text
            style={{ color: colors.slate }}
            className="text-[28px] font-bold mb-8 leading-tight text-right"
          >
            המרחב האישי שלך ב-InYomi
          </Text>

          {/* הודעת ילדים */}
          {expectedChildren > 0 && (
            <View
              className="rounded-2xl p-4 flex-row-reverse items-center gap-3 mb-6"
              style={{
                backgroundColor: 'rgba(139, 159, 135, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(139, 159, 135, 0.15)',
              }}
            >
              <MaterialIcons name="child-care" size={22} color={colors.sage} />
              <Text
                style={{ color: colors.sage }}
                className="text-sm font-bold text-right flex-1"
              >
                הוספת {expectedChildren} ילדים
              </Text>
            </View>
          )}

          {/* שם וצבע אישי */}
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

          <View className="mb-8">
            <Text className="text-sm font-bold mb-5 text-gray-800 text-right">
              בחירת צבע אישי
            </Text>
            <View className="flex-row justify-between">
              {profileColors.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    selectedColor === color && {
                      borderColor: colors.slate,
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
              <MaterialIcons
                name="workspace-premium"
                size={18}
                color={colors.sage}
              />
              <Text className="text-sm font-bold text-gray-800 text-right">
                קרובים (עד 6)
              </Text>
            </View>
            <Text className="text-[13px] text-gray-400 text-right mb-4">
              בחרי אנשים לשיתוף משימות ותזכורות אישיים בלבד.
            </Text>

            {relatives.map((rel) => {
              const isEditing = pendingContact?.id === rel.id;
              if (isEditing)
                return (
                  <View
                    key={rel.id}
                    className="bg-white border-2 p-4 rounded-2xl mb-4"
                    style={[styles.iosShadow, { borderColor: colors.sage }]}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Pressable onPress={cancelEdit} className="p-1">
                        <MaterialIcons
                          name="close"
                          size={20}
                          color="#9ca3af"
                        />
                      </Pressable>
                      <Text className="text-xs text-gray-400 text-right">
                        עריכת קרוב:
                      </Text>
                    </View>
                    <View className="flex-row-reverse items-center bg-[#f6f7f8] rounded-xl px-2 mb-4">
                      <Pressable onPress={saveEdit} className="p-1">
                        <MaterialIcons
                          name="check-circle"
                          size={30}
                          color="#10b981"
                        />
                      </Pressable>
                      <TextInput
                        value={editedName}
                        onChangeText={setEditedName}
                        className="flex-1 h-12 text-right text-lg font-bold text-[#111517] pr-2"
                      />
                    </View>
                    <View className="flex-row justify-between">
                      {profileColors.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setTempColor(c)}
                          style={[
                            {
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: c,
                            },
                            tempColor === c && {
                              borderColor: colors.slate,
                              borderWidth: 2,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                );

              return (
                <Pressable
                  key={rel.id}
                  onPress={() => startEdit(rel)}
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
                </Pressable>
              );
            })}

            {/* הוספת איש קשר חדש */}
            {pendingContact && !pendingContact.id && (
              <View
                className="bg-white border-2 p-4 rounded-2xl mb-4"
                style={[styles.iosShadow, { borderColor: colors.sage }]}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Pressable onPress={cancelEdit} className="p-1">
                    <MaterialIcons name="close" size={20} color="#9ca3af" />
                  </Pressable>
                  <Text className="text-xs text-gray-400 text-right">
                    הוספת קרוב:
                  </Text>
                </View>
                <View className="flex-row-reverse items-center bg-[#f6f7f8] rounded-xl px-2 mb-4">
                  <Pressable onPress={saveEdit} className="p-1">
                    <MaterialIcons
                      name="check-circle"
                      size={30}
                      color="#10b981"
                    />
                  </Pressable>
                  <TextInput
                    value={editedName}
                    onChangeText={setEditedName}
                    className="flex-1 h-12 text-right text-lg font-bold text-[#111517] pr-2"
                  />
                </View>
                <View className="flex-row justify-between">
                  {profileColors.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setTempColor(c)}
                      style={[
                        {
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: c,
                        },
                        tempColor === c && {
                          borderColor: colors.slate,
                          borderWidth: 2,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {!pendingContact && relatives.length < 6 && (
              <Pressable
                onPress={pickContact}
                className="w-full py-5 border-2 border-dashed border-gray-200 rounded-2xl flex-row items-center justify-center gap-2"
              >
                <MaterialIcons
                  name="contact-page"
                  size={20}
                  color={colors.sage}
                />
                <Text style={{ color: colors.sage }} className="font-bold text-lg">
                  {relatives.length === 0
                    ? 'הוספת קרוב מאנשי הקשר'
                    : 'הוספת קרוב נוסף'}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View className="px-8 pb-10 pt-4 bg-white/95 border-t border-gray-100">
          <Pressable
            onPress={handleFinish}
            disabled={!firstName}
            className="w-full h-16 rounded-2xl items-center justify-center shadow-md"
            style={{
              backgroundColor: firstName ? colors.sage : '#e5e7eb',
            }}
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
  colorCircle: { width: 44, height: 44, borderRadius: 22 },
});
