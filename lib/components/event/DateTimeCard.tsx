import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { rtl } from '@/lib/rtl';
import {
  getHebrewDateInfo,
  getHebrewMonthRangeForGregorianMonth,
} from '@/lib/utils/hebrewDate';

// ─── Custom RTL Calendar Grid ─────────────────────────────────────────────────

const MONTH_NAMES_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];
// Index 0 = Sunday → rightmost column in RTL
const DAY_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'ש'];

interface CalendarGridProps {
  value: Date;
  minimumDate?: Date;
  accentColor: string;
  onChange: (date: Date) => void;
}

function CalendarGrid({
  value,
  minimumDate,
  accentColor,
  onChange,
}: CalendarGridProps) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [calMode, setCalMode] = useState<'greg' | 'heb'>('greg');

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  // Build flat cell array: leading nulls then 1..daysInMonth, padded to multiple of 7
  const cells: (number | null)[] = Array(startDayOfWeek).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const goToPrev = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const hebMonthHeader = getHebrewMonthRangeForGregorianMonth(
    viewYear,
    viewMonth
  );

  return (
    <View style={cal.wrapper}>
      {/* Gregorian / Hebrew toggle */}
      <View style={cal.modeToggleRow}>
        <Pressable
          onPress={() => setCalMode('greg')}
          style={[
            cal.modeToggleBtn,
            calMode === 'greg' && cal.modeToggleBtnActive,
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="לועזי"
          accessibilityState={{ selected: calMode === 'greg' }}
        >
          <Text
            style={[
              cal.modeToggleText,
              calMode === 'greg' && cal.modeToggleTextActive,
            ]}
          >
            לועזי
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCalMode('heb')}
          style={[
            cal.modeToggleBtn,
            calMode === 'heb' && cal.modeToggleBtnActive,
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="עברי"
          accessibilityState={{ selected: calMode === 'heb' }}
        >
          <Text
            style={[
              cal.modeToggleText,
              calMode === 'heb' && cal.modeToggleTextActive,
            ]}
          >
            עברי
          </Text>
        </Pressable>
      </View>

      {/* Header */}
      <View style={cal.header}>
        {/* goToPrev is first child = physical RIGHT in RTL (→ points to past) */}
        <Pressable onPress={goToPrev} hitSlop={8}>
          <MaterialIcons name="chevron-right" size={24} color={accentColor} />
        </Pressable>
        <Text style={cal.headerTitle}>
          {calMode === 'heb' && hebMonthHeader
            ? hebMonthHeader
            : `${MONTH_NAMES_HE[viewMonth]} ${viewYear}`}
        </Text>
        {/* goToNext is last child = physical LEFT in RTL (← points to future) */}
        <Pressable onPress={goToNext} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={accentColor} />
        </Pressable>
      </View>

      {/* Day-of-week labels — row-reverse → א' on far right */}
      <View style={cal.row}>
        {DAY_LABELS.map((lbl) => (
          <View key={lbl} style={cal.cell}>
            <Text style={cal.dayLabel}>{lbl}</Text>
          </View>
        ))}
      </View>

      {/* Date rows */}
      {weeks.map((week, wi) => (
        <View key={wi} style={cal.row}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={cal.cell} />;
            const isSelected =
              day === value.getDate() &&
              viewMonth === value.getMonth() &&
              viewYear === value.getFullYear();
            const isDisabled =
              !!minimumDate && new Date(viewYear, viewMonth, day) < minimumDate;
            const hebDay =
              calMode === 'heb'
                ? getHebrewDateInfo(new Date(viewYear, viewMonth, day))
                    .hebrewDay || String(day)
                : null;
            return (
              <Pressable
                key={di}
                style={cal.cell}
                onPress={() =>
                  !isDisabled && onChange(new Date(viewYear, viewMonth, day))
                }
                disabled={isDisabled}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${day} ${MONTH_NAMES_HE[viewMonth]}`}
                accessibilityState={{
                  selected: isSelected,
                  disabled: isDisabled,
                }}
              >
                <View
                  style={[
                    cal.dayCircle,
                    isSelected && { backgroundColor: accentColor },
                  ]}
                >
                  <Text
                    style={[
                      cal.dayText,
                      isDisabled && cal.dayTextDisabled,
                      isSelected && cal.dayTextSelected,
                      calMode === 'heb' && cal.dayTextHeb,
                    ]}
                  >
                    {hebDay ?? day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const cal = StyleSheet.create({
  wrapper: { paddingHorizontal: 4, paddingBottom: 8 },
  modeToggleRow: {
    flexDirection: rtl.flexDirection,
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  modeToggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: '#f1f5f9',
  },
  modeToggleBtnActive: {
    backgroundColor: '#e8f5fd',
    borderColor: '#36a9e2',
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeToggleTextActive: {
    color: '#36a9e2',
  },
  header: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  // row-reverse via rtl.flexDirection so Sunday (index 0) stays on the physical RIGHT
  row: { flexDirection: rtl.flexDirection },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 14, color: '#111827' },
  dayTextDisabled: { color: '#d1d5db' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextHeb: { fontSize: 11 },
});

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
    endDate: new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    ).getTime(),
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
// Ordered so that היום is the first (physical RIGHT) chip in RTL layout.
const DAY_CHIPS = [
  { label: 'היום', daysFromNow: 0 },
  { label: 'מחר', daysFromNow: 1 },
  { label: 'מחרתיים', daysFromNow: 2 },
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

  // ── Shared "start date" row chips (reused in allDay and timed modes) ──────
  const StartDateChips = (
    <View style={s.chipsGroup}>
      {/* Date text chip — first = physical RIGHT in RTL */}
      <Pressable
        style={[s.dateTextChip, openPicker === 'startDate' && s.dateChipOpen]}
        onPress={() => togglePicker('startDate')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`תאריך התחלה: ${toNumericDate(startDate)}`}
      >
        <Text style={s.dateChipText}>{toNumericDate(startDate)}</Text>
      </Pressable>

      {/* Calendar icon — last = physical LEFT in RTL */}
      <Pressable
        style={[s.calIconBtn, openPicker === 'startDateGrid' && s.chipActive]}
        onPress={() => togglePicker('startDateGrid')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="לוח שנה - תאריך התחלה"
      >
        <MaterialIcons name="calendar-today" size={14} color={PRIMARY} />
      </Pressable>
    </View>
  );

  return (
    <View style={s.card}>
      {/* ── "כל היום" toggle ─────────────────────────────────────────────────── */}
      <View style={s.toggleRow}>
        {/* Label is first child = physical RIGHT in RTL */}
        <Text style={s.toggleLabel}>כל היום</Text>
        {/* Switch is last child = physical LEFT in RTL */}
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
      </View>

      <View style={s.divider} />

      {/* ── All-day mode: show start date only ───────────────────────────────── */}
      {isAllDay ? (
        <>
          <View style={[s.dateRow, { marginBottom: 0 }]}>
            {/* Label first = physical RIGHT in RTL */}
            <Text style={s.rowLabel}>תאריך</Text>
            {StartDateChips}
          </View>
          {getHebrewDateInfo(startDate).fullHebrewDate ? (
            <Text style={s.hebrewDateHint}>
              {getHebrewDateInfo(startDate).fullHebrewDate}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {/* ── Timed mode: start row ── */}
          <View style={s.dateRow}>
            {/* Label first = physical RIGHT in RTL */}
            <Text style={s.rowLabel}>התחלה</Text>
            <View style={s.chipsGroup}>
              {/* Date text chip — first = physical RIGHT in RTL */}
              <Pressable
                style={[
                  s.dateTextChip,
                  openPicker === 'startDate' && s.dateChipOpen,
                ]}
                onPress={() => togglePicker('startDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך התחלה: ${toNumericDate(startDate)}`}
              >
                <Text style={s.dateChipText}>{toNumericDate(startDate)}</Text>
              </Pressable>

              {/* Calendar icon */}
              <Pressable
                style={[
                  s.calIconBtn,
                  openPicker === 'startDateGrid' && s.chipActive,
                ]}
                onPress={() => togglePicker('startDateGrid')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="לוח שנה - תאריך התחלה"
              >
                <MaterialIcons
                  name="calendar-today"
                  size={14}
                  color={PRIMARY}
                />
              </Pressable>

              {/* Time chip — last = physical LEFT in RTL */}
              <Pressable
                style={[s.timeChip, openPicker === 'startTime' && s.chipActive]}
                onPress={() => togglePicker('startTime')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`שעת התחלה: ${startTime ?? 'לא נבחרה'}`}
              >
                <Text style={s.timeChipText}>{startTime ?? '--:--'}</Text>
              </Pressable>
            </View>
          </View>
          {getHebrewDateInfo(startDate).fullHebrewDate ? (
            <Text style={s.hebrewDateHint}>
              {getHebrewDateInfo(startDate).fullHebrewDate}
            </Text>
          ) : null}

          {/* ── Timed mode: end row ── */}
          <View style={[s.dateRow, { marginBottom: 0 }]}>
            {/* Label first = physical RIGHT in RTL */}
            <Text style={s.rowLabel}>סיום</Text>
            <View style={s.chipsGroup}>
              {/* Date text chip — first = physical RIGHT in RTL */}
              <Pressable
                style={[
                  s.dateTextChip,
                  openPicker === 'endDate' && s.dateChipOpen,
                  isInvalidRange && s.chipInvalid,
                ]}
                onPress={() => togglePicker('endDate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`תאריך סיום: ${toNumericDate(endDate)}`}
              >
                <Text
                  style={[s.dateChipText, isInvalidRange && s.chipTextInvalid]}
                >
                  {toNumericDate(endDate)}
                </Text>
              </Pressable>

              {/* Calendar icon */}
              <Pressable
                style={[
                  s.calIconBtn,
                  openPicker === 'endDateGrid' && s.chipActive,
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
                  color={isInvalidRange ? '#ef4444' : PRIMARY}
                />
              </Pressable>

              {/* Time chip — last = physical LEFT in RTL */}
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
                <Text
                  style={[s.timeChipText, isInvalidRange && s.chipTextInvalid]}
                >
                  {endTime ?? '--:--'}
                </Text>
              </Pressable>
            </View>
          </View>

          {getHebrewDateInfo(endDate).fullHebrewDate ? (
            <Text style={s.hebrewDateHint}>
              {getHebrewDateInfo(endDate).fullHebrewDate}
            </Text>
          ) : null}

          {isInvalidRange && (
            <Text style={s.invalidHint}>
              שעת הסיום חייבת להיות אחרי שעת ההתחלה
            </Text>
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
                  <Text
                    style={[s.dayChipText, isActive && s.dayChipTextActive]}
                  >
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
              accessibilityLabel="אישור"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Custom RTL calendar grid: start date */}
      {openPicker === 'startDateGrid' && (
        <View style={s.gridWrapper}>
          <CalendarGrid
            value={new Date(startDate)}
            accentColor={PRIMARY}
            onChange={(selected) => {
              handleStartDateChange(selected);
              setTimeout(closePicker, 150);
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
              accessibilityLabel="אישור"
            >
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
              accessibilityLabel="אישור"
            >
              <Text style={s.pickerConfirmText}>בחר</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Custom RTL calendar grid: end date */}
      {openPicker === 'endDateGrid' && !isAllDay && (
        <View style={s.gridWrapper}>
          <CalendarGrid
            value={new Date(endDate)}
            minimumDate={new Date(startDate)}
            accentColor={PRIMARY}
            onChange={(selected) => {
              handleEndDateChange(selected);
              setTimeout(closePicker, 150);
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
              accessibilityLabel="אישור"
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
  toggleRow: {
    flexDirection: rtl.flexDirection,
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
    textAlign: rtl.textAlign,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  dateRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: rtl.textAlign,
    minWidth: 48,
  },
  chipsGroup: {
    flexDirection: rtl.flexDirection,
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
  hebrewDateHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: rtl.textAlign,
    marginTop: 4,
    marginBottom: 4,
  },
  invalidHint: {
    fontSize: 11,
    color: '#ef4444',
    textAlign: rtl.textAlign,
    marginTop: 4,
  },
  dayChipsRow: {
    flexDirection: rtl.flexDirection,
    justifyContent: 'flex-start',
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
