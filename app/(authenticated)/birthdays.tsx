import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import type { Birthday } from '@/lib/types/birthday';
import { getCountdownLabel } from '@/lib/utils/birthday';

const PRIMARY = '#36a9e2';

export default function BirthdaysScreen(): React.JSX.Element {
  const { openBirthdayCard, openBirthdayCreate, birthdays } =
    useBirthdaySheets();
  const [search, setSearch] = useState('');

  const filteredBirthdays = birthdays.filter((b) => b.name.includes(search));

  const renderItem = ({ item }: { item: Birthday }): React.JSX.Element => (
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
  );

  const listFooter = (
    <Pressable
      style={s.importBtn}
      onPress={openBirthdayCreate}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="ייבוא מאנשי קשר"
    >
      <MaterialIcons name="contacts" size={22} color={PRIMARY} />
      <Text style={s.importBtnText}>ייבוא מאנשי קשר</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🎂 ימי הולדת</Text>
        <Pressable
          onPress={openBirthdayCreate}
          style={s.addBtn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף יום הולדת"
        >
          <MaterialIcons name="add" size={24} color={PRIMARY} />
        </Pressable>
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
        ListFooterComponent={listFooter}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111517' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
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
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    height: 56,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: `${PRIMARY}20`,
    borderStyle: 'dashed',
  },
  importBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY,
  },
});
