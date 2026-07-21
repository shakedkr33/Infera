import React, { useCallback, useEffect, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type ScrollView as RNScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// Fix 2: gesture-handler ScrollView uses native gesture recognisers instead of
// RN's JS responder system, which lets sibling ScrollViews recognise
// simultaneously via simultaneousHandlers.
import { ScrollView } from 'react-native-gesture-handler';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 200 px
/** Null pad rows inserted before and after the values so the first/last
 *  value can be scrolled to the centre row. */
const _PAD_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2

// ─── Data types & static lists ────────────────────────────────────────────────

type PickerItem = { key: string; value: number | null };

/** Build a picker list with PAD_COUNT null sentinels at each end. */
function buildData(count: number, prefix: string): PickerItem[] {
  const pads = (id: number): PickerItem => ({
    key: `${prefix}p${id}`,
    value: null,
  });
  return [
    pads(0),
    pads(1),
    ...Array.from({ length: count }, (_, i) => ({
      key: `${prefix}${i}`,
      value: i,
    })),
    pads(2),
    pads(3),
  ];
}

const HOUR_DATA = buildData(24, 'h');
const MINUTE_DATA = buildData(60, 'm');

/**
 * Referentially-stable numeric value arrays.
 * Defined at module scope so their identity never changes between renders,
 * preventing the sync effect from re-firing on every parent render.
 */
const HOUR_VALUES: number[] = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_VALUES: number[] = Array.from({ length: 60 }, (_, i) => i);

// ─── Layout math ──────────────────────────────────────────────────────────────
//
// Data layout (HOUR example, PAD_COUNT=2):
//   index 0 → pad    (scroll offset  0)
//   index 1 → pad    (scroll offset 40)
//   index 2 → hr  0  (scroll offset 80)
//   index k → hr k-2 (scroll offset k*40)
//
// When scrollOffset = v * ITEM_HEIGHT:
//   • item at top of viewport = data[v]
//   • item at CENTRE (row 2 of 5) = data[v+2] = hour/minute v  ✓
//
// Therefore:
//   initialScrollY = v * ITEM_HEIGHT          → centres value v
//   Math.round(offset / ITEM_HEIGHT) = v      → reads value from offset

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TimeWheelPickerProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  /**
   * Called by the external "בחר" / confirm button in the wrapping screen.
   * Kept in the interface so all 4 callers remain unchanged.
   * No dialog is involved in this component, so onClose is never called
   * internally — it is wired by the parent to its own close logic.
   */
  onClose?: () => void;
}

// ─── Imperative handle ────────────────────────────────────────────────────────

/**
 * Exposed by each WheelColumn so the sibling wheel can stop its momentum the
 * instant the user touches the other wheel (iOS native gesture arbitration).
 */
interface WheelHandle {
  stopMomentum: () => void;
}

// ─── WheelColumn ──────────────────────────────────────────────────────────────

interface WheelColumnProps {
  data: PickerItem[];
  /** Referentially-stable array of valid numeric values (e.g. HOUR_VALUES). */
  values: number[];
  /** Maximum valid value (23 for hours, 59 for minutes). Used only for clamping in stopMomentum. */
  maxValue: number;
  value: number;
  onCommit: (v: number) => void;
  accessibilityLabel: string;
  /** Label used to distinguish hour vs minute columns (e.g. for debugging). */
  columnLabel: string;
  /**
   * Ref that this column will populate with its imperative handle so the
   * sibling can call stopMomentum().  Passed as a plain object ref instead
   * of forwardRef to comply with project conventions.
   */
  handleRef?: { current: WheelHandle | null };
  /**
   * Called when this wheel's drag begins so the sibling can release its
   * in-flight native momentum (iOS gesture arbitration fix).
   */
  onOtherWheelStop?: () => void;
  /**
   * Fix 2: ref that will be assigned to this column's internal ScrollView.
   * The parent creates it and passes it so it can also hand it to the sibling
   * column's simultaneousHandlers prop.
   * React 19: useRef<T>(null) returns RefObject<T | null>, so null is included.
   */
  scrollViewRef?: React.RefObject<RNScrollView | null>;
  /**
   * Fix 2: ref pointing to the sibling column's ScrollView, passed as
   * simultaneousHandlers so the gesture-handler layer allows both wheels to
   * recognise touch simultaneously.
   */
  otherWheelScrollRef?: React.RefObject<RNScrollView | null>;
}

function WheelColumnBase({
  data,
  values,
  maxValue,
  value,
  onCommit,
  accessibilityLabel,
  handleRef,
  onOtherWheelStop,
  scrollViewRef,
  otherWheelScrollRef,
}: WheelColumnProps): React.JSX.Element {
  // Fix 2: if the parent supplied a ref (for simultaneousHandlers wiring),
  // use it; otherwise fall back to a local ref.  Both are stable across renders.
  // React 19 types useRef<T>(null) as RefObject<T | null>.
  const localScrollRef = useRef<RNScrollView>(null);
  const scrollRef: React.RefObject<RNScrollView | null> =
    scrollViewRef ?? localScrollRef;

  // ── Settle-based offset tracking ─────────────────────────────────────────
  //
  // onScroll keeps currentOffsetRef up to date (throttled to 16ms).
  // When the user lifts without triggering momentum, a 120ms settle timer
  // fires commitNearestValue as a fallback — no scrollTo involved.
  const currentOffsetRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Loop-guard refs ───────────────────────────────────────────────────────
  //
  // lastCommittedRef   — deduplicates double-fire (onScrollEndDrag + onMomentumScrollEnd).
  // internalCommitRef  — lets the sync effect skip echoed-back parent updates (Loop A).
  // isUserScrollingRef — blocks sync-effect scrollTo while finger is down    (Loop A, Android).
  // isProgrammaticScrollRef — blocks onMomentumScrollEnd after our scrollTo  (Loop B).
  // didInitialSyncRef  — controls animated:false for first positioning.
  const lastCommittedRef = useRef<number | null>(null);
  const internalCommitRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const didInitialSyncRef = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // ── Shared commit function ────────────────────────────────────────────────
  //
  // Single path called by onScrollEndDrag settle-timer AND onMomentumScrollEnd.
  // lastCommittedRef equality check prevents double-commit if both fire.
  const commitNearestValue = useCallback(
    (offsetY: number) => {
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const nextValue = values[index];
      isUserScrollingRef.current = false;
      if (nextValue === undefined) return;
      if (lastCommittedRef.current === nextValue) return;
      lastCommittedRef.current = nextValue;
      internalCommitRef.current = nextValue;
      onCommit(nextValue);
    },
    [values, onCommit]
  );

  // ── Imperative handle ─────────────────────────────────────────────────────
  //
  // Populated so TimeWheelPicker can tell this wheel to stop when the user
  // begins a gesture on the OTHER wheel (iOS native responder fix).
  // Uses plain ref assignment rather than useImperativeHandle / forwardRef.
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      stopMomentum() {
        // Snap to the nearest item so the wheel isn't left at a mid-item offset.
        const snapped = Math.max(
          0,
          Math.min(
            maxValue * ITEM_HEIGHT,
            Math.round(currentOffsetRef.current / ITEM_HEIGHT) * ITEM_HEIGHT
          )
        );
        // Commit the stopped position before scrolling so the parent value
        // stays in sync even when this wheel is interrupted mid-gesture.
        commitNearestValue(snapped);
        // Mark programmatic so the resulting onMomentumScrollEnd (if any)
        // doesn't issue a duplicate commit.
        isProgrammaticScrollRef.current = true;
        scrollRef.current?.scrollTo({ y: snapped, animated: false });
        currentOffsetRef.current = snapped;
      },
    };
    return () => {
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef, commitNearestValue, maxValue, scrollRef]);

  // Ensure settle timer is cleared on unmount.
  useEffect(() => () => clearSettleTimer(), [clearSettleTimer]);

  // ── Sync when parent drives a new value (preset chip, edit-screen open) ──
  //
  // Guards:
  //   1. internalCommitRef  → skip the echo-back from our own commit  (Loop A)
  //   2. isUserScrollingRef → never fight an active gesture            (Loop A, Android)
  //   3. isProgrammaticScrollRef set before scrollTo                   (Loop B)
  useEffect(() => {
    if (!scrollRef.current) return;
    const index = values.indexOf(value);
    if (index < 0) return;

    // Parent is just echoing back what this wheel committed — skip.
    if (internalCommitRef.current === value) {
      internalCommitRef.current = null;
      return;
    }

    // Never interrupt an active user gesture.
    if (isUserScrollingRef.current) return;

    isProgrammaticScrollRef.current = true;
    lastCommittedRef.current = value;

    scrollRef.current.scrollTo({
      y: index * ITEM_HEIGHT,
      // First positioning is instant; all later external changes animate.
      animated: didInitialSyncRef.current,
    });

    didInitialSyncRef.current = true;
  }, [value, values, scrollRef]);

  // ── onLayout fallback for initial positioning ─────────────────────────────
  //
  // Safety net for rare cases where scrollRef.current is null when the sync
  // effect first runs (some Android versions attach the ref after effects).
  const handleLayout = useCallback(() => {
    if (didInitialSyncRef.current) return;
    if (!scrollRef.current) return;
    const index = values.indexOf(value);
    if (index < 0) return;
    scrollRef.current.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: false,
    });
    didInitialSyncRef.current = true;
  }, [value, values, scrollRef]);

  // ── onScroll — track real-time offset ────────────────────────────────────
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentOffsetRef.current = e.nativeEvent.contentOffset.y;
    },
    []
  );

  // ── onScrollBeginDrag ─────────────────────────────────────────────────────
  //
  // Stop the sibling wheel (iOS responder fix), clear any pending settle
  // timer, and mark that the user owns this gesture.
  const handleScrollBeginDrag = useCallback(() => {
    onOtherWheelStop?.();
    clearSettleTimer();
    isUserScrollingRef.current = true;
    isProgrammaticScrollRef.current = false;
  }, [onOtherWheelStop, clearSettleTimer]);

  // ── onMomentumScrollBegin ─────────────────────────────────────────────────
  //
  // If native momentum kicks in after drag-end, cancel the settle fallback
  // (onMomentumScrollEnd will commit instead).
  const handleMomentumScrollBegin = useCallback(() => {
    clearSettleTimer();
  }, [clearSettleTimer]);

  // ── onScrollEndDrag ───────────────────────────────────────────────────────
  //
  // NO scrollTo here — that was the root cause of the Android freeze.
  // On iOS, native snapToInterval handles alignment; on Android we removed
  // snapToInterval so a corrective snap is applied here for the no-momentum
  // (slow drag-lift) case.
  const handleScrollEndDrag = useCallback(() => {
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      const rawOffset = currentOffsetRef.current;
      // Fix 1 — Android settle-timer corrective snap (no-momentum case):
      // Without native snapToInterval the wheel may rest between items after a
      // very slow drag.  Issue one small corrective scrollTo to align exactly,
      // then commit the snapped value so the displayed digit matches the state.
      if (Platform.OS === 'android') {
        const index = Math.round(rawOffset / ITEM_HEIGHT);
        const snappedOffset = index * ITEM_HEIGHT;
        if (Math.abs(rawOffset - snappedOffset) > 0.5) {
          // animated:false → no secondary native momentum cycle on Android.
          // Reset the flag synchronously because a non-animated scrollTo does
          // not reliably fire onMomentumScrollEnd to clear it later.
          isProgrammaticScrollRef.current = true;
          scrollRef.current?.scrollTo({ y: snappedOffset, animated: false });
          isProgrammaticScrollRef.current = false;
        }
        commitNearestValue(snappedOffset);
      } else {
        commitNearestValue(rawOffset);
      }
    }, 120);
  }, [clearSettleTimer, commitNearestValue, scrollRef]);

  // ── onMomentumScrollEnd ───────────────────────────────────────────────────
  //
  // Primary commit path for normal flings.  Ignores momentum events triggered
  // by our own scrollTo calls (Loop B guard).
  //
  // Fix 1 — Android corrective snap:
  // decelerationRate="fast" without snapToInterval can stop a few px off the
  // target item after the native fling fully decelerates.  Detect this and
  // issue one final animated scrollTo to the exact snapped position, then
  // commit the corrected value so the displayed digit matches the visual.
  // This fires POST-momentum (fling has already settled), so it is safe and
  // does not fight an in-flight gesture.
  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearSettleTimer();
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }

      const offset = e.nativeEvent.contentOffset.y;

      if (Platform.OS === 'android') {
        const index = Math.round(offset / ITEM_HEIGHT);
        const snappedOffset = index * ITEM_HEIGHT;
        if (Math.abs(offset - snappedOffset) > 0.5) {
          // animated:false → no secondary native momentum cycle on Android.
          // Reset the flag synchronously; a non-animated scrollTo does not
          // reliably fire onMomentumScrollEnd to clear it later.
          isProgrammaticScrollRef.current = true;
          scrollRef.current?.scrollTo({ y: snappedOffset, animated: false });
          isProgrammaticScrollRef.current = false;
          commitNearestValue(snappedOffset);
          return;
        }
      }

      commitNearestValue(offset);
    },
    [clearSettleTimer, commitNearestValue, scrollRef]
  );

  return (
    // Fix 2: gesture-handler ScrollView + simultaneousHandlers lets the sibling
    // wheel start recognising immediately while this one is still in momentum,
    // bypassing RN's single-responder-at-a-time JS arbitration.
    <ScrollView
      ref={scrollRef as React.RefObject<RNScrollView>}
      simultaneousHandlers={otherWheelScrollRef}
      showsVerticalScrollIndicator={false}
      // Fix 1: iOS keeps native snap (works correctly).
      //        Android: remove snapToInterval — the corrective scrollTo in
      //        handleMomentumScrollEnd/handleScrollEndDrag handles alignment
      //        instead, avoiding the overshoot-then-bounce-back caused by the
      //        native fling fighting snapToInterval on Android.
      snapToInterval={Platform.OS === 'ios' ? ITEM_HEIGHT : undefined}
      snapToAlignment="center"
      decelerationRate={Platform.OS === 'ios' ? 0.997 : 'fast'}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onLayout={handleLayout}
      style={s.column}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: value.toString().padStart(2, '0') }}
    >
      {data.map((item) =>
        item.value !== null ? (
          <View key={item.key} style={s.item}>
            <Text
              style={[s.itemText, item.value === value && s.itemTextActive]}
            >
              {item.value.toString().padStart(2, '0')}
            </Text>
          </View>
        ) : (
          <View key={item.key} style={s.item} />
        )
      )}
    </ScrollView>
  );
}

const WheelColumn = React.memo(WheelColumnBase);

// ─── TimeWheelPicker ──────────────────────────────────────────────────────────

export function TimeWheelPicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: TimeWheelPickerProps): React.JSX.Element {
  // Imperative handles for cross-wheel momentum stopping (iOS Part 2 fix).
  const hourHandle = useRef<WheelHandle | null>(null);
  const minuteHandle = useRef<WheelHandle | null>(null);

  // Fix 2: parent-held ScrollView refs, cross-wired as simultaneousHandlers so
  // each wheel's gesture-handler layer knows about the sibling.
  // React 19: useRef<T>(null) returns RefObject<T | null>.
  const hourScrollRef = useRef<RNScrollView>(null);
  const minuteScrollRef = useRef<RNScrollView>(null);

  // Stable callbacks so React.memo on WheelColumn is not defeated.
  const stopHour = useCallback(() => hourHandle.current?.stopMomentum(), []);
  const stopMinute = useCallback(
    () => minuteHandle.current?.stopMomentum(),
    []
  );

  return (
    <View style={s.container}>
      {/* Selection highlight band — sits behind both columns */}
      <View style={s.indicator} pointerEvents="none" />

      <View style={s.columns}>
        <WheelColumn
          data={HOUR_DATA}
          values={HOUR_VALUES}
          maxValue={23}
          value={hour}
          onCommit={onHourChange}
          accessibilityLabel="שעות"
          columnLabel="hour"
          handleRef={hourHandle}
          onOtherWheelStop={stopMinute}
          scrollViewRef={hourScrollRef}
          otherWheelScrollRef={minuteScrollRef}
        />

        <View style={s.colon}>
          <Text style={s.colonText}>:</Text>
        </View>

        <WheelColumn
          data={MINUTE_DATA}
          values={MINUTE_VALUES}
          maxValue={59}
          value={minute}
          onCommit={onMinuteChange}
          accessibilityLabel="דקות"
          columnLabel="minute"
          handleRef={minuteHandle}
          onOtherWheelStop={stopHour}
          scrollViewRef={minuteScrollRef}
          otherWheelScrollRef={hourScrollRef}
        />
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
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    height: CONTAINER_HEIGHT,
  },
  // Explicit height is required. The parent uses alignItems:'center' (not
  // 'stretch'), so without a fixed height the ScrollView expands to its
  // full content height (28 × 40 = 1120 px for hours, 64 × 40 = 2560 px
  // for minutes) — all items fit, nothing to scroll. overflow:'hidden' on
  // the container clips the visuals but the scroll range stays at 0.
  column: { flex: 1, height: CONTAINER_HEIGHT },
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
  itemText: {
    fontSize: 22,
    color: '#9ca3af',
  },
  itemTextActive: {
    color: '#111517',
    fontWeight: '700',
  },
});
