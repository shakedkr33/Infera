import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

// ============================================================================
// מסך "נמחקו לאחרונה"
// ============================================================================

function formatDeletedDate(deletedAt: number | undefined): string {
  if (!deletedAt) return '';
  return new Date(deletedAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
}

function daysLeft(deleteExpiresAt: number | undefined): number | null {
  if (!deleteExpiresAt) return null;
  const diff = deleteExpiresAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export default function RecentlyDeletedScreen() {
  const router = useRouter();
  const deletedItems = useQuery(api.tasks.listRecentlyDeleted);
  const restoreTaskMutation = useMutation(api.tasks.restoreTask);

  const handleRestore = async (id: Id<'tasks'>, title: string) => {
    try {
      await restoreTaskMutation({ id });
    } catch (error) {
      console.error('restoreTask error:', error);
      Alert.alert('שגיאה', `לא הצלחנו לשחזר את "${title}". נסה שוב.`);
    }
  };

  const isEmpty = (deletedItems ?? []).length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          hitSlop={12}
        >
          <MaterialIcons name="chevron-right" size={28} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>נמחקו לאחרונה</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Explanatory text */}
        <Text style={styles.explanationText}>
          פריטים שנמחקו נשמרים כאן למשך 30 יום.
        </Text>

        {isEmpty ? (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <MaterialIcons name="delete-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>
              אין כאן פריטים שנמחקו לאחרונה.
            </Text>
          </View>
        ) : (
          /* Deleted items list */
          <View style={styles.listContainer}>
            {(deletedItems ?? []).map((item) => {
              const days = daysLeft(item.deleteExpiresAt ?? undefined);
              const deletedDate = formatDeletedDate(
                item.deletedAt ?? undefined
              );
              return (
                <View key={String(item.id)} style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <View style={styles.itemTypeRow}>
                      <View style={styles.typeChip}>
                        <Text style={styles.typeChipText}>משימה</Text>
                      </View>
                      {deletedDate ? (
                        <Text style={styles.deletedDateText}>
                          נמחק {deletedDate}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {days !== null && days > 0 ? (
                      <Text style={styles.daysLeftText}>
                        {days === 1 ? 'נשאר יום אחד' : `נשארו ${days} ימים`}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.restoreButton}
                    onPress={() =>
                      handleRestore(item.id as Id<'tasks'>, item.title)
                    }
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`שחזור: ${item.title}`}
                    hitSlop={8}
                  >
                    <MaterialIcons name="restore" size={20} color="#36a9e2" />
                    <Text style={styles.restoreButtonText}>שחזר</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7f8',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  explanationText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'right',
    marginBottom: 16,
  },

  /* Empty state */
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  /* List */
  listContainer: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemContent: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTypeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeChipText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  deletedDateText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111517',
    textAlign: 'right',
  },
  daysLeftText: {
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'right',
  },

  /* Restore button */
  restoreButton: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  restoreButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#36a9e2',
  },

  bottomSpacer: {
    height: 40,
  },
});
