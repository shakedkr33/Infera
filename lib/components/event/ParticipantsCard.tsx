import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Participant } from '@/lib/types/event';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

// Fixed turquoise style for all non-family participants
const CIRCLE_BG = '#e8f5fd';
const CIRCLE_BORDER = '#36a9e2';
const CIRCLE_TEXT = '#36a9e2';

// ─── Email parsing ────────────────────────────────────────────────────────────

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\n\r]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@') && e.includes('.'));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ParticipantsCardProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParticipantsCard({
  participants,
  onChange,
}: ParticipantsCardProps): React.JSX.Element {
  // 'main' = contacts button + email input; 'contacts' = contact list
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<'main' | 'contacts'>('main');
  const [emailText, setEmailText] = useState('');
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  // "הצג הכל" list modal
  const [listOpen, setListOpen] = useState(false);

  const openSheet = useCallback((): void => {
    setSheetView('main');
    setEmailText('');
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback((): void => {
    setSheetOpen(false);
    setEmailText('');
    setContactSearch('');
    setContacts([]);
    setSheetView('main');
  }, []);

  // ── Add participants from email textarea ──────────────────────────────────
  const confirmEmailInput = (): void => {
    const emails = parseEmails(emailText);
    if (emails.length === 0) {
      closeSheet();
      return;
    }
    const existing = new Set(participants.map((p) => p.email));
    const newOnes: Participant[] = emails
      .filter((email) => !existing.has(email))
      .map((email, i) => ({
        id: `email-${Date.now()}-${i}`,
        name: email,
        email,
        color: CIRCLE_BG, // use turquoise tint for email participants
      }));
    onChange([...participants, ...newOnes]);
    closeSheet();
  };

  // ── Load device contacts (filtered by phone, not email) ───────────────────
  const openContactsPicker = useCallback(async (): Promise<void> => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'גישה לאנשי קשר',
          'אנא אפשרי גישה לאנשי קשר בהגדרות הטלפון.',
          [{ text: 'הבנתי' }]
        );
        setLoadingContacts(false);
        return;
      }
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      // Only contacts that have a name AND at least one phone number
      const withPhone = (result.data ?? []).filter(
        (c) => c.name && (c.phoneNumbers?.length ?? 0) > 0
      );
      setContacts(withPhone);
      setContactSearch('');
      setSheetView('contacts');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לטעון אנשי קשר.');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // ── Select a contact ──────────────────────────────────────────────────────
  const selectContact = (contact: Contacts.Contact): void => {
    const phone = contact.phoneNumbers?.[0]?.number ?? '';
    if (!phone) return;
    if (participants.some((p) => p.phone === phone)) {
      setSheetView('main');
      return;
    }
    const next: Participant = {
      id: `contact-${Date.now()}`,
      name: contact.name ?? phone,
      phone,
      color: CIRCLE_BG,
    };
    onChange([...participants, next]);
    setSheetView('main');
  };

  const removeParticipant = (id: string): void => {
    onChange(participants.filter((p) => p.id !== id));
  };

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    if (!q) return true;
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.phoneNumbers?.[0]?.number ?? '').includes(q)
    );
  });

  // ── Circle badge helpers ──────────────────────────────────────────────────
  const initial = (p: Participant): string =>
    (p.name.trim() || '?')[0]?.toUpperCase() ?? '?';

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <Pressable
          style={s.addBtn}
          onPress={openSheet}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף משתתף"
        >
          <Ionicons name="add" size={18} color={PRIMARY} />
        </Pressable>
        <Text style={s.label}>משתתפים</Text>
        <View style={[s.iconCircle, { backgroundColor: TINT }]}>
          <Ionicons name="people-outline" size={20} color={PRIMARY} />
        </View>
      </View>

      {/* ── Participant circles row ── */}
      {participants.length > 0 && (
        <View style={s.circlesRow}>
          {participants.map((p) => (
            <Pressable
              key={p.id}
              style={s.circle}
              onLongPress={() => removeParticipant(p.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${p.name} — לחץ לחיצה ארוכה להסרה`}
            >
              <Text style={s.circleText}>{initial(p)}</Text>
            </Pressable>
          ))}

          {/* "הצג הכל" — appears right next to circles */}
          <Pressable
            style={s.showAllBtn}
            onPress={() => setListOpen(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`הצג הכל ${participants.length}`}
          >
            <Text style={s.showAllText}>הצג הכל ({participants.length})</Text>
          </Pressable>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Add-participant sheet
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={s.modalOverlay} onPress={closeSheet}>
            <Pressable style={s.sheet} onPress={() => undefined}>
              <View style={s.handle} />

              {/* ── Contacts view ── */}
              {sheetView === 'contacts' && (
                <>
                  <View style={s.sheetHeaderRow}>
                    <Pressable
                      onPress={() => setSheetView('main')}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="חזרה"
                    >
                      <Ionicons name="chevron-forward" size={22} color="#334155" />
                    </Pressable>
                    <Text style={s.sheetTitle}>בחירה מאנשי קשר</Text>
                    <View style={{ width: 22 }} />
                  </View>

                  <TextInput
                    style={s.searchInput}
                    value={contactSearch}
                    onChangeText={setContactSearch}
                    placeholder="חיפוש לפי שם או מספר..."
                    placeholderTextColor="#9ca3af"
                    textAlign="right"
                    accessible={true}
                    accessibilityLabel="חיפוש"
                  />

                  <FlatList
                    data={filteredContacts}
                    keyExtractor={(c, i) => (c as { id?: string }).id ?? `c-${i}`}
                    style={s.contactList}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <Pressable
                        style={s.contactRow}
                        onPress={() => selectContact(item)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={item.name ?? ''}
                      >
                        <Text style={s.contactPhone} numberOfLines={1}>
                          {item.phoneNumbers?.[0]?.number}
                        </Text>
                        <Text style={s.contactName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </Pressable>
                    )}
                    ListEmptyComponent={
                      <Text style={s.emptyContacts}>
                        {loadingContacts ? 'טוען...' : 'לא נמצאו אנשי קשר'}
                      </Text>
                    }
                  />
                </>
              )}

              {/* ── Main view ── */}
              {sheetView === 'main' && (
                <>
                  <Text style={s.sheetTitle}>הוסף משתתף</Text>

                  <Pressable
                    style={s.contactsBtn}
                    onPress={openContactsPicker}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="בחירה מאנשי קשר"
                  >
                    <Ionicons name="person-circle-outline" size={20} color={PRIMARY} />
                    <Text style={s.contactsBtnText}>
                      {loadingContacts ? 'טוען...' : 'בחירה מאנשי קשר'}
                    </Text>
                  </Pressable>

                  <View style={s.separatorRow}>
                    <View style={s.separatorLine} />
                    <Text style={s.separatorOr}>או הכנס ישירות</Text>
                    <View style={s.separatorLine} />
                  </View>

                  <Text style={s.emailHint}>
                    כתובות אימייל, מופרדות בפסיק, נקודה-פסיק או שורה חדשה
                  </Text>
                  <TextInput
                    style={s.emailTextArea}
                    value={emailText}
                    onChangeText={setEmailText}
                    placeholder={'user@example.com, another@example.com'}
                    placeholderTextColor="#9ca3af"
                    textAlign="right"
                    multiline
                    numberOfLines={3}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessible={true}
                    accessibilityLabel="כתובות אימייל"
                  />

                  <Pressable
                    style={s.saveBtn}
                    onPress={confirmEmailInput}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="שמור"
                  >
                    <Text style={s.saveBtnText}>שמור</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          "הצג הכל" list modal — shows full participant list
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setListOpen(false)}>
          <Pressable style={[s.sheet, { maxHeight: '70%' }]} onPress={() => undefined}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>משתתפים באירוע</Text>

            <FlatList
              data={participants}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <View style={s.listRow}>
                  {/* Turquoise circle */}
                  <Pressable
                    style={s.listRemoveBtn}
                    onPress={() => {
                      removeParticipant(item.id);
                      if (participants.length <= 1) setListOpen(false);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`הסר ${item.name}`}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listName} numberOfLines={1}>{item.name}</Text>
                    {(item.phone ?? item.email) ? (
                      <Text style={s.listSub} numberOfLines={1}>
                        {item.phone ?? item.email}
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.circle}>
                    <Text style={s.circleText}>{initial(item)}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={s.emptyContacts}>אין משתתפים</Text>
              }
            />
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
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Circles row ───────────────────────────────────────────────────────────
  circlesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CIRCLE_BG,
    borderWidth: 2,
    borderColor: CIRCLE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 14,
    fontWeight: '700',
    color: CIRCLE_TEXT,
  },
  showAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  showAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 14,
  },
  contactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TINT,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  contactsBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  separatorOr: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emailHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 6,
  },
  emailTextArea: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // ── Contacts list ─────────────────────────────────────────────────────────
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  contactList: {
    maxHeight: 340,
  },
  contactRow: {
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
  },
  contactPhone: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  emptyContacts: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  // ── "הצג הכל" list modal rows ─────────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  listRemoveBtn: {
    padding: 4,
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
  },
  listSub: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
});
