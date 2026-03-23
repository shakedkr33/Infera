import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toNumericDate(ts: number): string {
  const d = new Date(ts);
  return `${fmt2(d.getDate())}.${fmt2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Round a Date up to the next full hour. e.g. 22:08 → 23:00 */
export function roundToNextHour(now: Date): Date {
  const d = new Date(now);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/** Apply a duration to a start date+time, handling cross-midnight. */
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
  startDate: number;
  startTime?: string;
  endDate: number;
  endTime?: string;
  isAllDay: boolean;
  onChange: (updates: {
    startDate?: number;
    startTime?: string;
    endDate?: number;
    endTime?: string;
    isAllDay?: boolean;
  }) => void;
}

// calendar icon → 'startDateGrid' / 'endDateGrid'  (display="inline")
// date chip     → 'startDate'   / 'endDate'         (display="spinner")
type OpenPicker =
  | 'startDate'
  | 'startDateGrid'
  | 'startTime'
  | 'endDate'
  | 'endDateGrid'
  | 'endTime'
  | null;

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

  // ── Validation ────────────────────────────────────────────────────────────
  const isInvalidRange: boolean = (() => {
    if (isAllDay || !startTime || !endTime) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMs = new Date(startDate).setHours(sh ?? 0, sm ?? 0, 0, 0);
    const endMs = new Date(endDate).setHours(eh ?? 0, em ?? 0, 0, 0);
    return startMs >= endMs;
  })();

  // ── Day chips ─────────────────────────────────────────────────────────────
  const DAY_CHIPS = [
    { label: 'מחרתיים', daysFromNow: 2 },
    { label: 'מחר', daysFromNow: 1 },
    { label: 'היום', daysFromNow: 0 },
  ] as const;

  const chipMidnight = (daysFromNow: number): number => {
    const base = new Date();
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + daysFromNow
    ).getTime();
  };

  const handleDayChip = (daysFromNow: number): void => {
    const dayMs = chipMidnight(daysFromNow);
    onChange({ startDate: dayMs, endDate: dayMs });
    closePicker();
  };

  // ── Picker handlers ───────────────────────────────────────────────────────
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

  // ── Shared "start date" row chips (reused in allDay and timed modes) ──────
  const StartDateChips = (
    <View style={s.chipsGroup}>
      {/* Calendar icon → inline grid */}
      <Pressable
        style={[s.calIconBtn, openPicker === 'startDateGrid' && s.chipActive]}
        onPress={() => togglePicker('startDateGrid')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="לוח שנה - תאריך התחלה"
      >
        <MaterialIcons name="calendar-today" size={14} color={PRIMARY} />
      </Pressable>

      {/* Date text chip → spinner wheel */}
      <Pressable
        style={[s.dateTextChip, openPicker === 'startDate' && s.dateChipOpen]}
        onPress={() => togglePicker('startDate')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`תאריך התחלה: ${toNumericDate(startDate)}`}
      >
        <Text style={s.dateChipText}>{toNumericDate(startDate)}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={s.card}>
      {/* ── "כל היום" toggle ─────────────────────────────────────────────────── */}
      <View style={s.toggleRow}>
        <Switch
          value={isAllDay}
          onValueChange={(v) => {
            closePicker();
            onChange({ isAllDay: v });
          }}
          trackColor={{ true: PRIMARY, false: '#d7e3ef' }}
          thumbColor="#fff"
          ios_backgroundColor="#d7e3ef"
          accessible={true}
          accessibilityLabel="כל היום"
          accessibilityRole="switch"
        />
        <Text style={s.toggleLabel}>כל היום</Text>
      </View>

      <View style={s.divider} />

      {/* ── All-day mode: show start date only ───────────────────────────────── */}
      {isAllDay ? (
        <View style={[s.dateRow, { marginBottom: 0 }]}>
          {StartDateChips}
          <Text style={s.rowLabel}>תאריך</Text>
        </View>
      ) : (
        <>
          {/* ── Timed mode: start row ── */}
          <View style={s.dateRow}>
            <View style={s.chipsGroup}>
              {/* Time chip — only visible in timed mode */}
              <Pressable
                style={[s.timeChip, openPicker === 'startTime' && s.chipActive]}
                onPress={() => togglePicker('startTime')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`שעת התחלה: ${startTime ?? 'לא נבחרה'}`}
              >
                <Text style={s.timeChipText}>{startTime ?? '--:--'}</Text>
              </Pressable>

              {/* Calendar icon → inline grid */}
              <Pressable
                style={[s.calIconBtn, openPicker === 'startDateGrid' && s.chipActive]}
                onPress={() => togglePicker('startDateGrid')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="לוח שנה - תאריך התחלה"
              >
                <MaterialIcons name="calendar-today" size={14} color={PRIMARY} />
              </Pressable>

              {/* Date text chip → spinner wheel */}
              <Pressable
                style={[s.dateTextChip, openPicker === 'startDate' && s.dateChipOpen]}
                onPress={() => togglePicker('startDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך התחלה: ${toNumericDate(startDate)}`}
              >
                <Text style={s.dateChipText}>{toNumericDate(startDate)}</Text>
              </Pressable>
            </View>
            <Text style={s.rowLabel}>התחלה</Text>
          </View>

          {/* ── Timed mode: end row ── */}
          <View style={[s.dateRow, { marginBottom: 0 }]}>
            <View style={s.chipsGroup}>
              <Pressable
                style={[
                  s.timeChip,
                  openPicker === 'endTime' && s.chipActive,
                  isInvalidRange && s.chipInvalid,
                ]}
                onPress={() => togglePicker('endTime')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`שעת סיום: ${endTime ?? 'לא נבחרה'}`}
              >
                <Text style={[s.timeChipText, isInvalidRange && s.chipTextInvalid]}>
                  {endTime ?? '--:--'}
                </Text>
              </Pressable>

              {/* Calendar icon → inline grid */}
              <Pressable
                style={[
                  s.calIconBtn,
                  openPicker === 'endDateGrid' && s.chipActive,
                  !isSameDay && s.calIconBtnNextDay,
                  isInvalidRange && s.chipInvalid,
                ]}
                onPress={() => togglePicker('endDateGrid')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="לוח שנה - תאריך סיום"
              >
                <MaterialIcons
                  name="calendar-today"
                  size={14}
                  color={isInvalidRange ? '#ef4444' : isSameDay ? PRIMARY : '#ea580c'}
                />
              </Pressable>

              <Pressable
                style={[
                  s.dateTextChip,
                  openPicker === 'endDate' && s.dateChipOpen,
                  !isSameDay && s.dateChipNextDay,
                  isInvalidRange && s.chipInvalid,
                ]}
                onPress={() => togglePicker('endDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך סיום: ${toNumericDate(endDate)}`}
              >
                <Text
                  style={[
                    s.dateChipText,
                    !isSameDay && s.dateChipTextNextDay,
                    isInvalidRange && s.chipTextInvalid,
                  ]}
                >
                  {toNumericDate(endDate)}
                </Text>
              </Pressable>
            </View>
            <Text style={s.rowLabel}>סיום</Text>
          </View>

          {isInvalidRange && (
            <Text style={s.invalidHint}>שעת הסיום חייבת להיות אחרי שעת ההתחלה</Text>
          )}

          {/* ── Day chips — hidden in allDay mode ── */}
          <View style={s.divider} />
          <View style={s.dayChipsRow}>
            {DAY_CHIPS.map((chip) => {
              const isActive = startDate === chipMidnight(chip.daysFromNow);
              return (
                <Pressable
                  key={chip.label}
                  style={[s.dayChip, isActive && s.dayChipActive]}
                  onPress={() => handleDayChip(chip.daysFromNow)}
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

      {/* ══════════════════════════════════════════════════════════════════════
          Pickers — rendered below the form rows, regardless of allDay state.
          All pickers use display="spinner". The inline grid was removed because
          display="inline" (UIDatePicker) mirrored numbers under scaleX(-1) RTL fix.
         ══════════════════════════════════════════════════════════════════════ */}

      {/* Spinner: start date */}
      {openPicker === 'startDate' && (
        <View style={s.spinnerWrapper}>
          <DateTimePicker
            value={new Date(startDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="he"
            themeVariant="light"
            // @ts-ignore — valid iOS prop
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleStartDateChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={s.pickerConfirmBtn} onPress={closePicker}
              accessible={true} accessibilityRole="button" accessibilityLabel="אישור">
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Inline grid: start date — no transform, iOS LTR layout accepted */}
      {openPicker === 'startDateGrid' && (
        <View style={s.gridWrapper}>
          <DateTimePicker
            value={new Date(startDate)}
            mode="date"
            display="inline"
            locale="he-IL"
            accentColor={PRIMARY}
            themeVariant="light"
            // @ts-ignore — valid iOS prop
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) {
                handleStartDateChange(selected);
                setTimeout(closePicker, 150);
              }
            }}
          />
        </View>
      )}

      {/* Spinner: start time — only meaningful in timed mode */}
      {openPicker === 'startTime' && !isAllDay && (
        <View style={s.spinnerWrapper}>
          <DateTimePicker
            value={timeStrToDate(startTime, startDate)}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="light"
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleStartTimeChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={s.pickerConfirmBtn} onPress={closePicker}
              accessible={true} accessibilityRole="button" accessibilityLabel="אישור">
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Spinner: end date — only in timed mode */}
      {openPicker === 'endDate' && !isAllDay && (
        <View style={s.spinnerWrapper}>
          <DateTimePicker
            value={new Date(endDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date(startDate)}
            locale="he"
            themeVariant="light"
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleEndDateChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={s.pickerConfirmBtn} onPress={closePicker}
              accessible={true} accessibilityRole="button" accessibilityLabel="אישור">
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Inline grid: end date — no transform, iOS LTR layout accepted */}
      {openPicker === 'endDateGrid' && !isAllDay && (
        <View style={s.gridWrapper}>
          <DateTimePicker
            value={new Date(endDate)}
            mode="date"
            display="inline"
            minimumDate={new Date(startDate)}
            locale="he-IL"
            accentColor={PRIMARY}
            themeVariant="light"
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) {
                handleEndDateChange(selected);
                setTimeout(closePicker, 150);
              }
            }}
          />
        </View>
      )}

      {/* Spinner: end time — only in timed mode */}
      {openPicker === 'endTime' && !isAllDay && (
        <View style={s.spinnerWrapper}>
          <DateTimePicker
            value={timeStrToDate(endTime, endDate)}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="light"
            // @ts-ignore
            textColor="#111827"
            onChange={(_, selected) => {
              if (selected) handleEndTimeChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={s.pickerConfirmBtn} onPress={closePicker}
              accessible={true} accessibilityRole="button" accessibilityLabel="אישור">
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
  chipInvalid: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  chipTextInvalid: {
    color: '#ef4444',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  calIconBtn: {
    backgroundColor: TINT,
    padding: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calIconBtnNextDay: {
    backgroundColor: '#fff7ed',
  },
  dateTextChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dateChipOpen: {
    borderColor: PRIMARY,
    backgroundColor: TINT,
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
  invalidHint: {
    fontSize: 11,
    color: '#ef4444',
    textAlign: 'right',
    marginTop: 4,
  },
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
  spinnerWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  gridWrapper: {
    backgroundColor: '#ffffff',
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
