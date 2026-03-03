import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';

const FILTER_CHIPS = ['הכל', 'גן', 'בית ספר', 'חוג', 'משפחה', 'עבודה', 'אישי'] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];

type UserRole = 'owner' | 'admin' | 'member';

interface CommunityItem {
  community: {
    _id: Id<'communities'>;
    name: string;
    description?: string;
    tags?: string[];
    inviteCode: string;
    createdAt: number;
    color?: string;
  };
  role: UserRole;
  pinned: boolean;
}

interface MenuPosition { x: number; y: number }

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.colorBar, { backgroundColor: '#e5e7eb' }]} />
      <View style={styles.cardInner}>
        <View style={[styles.skeletonLine, { width: '65%' }]} />
        <View style={[styles.skeletonLine, { width: '35%', marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '50%', marginTop: 6, height: 10 }]} />
      </View>
    </View>
  );
}

// ─── Community Card ───────────────────────────────────────────────────────────

interface CardProps {
  item: CommunityItem;
  onPinToggle: () => void;
  onMenuPress: (ref: View | null) => void;
  onPress: () => void;
}

function CommunityCard({ item, onPinToggle, onMenuPress, onPress }: CardProps) {
  const { community, pinned } = item;
  const menuRef = useRef<View>(null);
  const firstTag = community.tags?.[0];

  return (
    <Pressable
      style={styles.cardWrapper}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`קהילה: ${community.name}`}
    >
      {/* פס צבע ימין */}
      <View
        style={[styles.colorBar, { backgroundColor: community.color ?? PRIMARY }]}
      />

      <View style={styles.cardInner}>
        {/* שורה עליונה: שם + כפתורים */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {community.name}
          </Text>
          <View style={styles.cardActions}>
            {/* נעץ */}
            <Pressable
              onPress={onPinToggle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={pinned ? 'בטל הצמדה' : 'הצמד'}
            >
              <MaterialIcons
                name="push-pin"
                size={16}
                color={pinned ? PRIMARY : '#d1d5db'}
              />
            </Pressable>
            {/* תפריט */}
            <View ref={menuRef}>
              <Pressable
                onPress={() => onMenuPress(menuRef.current)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible
                accessibilityRole="button"
                accessibilityLabel="אפשרויות"
              >
                <MaterialIcons name="more-vert" size={18} color="#9ca3af" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* tag ראשון */}
        {firstTag ? (
          <View style={styles.tagChip}>
            <Text style={styles.tagText}>{firstTag}</Text>
          </View>
        ) : (
          <View style={styles.tagPlaceholder} />
        )}

        {/* מספר חברים – TODO: חבר ל-memberCount אמיתי */}
        <Text style={styles.memberCount}>חברים</Text>
      </View>
    </Pressable>
  );
}

// ─── Popover Menu ─────────────────────────────────────────────────────────────

interface PopoverMenuProps {
  visible: boolean;
  position: MenuPosition;
  item: CommunityItem | null;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

function PopoverMenu({
  visible,
  position,
  item,
  onClose,
  onEdit,
  onShare,
  onTogglePin,
  onDelete,
}: PopoverMenuProps) {
  if (!item) return null;

  const menuItems = [
    {
      label: 'עריכת קהילה',
      icon: 'edit' as const,
      onPress: onEdit,
      danger: false,
    },
    {
      label: 'שיתוף קישור',
      icon: 'share' as const,
      onPress: onShare,
      danger: false,
    },
    {
      label: item.pinned ? 'בטל נעיצה' : 'נעץ קהילה',
      icon: 'push-pin' as const,
      onPress: onTogglePin,
      danger: false,
    },
    ...(item.role === 'owner'
      ? [
          {
            label: 'מחיקת קהילה',
            icon: 'delete-outline' as const,
            onPress: onDelete,
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.popoverBackdrop} onPress={onClose} />
      <View
        style={[
          styles.popover,
          { top: position.y, right: position.x },
        ]}
      >
        {menuItems.map((m, idx) => (
          <Pressable
            key={m.label}
            style={[
              styles.popoverItem,
              idx < menuItems.length - 1 && styles.popoverItemBorder,
            ]}
            onPress={() => {
              onClose();
              m.onPress();
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={m.label}
          >
            <Text style={[styles.popoverLabel, m.danger && styles.popoverDanger]}>
              {m.label}
            </Text>
            <MaterialIcons
              name={m.icon}
              size={18}
              color={m.danger ? '#ef4444' : '#374151'}
            />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunitiesScreen() {
  const router = useRouter();

  const communitiesData = useQuery(api.communities.listMyCommunities);
  const togglePinned = useMutation(api.communities.togglePinned);
  const deleteCommunity = useMutation(api.communities.deleteCommunity);

  const [activeFilter, setActiveFilter] = useState<FilterChip>('הכל');
  const [menuItem, setMenuItem] = useState<CommunityItem | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPosition>({ x: 16, y: 200 });

  // ── סינון לפי chip
  const filtered = (communitiesData ?? []).filter((row) => {
    if (activeFilter === 'הכל') return true;
    return row.community.tags?.includes(activeFilter) ?? false;
  });

  // ── פתיחת תפריט עם מיקום
  const handleMenuPress = useCallback(
    (item: CommunityItem, viewRef: View | null) => {
      if (!viewRef) {
        setMenuPos({ x: 16, y: 200 });
        setMenuItem(item);
        return;
      }
      viewRef.measure((_fx, _fy, _w, _h, px, py) => {
        setMenuPos({ x: 16, y: py + _h + 4 });
        setMenuItem(item);
      });
    },
    []
  );

  const handleTogglePin = useCallback(
    (communityId: Id<'communities'>) => {
      togglePinned({ communityId }).catch(() =>
        Alert.alert('שגיאה', 'לא ניתן לשנות הצמדה')
      );
    },
    [togglePinned]
  );

  const handleDelete = useCallback(
    (item: CommunityItem) => {
      Alert.alert(
        'מחיקת קהילה',
        `האם למחוק את "${item.community.name}"? פעולה זו אינה הפיכה.`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: () => {
              deleteCommunity({ communityId: item.community._id }).catch(() =>
                Alert.alert('שגיאה', 'לא ניתן למחוק את הקהילה')
              );
            },
          },
        ]
      );
    },
    [deleteCommunity]
  );

  const isLoading = communitiesData === undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── כותרת */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>הקהילות שלי</Text>
        <Pressable
          onPress={() => router.push('/(authenticated)/community-create')}
          style={styles.addBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="צור קהילה חדשה"
        >
          <MaterialIcons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Chips סינון */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {[...FILTER_CHIPS].reverse().map((chip) => {
          const active = chip === activeFilter;
          return (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveFilter(chip)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={chip}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Grid */}
      {isLoading ? (
        <FlatList
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => String(i)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={() => <SkeletonCard />}
        />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="people-outline" size={60} color="#d1d5db" />
          <Text style={styles.emptyTitle}>
            {activeFilter === 'הכל' ? 'עדיין אין קהילות' : `אין קהילות בקטגוריה "${activeFilter}"`}
          </Text>
          {activeFilter === 'הכל' && (
            <Pressable
              style={styles.createBtn}
              onPress={() => router.push('/(authenticated)/community-create')}
              accessible
              accessibilityRole="button"
              accessibilityLabel="צור קהילה ראשונה"
            >
              <Text style={styles.createBtnText}>+ צור קהילה ראשונה</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList<CommunityItem>
          data={filtered}
          keyExtractor={(item) => item.community._id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CommunityCard
              item={item}
              onPinToggle={() => handleTogglePin(item.community._id)}
              onMenuPress={(ref) => handleMenuPress(item, ref)}
              onPress={() => {
                // TODO: implement community detail screen
                router.push(
                  `/(authenticated)/communities/${item.community._id}` as Parameters<typeof router.push>[0]
                );
              }}
            />
          )}
        />
      )}

      {/* ── Popover תפריט */}
      <PopoverMenu
        visible={menuItem !== null}
        position={menuPos}
        item={menuItem}
        onClose={() => setMenuItem(null)}
        onEdit={() => {
          if (!menuItem) return;
          // TODO: create edit community screen
          router.push(
            `/(authenticated)/community-edit/${menuItem.community._id}` as Parameters<typeof router.push>[0]
          );
        }}
        onShare={() => {
          if (!menuItem) return;
          const url = `https://inyomi.app/join/${menuItem.community.inviteCode}`;
          Share.share({ message: url });
        }}
        onTogglePin={() => {
          if (!menuItem) return;
          handleTogglePin(menuItem.community._id);
        }}
        onDelete={() => {
          if (!menuItem) return;
          handleDelete(menuItem);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Chips
  chipsScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    maxHeight: 52,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: PRIMARY,
  },
  chipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },

  // ── Grid
  listContent: {
    padding: 16,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },

  // ── Card
  cardWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  colorBar: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    padding: 12,
    alignItems: 'flex-end',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    writingDirection: 'rtl',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  tagChip: {
    marginTop: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-end',
  },
  tagText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  tagPlaceholder: {
    height: 18,
    marginTop: 8,
  },
  memberCount: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'right',
  },

  // ── Skeleton
  skeletonLine: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 7,
    alignSelf: 'flex-end',
  },

  // ── Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  createBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Popover
  popoverBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popover: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  popoverItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  popoverItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  popoverLabel: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
  },
  popoverDanger: {
    color: '#ef4444',
  },
});
