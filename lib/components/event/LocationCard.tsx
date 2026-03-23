import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';
const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

type LocMode = 'address' | 'link';

/** Values emitted on every change. Callers spread these into event state. */
export interface LocationUpdate {
  location: string;   // physical address → EventData.location
  onlineUrl: string;  // meeting URL     → EventData.onlineUrl
}

interface LocationCardProps {
  /** Current physical address (EventData.location) */
  location?: string;
  /** Current meeting URL (EventData.onlineUrl) */
  onlineUrl?: string;
  onChange: (update: LocationUpdate) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationCard({
  location,
  onlineUrl,
  onChange,
}: LocationCardProps): React.JSX.Element {
  const hasAddress = !!location?.trim();
  const hasLink = !!onlineUrl?.trim();

  // Derive initial open/mode from saved values
  const [cardOpen, setCardOpen] = useState(hasAddress || hasLink);
  const [locMode, setLocMode] = useState<LocMode>(hasLink ? 'link' : 'address');

  // Ref to imperatively clear the Google Places input text
  const placesRef = useRef<React.ElementRef<typeof GooglePlacesAutocomplete>>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpen = (): void => {
    setLocMode('address');
    setCardOpen(true);
  };

  const handleClose = (): void => {
    placesRef.current?.clear();
    setCardOpen(false);
    setLocMode('address');
    onChange({ location: '', onlineUrl: '' });
  };

  const switchMode = (mode: LocMode): void => {
    if (mode === locMode) return;
    placesRef.current?.clear();
    setLocMode(mode);
    onChange({ location: '', onlineUrl: '' });
  };

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
      {/* Header: label (right) + X button (left) */}
      <View style={s.headerRow}>
        <Pressable
          onPress={handleClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הסר מיקום"
          style={s.closeBtn}
        >
          <MaterialIcons name="close" size={16} color="#94a3b8" />
        </Pressable>
        <Text style={s.headerLabel}>מיקום</Text>
      </View>

      {/* Mode chips — right-aligned for RTL */}
      <View style={s.typeRow}>
        <TypeChip
          label="קישור"
          active={locMode === 'link'}
          onPress={() => switchMode('link')}
        />
        <TypeChip
          label="כתובת"
          active={locMode === 'address'}
          onPress={() => switchMode('address')}
        />
      </View>

      {/* ── Address mode: Google Places Autocomplete ── */}
      {locMode === 'address' && (
        <View style={s.inputWrapper}>
          <GooglePlacesAutocomplete
            ref={placesRef}
            placeholder="חפשי כתובת..."
            query={{ key: PLACES_KEY, language: 'he' }}
            onPress={(data) => {
              // MVP: store only the human-readable address string
              onChange({ location: data.description, onlineUrl: '' });
            }}
            onFail={() => {
              // Graceful degradation: user keeps whatever they typed
            }}
            textInputProps={{
              value: location ?? '',
              onChangeText: (text: string) =>
                onChange({ location: text, onlineUrl: '' }),
              textAlign: 'right' as const,
              placeholderTextColor: '#94a3b8',
              accessibilityLabel: 'חיפוש כתובת',
            }}
            fetchDetails={false}
            enablePoweredByContainer={false}
            keepResultsAfterBlur={false}
            listViewDisplayed="auto"
            keyboardShouldPersistTaps="handled"
            isRowScrollable={false}
            styles={{
              container: s.placesContainer,
              textInputContainer: s.placesTextInputContainer,
              textInput: s.placesTextInput,
              listView: s.placesList,
              row: s.placesRow,
              description: s.placesDescription,
              separator: s.placesSeparator,
              poweredContainer: { display: 'none' },
            }}
          />
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
    flexDirection: 'row-reverse',
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
    textAlign: 'right',
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
    // No paddingBottom — inputWrapper provides it so the dropdown isn't clipped
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  closeBtn: {
    padding: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
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
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    paddingBottom: 14,
  },

  // ── GooglePlacesAutocomplete style overrides ──────────────────────────────
  placesContainer: {
    flex: 0,
  },
  placesTextInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  placesTextInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
    textAlign: 'right',
    marginBottom: 0,
  },
  placesList: {
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  placesDescription: {
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  placesSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f1f5f9',
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
    textAlign: 'right',
  },
});
