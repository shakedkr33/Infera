import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoogleCalendarAuth } from '../../lib/hooks/useGoogleCalendarAuth';
import { useGoogleCalendarList } from '../../lib/hooks/useGoogleCalendarList';

const PRIMARY = '#36a9e2';

// ─── Calendar row ──────────────────────────────────────────────────────────────
// Defined at module level to comply with the no-nested-components rule.

type CalendarRowProps = {
  title: string;
  isPrimary: boolean;
  isSelected: boolean;
  onToggle: () => void;
};

function CalendarRow({ title, isPrimary, isSelected, onToggle }: CalendarRowProps): React.JSX.Element {
  // Include the primary label in the accessibility announcement so screen
  // readers surface it without the user having to inspect the badge visually.
  const a11yLabel = isPrimary ? `${title} – יומן ראשי` : title;

  return (
    <Pressable
      style={[s.calendarItem, isSelected && s.calendarItemSelected]}
      onPress={onToggle}
      accessible={true}
      accessibilityRole="checkbox"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ checked: isSelected }}
    >
      <View style={s.calendarItemInner}>
        {/* row-reverse: title on right (RTL start), badge + checkbox on left (RTL end) */}
        <Text style={s.calendarTitle} numberOfLines={2}>
          {title}
        </Text>
        {isPrimary ? (
          <View style={s.primaryBadge}>
            <Text style={s.primaryBadgeText}>יומן ראשי</Text>
          </View>
        ) : null}
        <View style={[s.calendarCheck, isSelected && s.calendarCheckActive]}>
          {isSelected ? (
            <MaterialIcons name="check" size={14} color="#fff" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ImportCalendarScreen(): React.JSX.Element {
  const router = useRouter();

  // ── OAuth hook ──────────────────────────────────────────────────────────────
  const { status, accessToken, errorMessage, startAuthorization, clearAuthorization } =
    useGoogleCalendarAuth();

  // ── Calendar list hook ──────────────────────────────────────────────────────
  // Receives the in-memory token; automatically fetches when the token is set
  // and clears when the token becomes null.
  const {
    status: listStatus,
    calendars,
    reload: reloadCalendars,
  } = useGoogleCalendarList(accessToken);

  // ── Selection state ─────────────────────────────────────────────────────────
  // Kept in local React state only. Never logged, persisted, or sent anywhere.
  // Exists solely to support the next phase.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

  // Guards the one-time primary preselection so that user deselections or
  // subsequent reloads do not force the primary calendar back into the set.
  const initialPreselectionDoneRef = useRef(false);

  // ── Primary preselection ────────────────────────────────────────────────────
  // Runs once when the list first reaches 'ready'. After that, the ref flag
  // prevents any further automatic selection — user choices are preserved.
  useEffect(() => {
    if (listStatus !== 'ready' || initialPreselectionDoneRef.current) return;
    initialPreselectionDoneRef.current = true;
    const primary = calendars.find((c) => c.isPrimary);
    if (primary) {
      setSelectedIds(new Set<string>([primary.id]));
    }
  }, [listStatus, calendars]);

  // ── Toggle a calendar in/out of the selection ───────────────────────────────
  const toggleCalendar = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Navigation-away cleanup ─────────────────────────────────────────────────
  // Fires on screen blur (back navigation, tab switch, etc.).
  // clearAuthorization() sets accessToken to null, which triggers the
  // calendar list hook to clear its own state reactively.
  // Selection state and the preselection guard are reset here directly.
  useFocusEffect(
    useCallback(() => {
      return () => {
        clearAuthorization();
        setSelectedIds(new Set<string>());
        initialPreselectionDoneRef.current = false;
      };
    }, [clearAuthorization]),
  );

  const isOAuthLoading = status === 'authorizing' || status === 'exchanging';
  const oAuthLoadingLabel =
    status === 'authorizing' ? 'פותח חלון אישור...' : 'מאמת גישה...';

  // listStatus 'idle' only flickers for one render cycle before the hook
  // effect fires and transitions to 'loading'; treat it as loading here.
  const isCalendarLoading = listStatus === 'idle' || listStatus === 'loading';

  return (
    <SafeAreaView style={s.screen}>
      {/* Custom header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="חזור"
        >
          <MaterialIcons name="arrow-forward-ios" size={20} color="#1e293b" />
        </Pressable>
        <Text style={s.headerTitle}>העתקת אירועים</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Idle: initial CTA ──────────────────────────────────────────────── */}
      {status === 'idle' && (
        <View style={s.centerStep}>
          <View style={s.googleIconWrap}>
            <View style={s.googleCircle}>
              <Text style={s.googleLetter}>G</Text>
            </View>
          </View>

          <Text style={s.mainTitle}>העתקת אירועים מ-Google</Text>
          <Text style={s.subtitle}>
            {'ניצור עותק של האירועים שתבחרי ב\u2011InYomi.\nהיומן המקורי לא ישתנה.'}
          </Text>

          <Pressable
            style={s.primaryBtn}
            onPress={startAuthorization}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="המשך ל-Google לאישור גישה ליומן"
          >
            <View style={s.googleBtnIcon}>
              <Text style={s.googleLetter}>G</Text>
            </View>
            <Text style={s.primaryBtnText}>המשך ל־Google</Text>
          </Pressable>

          <View style={s.scopeNote}>
            <MaterialIcons name="lock" size={14} color="#94a3b8" />
            <Text style={s.scopeNoteText}>גישה לקריאה בלבד · לא נשמרת סיסמה</Text>
          </View>
        </View>
      )}

      {/* ─── Authorizing / exchanging: OAuth loading ─────────────────────────── */}
      {isOAuthLoading && (
        <View style={s.centerStep}>
          <View style={s.googleIconWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
          <Text style={s.mainTitle}>{oAuthLoadingLabel}</Text>
        </View>
      )}

      {/* ─── Authorized + calendar loading ───────────────────────────────────── */}
      {status === 'authorized' && isCalendarLoading && (
        <View style={s.centerStep}>
          <View style={s.googleIconWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
          <Text style={s.mainTitle}>טוען יומנים...</Text>
        </View>
      )}

      {/* ─── Authorized + calendars ready: selection UI ───────────────────────── */}
      {status === 'authorized' && listStatus === 'ready' && (
        <ScrollView
          style={s.listContainer}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.listHeading}>
            <Text style={s.mainTitle}>בחירת יומנים</Text>
            <Text style={s.subtitle}>בחרי את היומנים שמהם תרצי להעתיק אירועים.</Text>
            <Text style={s.helperText}>אפשר לבחור יותר מיומן אחד.</Text>
          </View>

          {calendars.map((cal) => (
            <CalendarRow
              key={cal.id}
              title={cal.title}
              isPrimary={cal.isPrimary}
              isSelected={selectedIds.has(cal.id)}
              onToggle={() => toggleCalendar(cal.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* ─── Authorized + no calendars found ─────────────────────────────────── */}
      {status === 'authorized' && listStatus === 'empty' && (
        <View style={s.centerStep}>
          <View style={s.errorIconWrap}>
            <MaterialIcons name="event-busy" size={56} color="#cbd5e1" />
          </View>
          <Text style={s.mainTitle}>לא נמצאו יומנים זמינים.</Text>
          <Pressable
            style={s.primaryBtn}
            onPress={reloadCalendars}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="נסי שוב"
          >
            <Text style={s.primaryBtnText}>נסי שוב</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Authorized + calendar load error ────────────────────────────────── */}
      {status === 'authorized' && listStatus === 'error' && (
        <View style={s.centerStep}>
          <View style={s.errorIconWrap}>
            <MaterialIcons name="error-outline" size={56} color="#f59e0b" />
          </View>
          <Text style={s.errorText}>לא ניתן לטעון את היומנים. נסי שוב.</Text>
          <Pressable
            style={s.primaryBtn}
            onPress={reloadCalendars}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="נסי שוב"
          >
            <Text style={s.primaryBtnText}>נסי שוב</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Denied or OAuth error: message + retry ──────────────────────────── */}
      {(status === 'denied' || status === 'error') && (
        <View style={s.centerStep}>
          <View style={s.errorIconWrap}>
            <MaterialIcons name="error-outline" size={56} color="#f59e0b" />
          </View>

          <Text style={s.errorText}>{errorMessage}</Text>

          <Pressable
            style={s.primaryBtn}
            onPress={clearAuthorization}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="נסי שוב"
          >
            <Text style={s.primaryBtnText}>נסי שוב</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f8' },

  // ─── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },

  // ─── Shared centered layout ───────────────────────────────────────────
  centerStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  googleIconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  googleCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  googleLetter: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4285F4',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ─── Primary button ───────────────────────────────────────────────────
  primaryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },

  // ─── Scope note ───────────────────────────────────────────────────────
  scopeNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scopeNoteText: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // ─── Error / denied state ─────────────────────────────────────────────
  errorIconWrap: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },

  // ─── Calendar selection list ──────────────────────────────────────────
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },
  listHeading: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  helperText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // ─── Calendar item row ────────────────────────────────────────────────
  calendarItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  calendarItemSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#f0f9ff',
  },
  calendarItemInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  calendarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'right',
  },

  // ─── Checkbox indicator ───────────────────────────────────────────────
  calendarCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  calendarCheckActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  // ─── Primary calendar badge ───────────────────────────────────────────
  primaryBadge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0284c7',
  },
});
