import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainScreenHeader } from '@/components/MainScreenHeader';
import { colors } from '@/constants/theme';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import type { Birthday } from '@/lib/types/birthday';
import { getCountdownLabel } from '@/lib/utils/birthday';
import { APP_IS_RTL, needsExplicitRTL, rtl } from '@/lib/rtl';

const ANDROID_MATCH_IOS_LAYOUT = Platform.OS === 'android' && APP_IS_RTL;

const PRIMARY = colors.primaryDark;

export default function BirthdaysScreen(): React.JSX.Element {
  const { openBirthdayCard, openBirthdayAddChoice, deleteBirthday, birthdays } =
    useBirthdaySheets();
  const [search, setSearch] = useState('');

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
    <SafeAreaView style={[{ flex: 1, backgroundColor: '#fff' }, ANDROID_MATCH_IOS_LAYOUT ? s.safeAreaRtl : null]}>
      <View style={s.headerSurface}>
        <MainScreenHeader
          title="ימי הולדת 🎂"
          showAdd={true}
          onAdd={() => {
            if (__DEV__) {
              console.log('[Birthdays] + tapped → openBirthdayAddChoice');
            }
            openBirthdayAddChoice();
          }}
          returnTo="/(authenticated)/birthdays"
        />
      </View>

      <View style={s.searchContainer}>
        <View style={s.searchBox}>
          <TextInput
            placeholder="חיפוש לפי שם..."
            placeholderTextColor="#9ca3af"
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            textAlign={rtl.inputTextAlign}
            accessible={true}
            accessibilityLabel="חיפוש ימי הולדת"
          />
          <MaterialIcons name="search" size={20} color="#94a3b8" />
        </View>
      </View>

      <FlatList
        data={filteredBirthdays}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeAreaRtl: {
    direction: 'rtl',
  },
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
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111517', textAlign: rtl.inputTextAlign },
  listContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  card: {
    flexDirection: rtl.flexDirection,
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
    flexDirection: rtl.flexDirection,
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
    textAlign: rtl.textAlign,
    marginBottom: 4,
  },
  cardBadge: {
    backgroundColor: '#eff6ff',
    alignSelf: needsExplicitRTL() ? 'flex-end' : 'flex-start',
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
