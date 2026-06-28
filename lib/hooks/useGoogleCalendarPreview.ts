/**
 * useGoogleCalendarPreview — orchestrates the Google Calendar event preview.
 *
 * Wraps fetchCalendarPreview in React state management. Surfaces a simple
 * status machine and result to the screen component.
 *
 * Security contract (extends googleCalendarEvents.ts):
 * - accessToken is never stored in the hook; it is passed through on demand.
 * - Result contains count, up to three preview titles, and the full normalized
 *   event list for the active flow only. No raw event data is retained.
 * - No Convex writes. No persistence. No polling or background refresh.
 * - AbortController cancels any in-flight fetch on unmount, clear, or retry.
 *
 * Forward range: always one calendar year (12 months) ahead. The UI offers
 * only a back-range chip (today / 1 month / 2 months); the forward end is
 * fixed and not user-configurable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildDateRange,
  type CalendarTarget,
  type EventPreviewResult,
  fetchCalendarPreview,
  type PastRange,
} from '../services/googleCalendarEvents';

// ── Public types ──────────────────────────────────────────────────────────────

export type PreviewStatus = 'idle' | 'loading' | 'done';

export type UseGoogleCalendarPreviewResult = {
  status: PreviewStatus;
  /**
   * The EventPreviewResult when status is 'done', null otherwise.
   * On success, includes the full normalized event list for the active flow.
   */
  result: EventPreviewResult | null;
  /**
   * Begin a preview fetch for the given calendars and date range.
   * Ignored while already loading; aborts any prior in-flight fetch.
   *
   * Forward range is always one full calendar year ahead.
   */
  startPreview: (
    calendars: readonly CalendarTarget[],
    pastRange: PastRange,
    accessToken: string
  ) => void;
  /**
   * Retry with the most recent startPreview arguments.
   * No-op if no previous call was made.
   */
  retry: () => void;
  /** Abort any in-flight request and reset to idle. */
  clear: () => void;
};

// ── Internal constant ────────────────────────────────────────────────────────

/** Forward window is always exactly one calendar year. */
const FORWARD_MONTHS = 12;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGoogleCalendarPreview(): UseGoogleCalendarPreviewResult {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [result, setResult] = useState<EventPreviewResult | null>(null);

  const isMounted = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  // Stores the last call's args so retry() can replay them.
  const lastArgsRef = useRef<{
    calendars: readonly CalendarTarget[];
    pastRange: PastRange;
    accessToken: string;
  } | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const clear = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (isMounted.current) {
      setStatus('idle');
      setResult(null);
    }
  }, []);

  const runFetch = useCallback(
    async (
      calendars: readonly CalendarTarget[],
      pastRange: PastRange,
      accessToken: string
    ): Promise<void> => {
      // Cancel any prior in-flight request.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (isMounted.current) {
        setStatus('loading');
        setResult(null);
      }

      const { timeMin, timeMax } = buildDateRange(pastRange, new Date(), FORWARD_MONTHS);

      const fetchResult = await fetchCalendarPreview(
        accessToken,
        calendars,
        timeMin,
        timeMax,
        controller.signal
      );

      // Discard result if the component unmounted or this fetch was superseded.
      if (!isMounted.current || controller.signal.aborted) return;

      setResult(fetchResult);
      setStatus('done');
    },
    []
  );

  const startPreview = useCallback(
    (
      calendars: readonly CalendarTarget[],
      pastRange: PastRange,
      accessToken: string
    ): void => {
      if (status === 'loading') return;
      lastArgsRef.current = { calendars, pastRange, accessToken };
      void runFetch(calendars, pastRange, accessToken);
    },
    [status, runFetch]
  );

  const retry = useCallback((): void => {
    if (lastArgsRef.current === null) return;
    const { calendars, pastRange, accessToken } = lastArgsRef.current;
    void runFetch(calendars, pastRange, accessToken);
  }, [runFetch]);

  return { status, result, startPreview, retry, clear };
}
