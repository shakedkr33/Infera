import { useCallback, useEffect, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 44;
// 5 visible items: the center row (index 2) is the selected value.
// paddingVertical = 2 * ITEM_HEIGHT so the first and last items can reach center.
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function fmt2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Clamp offsetY to a valid array index for `items`. */
function resolveIndex(offsetY: number, itemCount: number): number {
  return Math.max(
    0,
    Math.min(itemCount - 1, Math.round(offsetY / ITEM_HEIGHT))
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TimeWheelPickerProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeWheelPicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: TimeWheelPickerProps): React.JSX.Element {
  const hourScroll = useRef<ScrollView>(null);
  const minuteScroll = useRef<ScrollView>(null);

  // Track the last value that was committed (either programmatically or via
  // user gesture) to prevent echo re-snaps and duplicate callbacks.
  // Initialized to -1 so the first external value always triggers a scroll.
  const lastCommittedHour = useRef<number>(-1);
  const lastCommittedMinute = useRef<number>(-1);

  // ── Sync hour wheel when the prop genuinely changes from outside ───────────
  // Skips re-snap when the parent echoes back a value we just emitted.
  useEffect(() => {
    const h = Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 9;
    if (h === lastCommittedHour.current) return;
    lastCommittedHour.current = h;
    const timer = setTimeout(() => {
      hourScroll.current?.scrollTo({ y: h * ITEM_HEIGHT, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [hour]);

  // ── Sync minute wheel when the prop genuinely changes from outside ─────────
  useEffect(() => {
    const m = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0;
    if (m === lastCommittedMinute.current) return;
    lastCommittedMinute.current = m;
    const timer = setTimeout(() => {
      minuteScroll.current?.scrollTo({ y: m * ITEM_HEIGHT, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [minute]);

  // ── Emit helpers ───────────────────────────────────────────────────────────
  // Both onScrollEndDrag and onMomentumScrollEnd call these.
  // The lastCommitted ref prevents duplicate effective callbacks when both
  // events fire for the same gesture (normal momentum fling).
  // A slow drag that settles at a different position than its drag-end point
  // will emit both values: the drag-end approximation first, then the final
  // snapped value — the later value remains authoritative.

  const emitHour = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const index = resolveIndex(e.nativeEvent.contentOffset.y, HOURS.length);
      const next = HOURS[index];
      if (next === undefined || next === lastCommittedHour.current) return;
      lastCommittedHour.current = next;
      onHourChange(next);
    },
    [onHourChange]
  );

  const emitMinute = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const index = resolveIndex(e.nativeEvent.contentOffset.y, MINUTES.length);
      const next = MINUTES[index];
      if (next === undefined || next === lastCommittedMinute.current) return;
      lastCommittedMinute.current = next;
      onMinuteChange(next);
    },
    [onMinuteChange]
  );

  return (
    <View style={s.container}>
      {/* Selection band — sits behind the scroll columns */}
      <View style={s.indicator} />

      <View style={s.columns}>
        {/* Hour column */}
        <NativeViewGestureHandler disallowInterruption={true}>
          <ScrollView
            ref={hourScroll}
            style={s.column}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onScrollEndDrag={emitHour}
            onMomentumScrollEnd={emitHour}
            contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
            accessible={true}
            accessibilityLabel="שעות"
            accessibilityRole="adjustable"
            accessibilityValue={{ text: fmt2(hour) }}
          >
            {HOURS.map((h) => (
              <View key={`hour-${h}`} style={s.item}>
                <Text style={[s.itemText, h === hour && s.itemTextActive]}>
                  {fmt2(h)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </NativeViewGestureHandler>

        {/* Static colon separator */}
        <View style={s.colon}>
          <Text style={s.colonText}>:</Text>
        </View>

        {/* Minute column */}
        <NativeViewGestureHandler disallowInterruption={true}>
          <ScrollView
            ref={minuteScroll}
            style={s.column}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onScrollEndDrag={emitMinute}
            onMomentumScrollEnd={emitMinute}
            contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
            accessible={true}
            accessibilityLabel="דקות"
            accessibilityRole="adjustable"
            accessibilityValue={{ text: fmt2(minute) }}
          >
            {MINUTES.map((m) => (
              <View key={`minute-${m}`} style={s.item}>
                <Text style={[s.itemText, m === minute && s.itemTextActive]}>
                  {fmt2(m)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </NativeViewGestureHandler>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    // Clock always reads left→right regardless of app RTL setting.
    // Without this, React Native's RTL mode flips 'flexDirection: row' inside
    // the columns view, placing hours on the right and minutes on the left.
    direction: 'ltr',
  },
  indicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    marginTop: -(ITEM_HEIGHT / 2),
    backgroundColor: '#36a9e215',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#36a9e230',
    zIndex: 1,
    pointerEvents: 'none',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  column: { flex: 1 },
  colon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: CONTAINER_HEIGHT,
    zIndex: 2,
  },
  colonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { fontSize: 22, color: '#9ca3af' },
  itemTextActive: { color: '#111517', fontWeight: '700' },
});
