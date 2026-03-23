import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { Reminder, ReminderPreset, ReminderUnit } from '@/lib/types/event';
import { makeReminder } from '@/lib/types/event';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

// ─── Preset definitions ───────────────────────────────────────────────────────

const PRESETS: { preset: ReminderPreset; label: string }[] = [
  { preset: 'at_event',    label: 'בעת האירוע' },
  { preset: 'hour_before', label: 'שעה לפני האירוע' },
  { preset: 'day_before',  label: '24 שעות לפני האירוע' },
  { preset: 'custom',      label: 'מותאם אישית' },
];

const UNIT_LABELS: Record<ReminderUnit, string> = {
  minutes: 'דקות',
  hours:   'שעות',
  days:    'ימים',
};

const UNITS: ReminderUnit[] = ['minutes', 'hours', 'days'];

function unitToMinutes(value: number, unit: ReminderUnit): number {
  if (unit === 'hours') return value * 60;
  if (unit === 'days') return value * 1440;
  return value;
}

function formatCustomSummary(r: Reminder): string {
  const v = r.customValue ?? 30;
  const u = UNIT_LABELS[r.customUnit ?? 'minutes'];
  return `תזכורת: ${v} ${u} לפני האירוע`;
}

// ─── Scroll picker for 1–100 ──────────────────────────────────────────────────

const NUMBERS = Array.from({ length: 100 }, (_, i) => i + 1);
const NUM_ITEM_H = 48;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RemindersCardProps {
  enabled: boolean;
  reminders: Reminder[];
  isAllDay: boolean;
  onChange: (enabled: boolean, reminders: Reminder[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RemindersCard({
  enabled,
  reminders,
  isAllDay,
  onChange,
}: RemindersCardProps): React.JSX.Element {
  // Custom-picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(30);
  const [draftUnit, setDraftUnit] = useState<ReminderUnit>('minutes');
  const numListRef = useRef<FlatList>(null);

  const hasPreset = (preset: ReminderPreset): boolean =>
    reminders.some((r) => r.preset === preset);

  const togglePreset = (preset: ReminderPreset): void => {
    const next = hasPreset(preset)
      ? reminders.filter((r) => r.preset !== preset)
      : [...reminders, makeReminder(preset)];
    onChange(enabled, next);
  };

  const customReminder = reminders.find((r) => r.preset === 'custom');

  // Open the picker modal pre-filled with current custom values
  const openPicker = (): void => {
    setDraftValue(customReminder?.customValue ?? 30);
    setDraftUnit(customReminder?.customUnit ?? 'minutes');
    setPickerOpen(true);
  };

  // Scroll number list to selected value when modal opens
  useEffect(() => {
    if (pickerOpen) {
      const idx = Math.max(0, draftValue - 1);
      setTimeout(() => {
        numListRef.current?.scrollToIndex({ index: idx, animated: false });
      }, 80);
    }
  }, [pickerOpen, draftValue]);

  const confirmPicker = (): void => {
    const offsetMinutes = unitToMinutes(draftValue, draftUnit);
    const next = reminders.map((r) =>
      r.preset === 'custom'
        ? { ...r, offsetMinutes, customValue: draftValue, customUnit: draftUnit }
        : r
    );
    onChange(enabled, next);
    setPickerOpen(false);
  };

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <Switch
          value={enabled}
          onValueChange={(v) => {
            if (isAllDay && v) {
              // BUG 4: all-day + reminders ON → auto-select day_before only
              onChange(true, [makeReminder('day_before')]);
            } else {
              onChange(v, reminders);
            }
          }}
          trackColor={{ true: PRIMARY, false: '#d7e3ef' }}
          thumbColor="#fff"
          ios_backgroundColor="#d7e3ef"
          accessible={true}
          accessibilityLabel="הפעל תזכורות"
        />
        <View style={s.headerContent}>
          <Text style={s.label}>תזכורות</Text>
          <Text style={s.statusText}>
            {enabled ? 'תזכורות מופעלות' : 'תזכורות כבויות'}
          </Text>
        </View>
        <View style={[s.iconCircle, { backgroundColor: TINT }]}>
          <MaterialIcons name="notifications-active" size={20} color={PRIMARY} />
        </View>
      </View>

      {/* ── Options ── */}
      {enabled && (
        <View style={s.optionsList}>
          {isAllDay && (
            <Text style={s.allDayNote}>
              לאירועי כל היום, התזכורת תישלח ב-09:00 של אותו יום
            </Text>
          )}

          {PRESETS.map((opt) => {
            const active = hasPreset(opt.preset);
            return (
              <View key={opt.preset}>
                <Pressable
                  style={s.optionRow}
                  onPress={() => {
                    togglePreset(opt.preset);
                    // If activating 'custom', open picker immediately
                    if (opt.preset === 'custom' && !active) {
                      setDraftValue(customReminder?.customValue ?? 30);
                      setDraftUnit(customReminder?.customUnit ?? 'minutes');
                      setPickerOpen(true);
                    }
                  }}
                  accessible={true}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt.label}
                >
                  <View style={[s.checkbox, active && s.checkboxActive]}>
                    {active && <MaterialIcons name="check" size={13} color="#fff" />}
                  </View>
                  <Text style={[s.optionText, active && s.optionTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>

                {/* When 'custom' is active: show summary + edit button */}
                {opt.preset === 'custom' && active && customReminder && (
                  <Pressable
                    style={s.customSummaryRow}
                    onPress={openPicker}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="ערוך תזכורת מותאמת"
                  >
                    <MaterialIcons name="edit" size={14} color={PRIMARY} />
                    <Text style={s.customSummaryText}>
                      {formatCustomSummary(customReminder)}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Custom reminder picker modal
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={s.pickerSheet} onPress={() => undefined}>
            <View style={s.handle} />

            {/* Title */}
            <Text style={s.pickerTitle}>תזכורת מותאמת</Text>

            {/* Row: number list + unit chips + "לפני" */}
            <View style={s.pickerRow}>
              {/* Fixed "לפני" suffix — bold, prominent */}
              <Text style={s.beforeLabel}>לפני</Text>

              {/* Unit chips */}
              <View style={s.unitChipsCol}>
                {UNITS.map((unit) => (
                  <Pressable
                    key={unit}
                    style={[s.unitChip, draftUnit === unit && s.unitChipActive]}
                    onPress={() => setDraftUnit(unit)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftUnit === unit }}
                    accessibilityLabel={UNIT_LABELS[unit]}
                  >
                    <Text style={[s.unitChipText, draftUnit === unit && s.unitChipTextActive]}>
                      {UNIT_LABELS[unit]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Number scroll list — tap or scroll to select */}
              <View style={s.numListContainer}>
                <FlatList
                  ref={numListRef}
                  data={NUMBERS}
                  keyExtractor={(n) => String(n)}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={NUM_ITEM_H}
                  decelerationRate="fast"
                  getItemLayout={(_, index) => ({
                    length: NUM_ITEM_H,
                    offset: NUM_ITEM_H * index,
                    index,
                  })}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.y / NUM_ITEM_H
                    );
                    setDraftValue(Math.max(1, Math.min(100, idx + 1)));
                  }}
                  contentContainerStyle={{
                    paddingTop: NUM_ITEM_H,
                    paddingBottom: NUM_ITEM_H,
                  }}
                  renderItem={({ item }) => {
                    const selected = draftValue === item;
                    return (
                      <Pressable
                        style={[s.numItem, selected && s.numItemSelected]}
                        onPress={() => {
                          setDraftValue(item);
                          numListRef.current?.scrollToIndex({
                            index: item - 1,
                            animated: true,
                          });
                        }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={String(item)}
                      >
                        <Text
                          style={[
                            s.numItemText,
                            selected && s.numItemTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>

            {/* Live preview */}
            <Text style={s.pickerPreview}>
              {`תזכורת: ${draftValue} ${UNIT_LABELS[draftUnit]} לפני האירוע`}
            </Text>

            {/* Confirm */}
            <Pressable
              style={s.pickerSaveBtn}
              onPress={confirmPicker}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="שמור תזכורת"
            >
              <Text style={s.pickerSaveBtnText}>שמור</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  statusText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
  },
  allDayNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  optionsList: {
    marginTop: 10,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  optionText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
    textAlign: 'right',
  },
  optionTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  // Custom summary row (tappable, shows after custom is selected)
  customSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    backgroundColor: TINT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 4,
  },
  customSummaryText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
  },
  // ── Picker modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    height: NUM_ITEM_H * 3, // show 3 rows at once
  },
  // "לפני" fixed label
  beforeLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  // Unit chips column
  unitChipsCol: {
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: TINT,
    borderColor: PRIMARY,
  },
  unitChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  unitChipTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  // Number scroll list
  numListContainer: {
    width: 80,
    height: NUM_ITEM_H * 3,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  numItem: {
    height: NUM_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  numItemSelected: {
    backgroundColor: TINT,
  },
  numItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
  },
  numItemTextSelected: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  pickerPreview: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  pickerSaveBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickerSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
