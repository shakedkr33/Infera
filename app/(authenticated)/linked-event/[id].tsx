// FIXED: read-only detail screen for linked (shared) events
//        shows live data from source; falls back to snapshot when sourceStatus='deleted'
//        actions: "צור עותק עצמאי" + "הסר מיומן"
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { LinkedEventBanner } from '@/lib/components/event/LinkedEventBanner';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = '#36a9e2';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LinkedEventDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const linkedEventId = id as Id<'linkedEvents'>;

  const detail = useQuery(api.linkedEvents.getLinkedEventDetail, {
    linkedEventId,
  });
  const deleteLinkedEvent = useMutation(api.linkedEvents.deleteLinkedEvent);
  const copyLinkedEvent = useMutation(api.linkedEvents.copyLinkedEvent);
  const [copying, setCopying] = useState(false);

  const handleRemove = useCallback(() => {
    Alert.alert(
      'הסרת אירוע',
      'האם להסיר אירוע זה מהיומן שלך?\n\nהאירוע המקורי לא יושפע.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLinkedEvent({ linkedEventId });
              router.back();
            } catch {
              Alert.alert('שגיאה', 'לא ניתן להסיר את האירוע');
            }
          },
        },
      ]
    );
  }, [linkedEventId, deleteLinkedEvent, router]);

  const handleCopy = useCallback(async () => {
    setCopying(true);
    try {
      await copyLinkedEvent({ linkedEventId });
      Alert.alert('עותק נוצר', 'עותק אישי נוצר ביומן שלך', [
        {
          text: 'אישור',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן ליצור עותק');
    } finally {
      setCopying(false);
    }
  }, [linkedEventId, copyLinkedEvent, router]);

  // ── Loading
  if (detail === undefined) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Not found / no access
  if (detail === null) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.headerSide} />
          <Text style={s.headerTitle}>אירוע משותף</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.headerSide}
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
          <Text style={s.notFoundText}>אירוע לא נמצא</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = detail.sourceStatus as 'active' | 'cancelled' | 'deleted';
  const ownerName = detail.ownerName as string | null;
  const isCopySafe = status !== 'cancelled'; // allow copy of cancelled events only if useful — keep for now

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header — RTL: right=back, center=title, left=remove */}
      <View style={s.header}>
        {/* Left: remove */}
        <TouchableOpacity
          onPress={handleRemove}
          style={s.headerSide}
          accessible
          accessibilityRole="button"
          accessibilityLabel="הסר מיומן"
        >
          <Ionicons name="trash-outline" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Center */}
        <Text style={s.headerTitle} numberOfLines={1}>
          {detail.title}
        </Text>

        {/* Right: back */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.headerSide}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חזור"
        >
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Shared / status banner */}
        <LinkedEventBanner ownerName={ownerName} sourceStatus={status} />

        {/* Details card */}
        <View style={s.card}>
          {/* Date */}
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
            <Text style={s.detailText}>
              {formatFullDate(detail.startTime)}
            </Text>
          </View>

          {/* Time */}
          <View style={s.detailRow}>
            <Ionicons name="time-outline" size={18} color={PRIMARY} />
            <Text style={s.detailText}>
              {detail.allDay
                ? 'כל היום'
                : `${formatTime(detail.startTime)} — ${formatTime(detail.endTime)}`}
            </Text>
          </View>

          {/* Location */}
          {detail.location ? (
            <View style={s.detailRow}>
              <Ionicons name="location-outline" size={18} color={PRIMARY} />
              <Text style={s.detailText}>{detail.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Read-only notice */}
        <View style={s.readOnlyNote}>
          <Ionicons name="lock-closed-outline" size={14} color="#9ca3af" />
          <Text style={s.readOnlyText}>
            אין אפשרות לערוך אירוע משותף. צור עותק עצמאי אם ברצונך לשנות פרטים.
          </Text>
        </View>

        {/* Create copy action */}
        {isCopySafe && (
          <Pressable
            style={[s.copyBtn, copying && s.copyBtnDisabled]}
            onPress={handleCopy}
            disabled={copying}
            accessible
            accessibilityRole="button"
            accessibilityLabel="צור עותק עצמאי"
          >
            {copying ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={PRIMARY} />
                <Text style={s.copyBtnText}>צור עותק עצמאי</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f8' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },

  // ── Header (RTL: flex-row-reverse → right=first child, left=last child)
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  headerSide: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // ── Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'right',
    flex: 1,
  },

  // ── Read-only notice
  readOnlyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  readOnlyText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    flex: 1,
    lineHeight: 18,
  },

  // ── Copy button
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    height: 50,
    marginTop: 4,
  },
  copyBtnDisabled: { opacity: 0.5 },
  copyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
});
