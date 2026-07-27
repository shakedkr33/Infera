import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { rtl } from '@/lib/rtl';
import { buildGeoUri } from '@/lib/utils/geoUri';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';
const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const PLACES_AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACES_DETAILS_URL =
  'https://maps.googleapis.com/maps/api/place/details/json';
const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type LocMode = 'address' | 'link';

export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

/** Values emitted on every change. Callers spread these into event state. */
export interface LocationUpdate {
  location: string; // physical address → EventData.location
  onlineUrl: string; // meeting URL     → EventData.onlineUrl
  /**
   * geo:lat,lng URI — populated when user picks from autocomplete.
   * Empty string (`''`) means the geo URI was explicitly cleared (user manually typed).
   * Undefined means the field was not touched in this update.
   */
  locationUrl?: string;
}

/**
 * Anchor data emitted to the parent so it can render the suggestion list
 * as a screen-level overlay (not clipped by the editor ScrollView).
 */
export interface LocationOverlayAnchor {
  /** Absolute screen x of the input */
  inputX: number;
  /** Absolute screen y of the TOP edge of the input */
  inputY: number;
  /** Input height in screen pixels */
  inputHeight: number;
  /** Input width in screen pixels */
  inputWidth: number;
  suggestions: PlaceSuggestion[];
  /** Cancel blur timer so suggestion presses aren't swallowed */
  onPressIn: () => void;
  onSelect: (s: PlaceSuggestion) => void;
  onDismiss: () => void;
}

interface LocationCardProps {
  /** Current physical address (EventData.location) */
  location?: string;
  /** Current meeting URL (EventData.onlineUrl) */
  onlineUrl?: string;
  onChange: (update: LocationUpdate) => void;
  /**
   * When provided, suggestion list is NOT rendered inline.
   * Instead this callback is invoked with anchor data so the parent can
   * render the list in a screen-level overlay that isn't clipped.
   * Pass null to dismiss the overlay.
   */
  onOverlayUpdate?: (anchor: LocationOverlayAnchor | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSuggestions(payload: unknown): PlaceSuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.predictions)) return [];

  const suggestions: PlaceSuggestion[] = [];
  for (const prediction of payload.predictions) {
    if (!isRecord(prediction)) continue;
    const description = prediction.description;
    const placeId = prediction.place_id;
    if (typeof description !== 'string' || typeof placeId !== 'string') {
      continue;
    }
    suggestions.push({ description, placeId });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

function parseCoordinates(
  payload: unknown
): { lat: number; lng: number } | null {
  if (!isRecord(payload) || !isRecord(payload.result)) return null;
  const { geometry } = payload.result;
  if (!isRecord(geometry) || !isRecord(geometry.location)) return null;
  const { lat, lng } = geometry.location;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationCard({
  location,
  onlineUrl,
  onChange,
  onOverlayUpdate,
}: LocationCardProps): React.JSX.Element {
  const hasAddress = !!location?.trim();
  const hasLink = !!onlineUrl?.trim();

  // Derive initial open/mode from saved values
  const [cardOpen, setCardOpen] = useState(hasAddress || hasLink);
  const [locMode, setLocMode] = useState<LocMode>(hasLink ? 'link' : 'address');
  const [addressFocused, setAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const addressInputRef = useRef<TextInput>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsRequestRef = useRef<AbortController | null>(null);
  const latestLocationRef = useRef(location ?? '');
  latestLocationRef.current = location ?? '';

  useEffect(() => {
    const input = location?.trim() ?? '';
    if (!addressFocused || input.length < 2 || !PLACES_KEY) {
      setSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const loadSuggestions = async (): Promise<void> => {
        try {
          const url =
            `${PLACES_AUTOCOMPLETE_URL}?input=${encodeURIComponent(input)}` +
            `&key=${encodeURIComponent(PLACES_KEY)}&language=he`;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            setSuggestions([]);
            return;
          }
          const payload: unknown = await response.json();
          if (!controller.signal.aborted) {
            setSuggestions(parseSuggestions(payload));
          }
        } catch {
          if (!controller.signal.aborted) setSuggestions([]);
        }
      };
      void loadSuggestions();
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [addressFocused, location]);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      detailsRequestRef.current?.abort();
    },
    []
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const closeSuggestions = useCallback((): void => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setAddressFocused(false);
    setSuggestions([]);
    onOverlayUpdate?.(null);
  }, [onOverlayUpdate]);

  const handleOpen = (): void => {
    setLocMode('address');
    setCardOpen(true);
  };

  const handleClose = (): void => {
    closeSuggestions();
    detailsRequestRef.current?.abort();
    setCardOpen(false);
    setLocMode('address');
    onChange({ location: '', onlineUrl: '' });
  };

  const switchMode = (mode: LocMode): void => {
    if (mode === locMode) return;
    closeSuggestions();
    detailsRequestRef.current?.abort();
    setLocMode(mode);
    onChange({ location: '', onlineUrl: '' });
  };

  const handleAddressChange = (text: string): void => {
    latestLocationRef.current = text;
    detailsRequestRef.current?.abort();
    onChange({
      location: text,
      onlineUrl: '',
      locationUrl: '', // empty string = geo URI explicitly cleared by manual typing
    });
  };

  const handleAddressFocus = (): void => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setAddressFocused(true);
  };

  const handleAddressBlur = (): void => {
    blurTimerRef.current = setTimeout(closeSuggestions, 150);
  };

  const handleSuggestionPress = useCallback(
    async (suggestion: PlaceSuggestion): Promise<void> => {
      closeSuggestions();
      addressInputRef.current?.blur();
      Keyboard.dismiss();

      latestLocationRef.current = suggestion.description;
      onChange({
        location: suggestion.description,
        onlineUrl: '',
        // locationUrl intentionally omitted — do not clear it here.
        // It is set below once coordinates arrive, or left as-is if the
        // Place Details fetch fails. Manual text edits elsewhere in this
        // file are still responsible for explicitly clearing locationUrl
        // when the user types a new address by hand — verify that clearing
        // logic still exists and still works after this change.
      });

      detailsRequestRef.current?.abort();
      if (!PLACES_KEY) return;

      const controller = new AbortController();
      detailsRequestRef.current = controller;
      try {
        const url =
          `${PLACES_DETAILS_URL}?placeid=${encodeURIComponent(suggestion.placeId)}` +
          `&key=${encodeURIComponent(PLACES_KEY)}&language=he`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const coordinates = parseCoordinates(payload);
        if (
          coordinates &&
          !controller.signal.aborted &&
          latestLocationRef.current === suggestion.description
        ) {
          onChange({
            location: suggestion.description,
            onlineUrl: '',
            locationUrl: buildGeoUri(coordinates.lat, coordinates.lng),
          });
        }
      } catch {
        // Keep the selected description as a plain address if details fail.
      } finally {
        if (detailsRequestRef.current === controller) {
          detailsRequestRef.current = null;
        }
      }
    },
    [closeSuggestions, onChange]
  );

  // ── Overlay: notify parent when anchor position / suggestions change ────────
  //
  // Live refs for callbacks that would otherwise appear in the effect deps and
  // create an infinite loop:
  //   onChange (EventScreen prop) is an inline arrow → new reference every render
  //   → handleSuggestionPress (depends on onChange) gets a new identity
  //   → overlay effect re-runs → measureInWindow → setLocationOverlay (EventScreen)
  //   → EventScreen re-renders → new onChange → loop
  //
  // By reading callbacks through stable refs the effect only runs when the truly
  // meaningful inputs change: focus state, suggestion content, or the parent callback.
  const latestHandleSuggestionPress = useRef(handleSuggestionPress);
  latestHandleSuggestionPress.current = handleSuggestionPress;
  const latestCloseSuggestions = useRef(closeSuggestions);
  latestCloseSuggestions.current = closeSuggestions;

  useEffect(() => {
    if (!onOverlayUpdate) return;
    if (!addressFocused || suggestions.length === 0) {
      onOverlayUpdate(null);
      return;
    }
    // measureInWindow gives absolute screen coordinates (accounts for scroll/layout)
    addressInputRef.current?.measureInWindow((x, y, w, h) => {
      onOverlayUpdate({
        inputX: x,
        inputY: y,
        inputHeight: h,
        inputWidth: w,
        suggestions,
        onPressIn: () => {
          if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
          }
        },
        onSelect: (s) => {
          void latestHandleSuggestionPress.current(s);
        },
        onDismiss: () => latestCloseSuggestions.current(),
      });
    });
  }, [
    addressFocused,
    suggestions,
    onOverlayUpdate,
    // closeSuggestions and handleSuggestionPress are accessed via live refs above
    // so their identity changes do not re-trigger the measurement effect.
  ]);

  // ── Collapsed ─────────────────────────────────────────────────────────────

  if (!cardOpen) {
    return (
      <Pressable
        style={s.emptyRow}
        onPress={handleOpen}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="הוסף מיקום"
      >
        <View style={s.emptyIconCircle}>
          <Ionicons name="location-outline" size={18} color="#36a9e2" />
        </View>
        <Text style={s.emptyText}>הוסף מיקום</Text>
      </Pressable>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────

  return (
    <View style={s.card}>
      {/* Header: label first (physical RIGHT in RTL), X button last (physical LEFT) */}
      <View style={s.headerRow}>
        <Text style={s.headerLabel}>מיקום</Text>
        <Pressable
          onPress={handleClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הסר מיקום"
          style={s.closeBtn}
        >
          <MaterialIcons name="close" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      {/* Mode chips — כתובת first (physical RIGHT in RTL), קישור second */}
      <View style={s.typeRow}>
        <TypeChip
          label="כתובת"
          active={locMode === 'address'}
          onPress={() => switchMode('address')}
        />
        <TypeChip
          label="קישור"
          active={locMode === 'link'}
          onPress={() => switchMode('link')}
        />
      </View>

      {/* ── Address mode: Google Places Autocomplete ── */}
      {locMode === 'address' && (
        <View style={s.inputWrapper}>
          <TextInput
            ref={addressInputRef}
            style={s.placesTextInput}
            value={location ?? ''}
            onChangeText={handleAddressChange}
            onFocus={handleAddressFocus}
            onBlur={handleAddressBlur}
            placeholder="חפשי כתובת..."
            placeholderTextColor="#94a3b8"
            textAlign={rtl.inputTextAlign}
            clearButtonMode="while-editing"
            accessible={true}
            accessibilityLabel="חיפוש כתובת"
          />

          {addressFocused && suggestions.length > 0 && !onOverlayUpdate ? (
            <InlineSuggestionList
              suggestions={suggestions}
              onPressIn={() => {
                if (blurTimerRef.current) {
                  clearTimeout(blurTimerRef.current);
                  blurTimerRef.current = null;
                }
              }}
              onSelect={(s) => void handleSuggestionPress(s)}
            />
          ) : null}
        </View>
      )}

      {/* ── Link mode: plain URL TextInput ── */}
      {locMode === 'link' && (
        <View style={s.inputWrapper}>
          <TextInput
            style={s.linkInput}
            value={onlineUrl ?? ''}
            onChangeText={(text) => onChange({ location: '', onlineUrl: text })}
            placeholder="https://..."
            placeholderTextColor="#94a3b8"
            textAlign="right"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessible={true}
            accessibilityLabel="קישור לפגישה"
          />
        </View>
      )}
    </View>
  );
}

// ─── InlineSuggestionList (fallback when no overlay callback) ─────────────────

function InlineSuggestionList({
  suggestions,
  onPressIn,
  onSelect,
}: {
  suggestions: PlaceSuggestion[];
  onPressIn: () => void;
  onSelect: (s: PlaceSuggestion) => void;
}): React.JSX.Element {
  return (
    <ScrollView
      style={s.placesList}
      keyboardShouldPersistTaps="always"
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
    >
      {suggestions.map((suggestion, index) => (
        <Pressable
          key={suggestion.placeId}
          style={[
            s.placesRow,
            index < suggestions.length - 1 && s.placesRowWithSeparator,
          ]}
          onPressIn={onPressIn}
          onPress={() => onSelect(suggestion)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`בחרי כתובת: ${suggestion.description}`}
        >
          <Text style={s.placesDescription}>{suggestion.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── TypeChip ─────────────────────────────────────────────────────────────────

function TypeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={[s.typeChip, active && s.typeChipActive]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  emptyRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: rtl.textAlign,
  },
  emptyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingTop: 14,
    paddingHorizontal: 14,
    // No paddingBottom — inputWrapper provides the section's bottom spacing
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    zIndex: 10,
    gap: 10,
  },
  headerRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: rtl.textAlign,
  },
  closeBtn: {
    padding: 4,
  },
  typeRow: {
    flexDirection: rtl.flexDirection,
    gap: 8,
    justifyContent: 'flex-start',
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeChipActive: {
    backgroundColor: TINT,
    borderColor: PRIMARY,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  typeChipTextActive: {
    color: PRIMARY,
  },
  inputWrapper: {
    position: 'relative',
    zIndex: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    paddingBottom: 14,
  },

  // ── Inline Google Places autocomplete ─────────────────────────────────────
  placesTextInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
    textAlign: rtl.inputTextAlign,
    marginBottom: 0,
  },
  placesList: {
    position: 'absolute',
    top: 62,
    right: 0,
    left: 0,
    zIndex: 30,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  placesRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  placesRowWithSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  placesDescription: {
    fontSize: 14,
    color: '#111827',
    textAlign: rtl.textAlign,
  },
  // ── Link (URL) input ──────────────────────────────────────────────────────
  linkInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
    textAlign: rtl.inputTextAlign,
  },
});
