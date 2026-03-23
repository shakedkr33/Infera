import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

// ─── Exported helpers (used by EventScreen for smart defaults) ────────────────

export function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toNumericDate(ts: number): string {
  const d = new Date(ts);
  return `${fmt2(d.getDate())}.${fmt2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Round a Date up to the next full hour. e.g. 22:08 → 23:00, 22:00 → 23:00 */
export function roundToNextHour(now: Date): Date {
  const d = new Date(now);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/**
 * Apply a duration (minutes) to a startDate + startTime.
 * Handles cross-midnight: returns a potentially different endDate.
 */
export function applyDuration(
  startDate: number,
  startTime: string,
  durationMinutes: number
): { endDate: number; endTime: string } {
  const [h, m] = startTime.split(':').map(Number);
  const start = new Date(startDate);
  start.setHours(h ?? 0, m ?? 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    endDate: new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime(),
    endTime: `${fmt2(end.getHours())}:${fmt2(end.getMinutes())}`,
  };
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function timeStrToDate(timeStr: string | undefined, baseDateMs: number): Date {
  const d = new Date(baseDateMs);
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function dateToTimeStr(d: Date): string {
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

function midnightOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DateTimeCardProps {
  startDate: number;   // midnight Unix ms for start date
  startTime?: string;  // "HH:MM"
  endDate: number;     // midnight Unix ms for end date (may differ for cross-midnight)
  endTime?: string;    // "HH:MM"
  isAllDay: boolean;
  onChange: (updates: {
    startDate?: number;
    startTime?: string;
    endDate?: number;
    endTime?: string;
    isAllDay?: boolean;
  }) => void;
}

type OpenPicker = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function DateTimeCard({
  startDate,
  startTime,
  endDate,
  endTime,
  isAllDay,
  onChange,
}: DateTimeCardProps): React.JSX.Element {
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

  const closePicker = (): void => setOpenPicker(null);
  const togglePicker = (picker: OpenPicker): void =>
    setOpenPicker((prev) => (prev === picker ? null : picker));

  // ── Quick day chips ────────────────────────────────────────────────────────
  const todayMidnight = midnightOf(new Date());
  const tomorrowMidnight = todayMidnight + 86400000;
  const dayAfterMidnight = todayMidnight + 2 * 86400000;

  const DAY_CHIPS = [
    { label: 'מחרתיים', date: dayAfterMidnight },
    { label: 'מחר', date: tomorrowMidnight },
    { label: 'היום', date: todayMidnight },
  ] as const;

  const handleDayChip = (dayMs: number): void => {
    // Update both dates; preserve existing start/end times
    onChange({ startDate: dayMs, endDate: dayMs });
    closePicker();
  };

  // ── Picker change handlers ────────────────────────────────────────────────
  const handleStartDateChange = (selected: Date): void => {
    if (Platform.OS === 'android') closePicker();
    onChange({ startDate: midnightOf(selected) });
  };

  const handleStartTimeChange = (selected: Date): void => {
    if (Platform.OS === 'android') closePicker();
    onChange({ startTime: dateToTimeStr(selected) });
  };

  const handleEndDateChange = (selected: Date): void => {
    if (Platform.OS === 'android') closePicker();
    onChange({ endDate: midnightOf(selected) });
  };

  const handleEndTimeChange = (selected: Date): void => {
    if (Platform.OS === 'android') closePicker();
    onChange({ endTime: dateToTimeStr(selected) });
  };

  const isSameDay = startDate === endDate;

  return (
    <View style={s.card}>
      {/* ── כל היום toggle — with background for visibility ── */}
      <View style={s.toggleRow}>
        <Switch
          value={isAllDay}
          onValueChange={(v) => {
            closePicker();
            onChange({ isAllDay: v });
          }}
          trackColor={{ true: PRIMARY, false: '#e2e8f0' }}
          thumbColor="#fff"
          accessible={true}
          accessibilityLabel="כל היום"
          accessibilityRole="switch"
        />
        <Text style={s.toggleLabel}>כל היום</Text>
      </View>

      {!isAllDay && (
        <>
          <View style={s.divider} />

          {/* ── Start row ── */}
          <View style={s.dateRow}>
            <View style={s.chipsGroup}>
              <Pressable
                style={[s.timeChip, openPicker === 'startTime' && s.chipActive]}
                onPress={() => togglePicker('startTime')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`שעת התחלה: ${startTime ?? 'לא נבחרה'}`}
              >
                <Text style={s.timeChipText}>{startTime ?? '--:--'}</Text>
              </Pressable>
              <Pressable
                style={[s.dateChip, openPicker === 'startDate' && s.dateChipOpen]}
                onPress={() => togglePicker('startDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך התחלה: ${toNumericDate(startDate)}`}
              >
                <MaterialIcons name="calendar-today" size={12} color={PRIMARY} />
                <Text style={s.dateChipText}>{toNumericDate(startDate)}</Text>
              </Pressable>
            </View>
            <Text style={s.rowLabel}>התחלה</Text>
          </View>

          {/* ── End row ── */}
          <View style={[s.dateRow, { marginBottom: 0 }]}>
            <View style={s.chipsGroup}>
              <Pressable
                style={[s.timeChip, openPicker === 'endTime' && s.chipActive]}
                onPress={() => togglePicker('endTime')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`שעת סיום: ${endTime ?? 'לא נבחרה'}`}
              >
                <Text style={s.timeChipText}>{endTime ?? '--:--'}</Text>
              </Pressable>
              <Pressable
                style={[
                  s.dateChip,
                  openPicker === 'endDate' && s.dateChipOpen,
                  !isSameDay && s.dateChipNextDay,
                ]}
                onPress={() => togglePicker('endDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך סיום: ${toNumericDate(endDate)}`}
              >
                <MaterialIcons
                  name="calendar-today"
                  size={12}
                  color={isSameDay ? PRIMARY : '#ea580c'}
                />
                <Text style={[s.dateChipText, !isSameDay && s.dateChipTextNextDay]}>
                  {toNumericDate(endDate)}
                </Text>
              </Pressable>
            </View>
            <Text style={s.rowLabel}>סיום</Text>
          </View>

          {/* ── Quick day chips ── */}
          <View style={s.divider} />
          <View style={s.dayChipsRow}>
            {DAY_CHIPS.map((chip) => {
              const isActive = startDate === chip.date;
              return (
                <Pressable
                  key={chip.label}
                  style={[s.dayChip, isActive && s.dayChipActive]}
                  onPress={() => handleDayChip(chip.date)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={chip.label}
                >
                  <Text style={[s.dayChipText, isActive && s.dayChipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* ── Pickers ── */}
      {openPicker === 'startDate' && (
        <View style={s.pickerWrapper}>
          <DateTimePicker
            value={new Date(startDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="he"
            // @ts-ignore — textColor is a valid iOS prop
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleStartDateChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              style={s.pickerConfirmBtn}
              onPress={closePicker}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="אישור תאריך התחלה"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {openPicker === 'startTime' && (
        <View style={s.pickerWrapper}>
          <DateTimePicker
            value={timeStrToDate(startTime, startDate)}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleStartTimeChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              style={s.pickerConfirmBtn}
              onPress={closePicker}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="אישור שעת התחלה"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {openPicker === 'endDate' && (
        <View style={s.pickerWrapper}>
          <DateTimePicker
            value={new Date(endDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date(startDate)}
            locale="he"
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleEndDateChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              style={s.pickerConfirmBtn}
              onPress={closePicker}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="אישור תאריך סיום"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {openPicker === 'endTime' && (
        <View style={s.pickerWrapper}>
          <DateTimePicker
            value={timeStrToDate(endTime, endDate)}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleEndTimeChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              style={s.pickerConfirmBtn}
              onPress={closePicker}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="אישור שעת סיום"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}
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
  // ── All-day toggle ──
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  // ── Date/time rows ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'right',
    minWidth: 48,
  },
  chipsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: PRIMARY,
    backgroundColor: TINT,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TINT,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dateChipOpen: {
    borderColor: PRIMARY,
  },
  dateChipNextDay: {
    backgroundColor: '#fff7ed',
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  dateChipTextNextDay: {
    color: '#ea580c',
  },
  // ── Day chips ──
  dayChipsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayChipActive: {
    backgroundColor: TINT,
    borderColor: PRIMARY,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  dayChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  // ── Pickers ──
  pickerWrapper: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerConfirmBtn: {
    backgroundColor: PRIMARY,
    margin: 12,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
