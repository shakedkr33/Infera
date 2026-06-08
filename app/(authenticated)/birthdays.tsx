import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainScreenHeader } from '@/components/MainScreenHeader';
import {
  AddPersonBottomSheet,
  type SelectedContactData,
} from '@/components/onboarding/AddPersonBottomSheet';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import type { Birthday } from '@/lib/types/birthday';
import { getCountdownLabel } from '@/lib/utils/birthday';

const PRIMARY = '#36a9e2';

export default function BirthdaysScreen(): React.JSX.Element {
  const { openBirthdayCard, openBirthdayEdit, deleteBirthday, birthdays } =
    useBirthdaySheets();
  const [search, setSearch] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const handleSwipeDelete = (birthday: Birthday): void => {
    Alert.alert('מחיקה', 'האם למחוק את יום ההולדת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => deleteBirthday(birthday.id),
      },
    ]);
  };

  const filteredBirthdays = birthdays.filter((b) => b.name.includes(search));

  const handleContactSelected = (data: SelectedContactData): void => {
    const prefill: Birthday = {
      id: '',
      name: data.name,
      day: 1,
      month: new Date().getMonth() + 1,
      year: null,
      photoUri: null,
      contactId: data.contactId ?? null,
      source: 'contact',
      phoneNumber: data.phone ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    openBirthdayEdit(prefill);
  };

  const renderItem = ({ item }: { item: Birthday }): React.JSX.Element => {
    const renderDeleteAction = () => (
      <Pressable
        style={s.swipeDeleteAction}
        onPress={() => handleSwipeDelete(item)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`מחק את יום ההולדת של ${item.name}`}
      >
        <MaterialIcons name="delete-outline" size={26} color="#ffffff" />
        <Text style={s.swipeActionLabel}>מחק</Text>
      </Pressable>
    );

    return (
      <Swipeable renderRightActions={renderDeleteAction}>
        <Pressable
          style={s.card}
          onPress={() => openBirthdayCard(item)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`יום הולדת ${item.name}`}
        >
          <View style={s.cardContent}>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.initials}>{item.name.substring(0, 2)}</Text>
              </View>
            )}
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{item.name}</Text>
              <View style={s.cardBadge}>
                <Text style={s.cardBadgeText}>{getCountdownLabel(item)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.cardDate}>
            {item.day}.{item.month}
          </Text>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.headerSurface}>
        <MainScreenHeader
          title="ימי הולדת 🎂"
          showAdd={true}
          onAdd={() => setShowAddSheet(true)}
          returnTo="/(authenticated)/birthdays"
        />
      </View>

      <View style={s.searchContainer}>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="חיפוש לפי שם..."
            placeholderTextColor="#9ca3af"
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
            accessible={true}
            accessibilityLabel="חיפוש ימי הולדת"
          />
        </View>
      </View>

      <FlatList
        data={filteredBirthdays}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      <AddPersonBottomSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onContactSelected={handleContactSelected}
        onManual={() => openBirthdayEdit(undefined)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerSurface: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: { paddingHorizontal: 24, paddingVertical: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111517' },
  listContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#f1f5f9',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f1f5f9',
  },
  initials: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 4,
  },
  cardBadge: {
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardBadgeText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  cardDate: { fontSize: 12, color: '#9ca3af' },
  swipeDeleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 12,
    borderRadius: 24,
    gap: 4,
  },
  swipeActionLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
