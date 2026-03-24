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
  ScrollView,
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

// ─── Phone helpers ────────────────────────────────────────────────────────────

/** Strip all non-digit characters for stable comparison */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Prefer mobile/נייד label; otherwise first available number */
function getPrimaryPhone(contact: Contacts.Contact): string {
  const phones = contact.phoneNumbers ?? [];
  if (phones.length === 0) return '';
  const mobileLabels = ['mobile', 'iphone', 'cell', 'נייד'];
  const mobile = phones.find((p) =>
    mobileLabels.some((lbl) => (p.label ?? '').toLowerCase().includes(lbl))
  );
  return (mobile ?? phones[0])?.number ?? '';
}

/** Stable key for a contact: prefer contact.id, fallback to normalised phone */
function contactKey(contact: Contacts.Contact): string {
  return (contact as { id?: string }).id ?? normalizePhone(getPrimaryPhone(contact));
}

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
  /** Temporarily selected contact keys (stable id or normalised phone) */
  const [draftContactIds, setDraftContactIds] = useState<string[]>([]);
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
    setDraftContactIds([]);
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
      setDraftContactIds([]);
      setSheetView('contacts');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לטעון אנשי קשר.');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // ── Already-added guard (normalised phone dedupe) ─────────────────────────
  const addedPhones = new Set(
    participants
      .map((p) => normalizePhone(p.phone ?? ''))
      .filter((n) => n.length > 0)
  );

  const isAlreadyAdded = (contact: Contacts.Contact): boolean => {
    const norm = normalizePhone(getPrimaryPhone(contact));
    return norm.length > 0 && addedPhones.has(norm);
  };

  // ── Toggle a contact in/out of draft selection ────────────────────────────
  const toggleContactDraft = (contact: Contacts.Contact): void => {
    if (isAlreadyAdded(contact)) return; // already in event — ignore
    const key = contactKey(contact);
    setDraftContactIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ── Commit all drafted contacts at once ───────────────────────────────────
  const saveContactsDraft = (): void => {
    if (draftContactIds.length === 0) {
      closeSheet();
      return;
    }
    const newOnes: Participant[] = draftContactIds
      .map((key) => contacts.find((c) => contactKey(c) === key))
      .filter((c): c is Contacts.Contact => c != null)
      .map((c, i) => {
        const phone = getPrimaryPhone(c);
        const localDisplayName = c.name?.trim() || undefined;
        // TODO: for shared event view, resolve sharedDisplayName via user lookup by phone before rendering to non-creator participants
        return {
          id: `contact-${Date.now()}-${i}`,
          name: localDisplayName ?? phone,
          phone,
          localDisplayName,
          color: CIRCLE_BG,
        };
      });
    onChange([...participants, ...newOnes]);
    closeSheet();
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
          <View style={{ flex: 1 }}>
            {/* Backdrop — separate from sheet so sheet gestures never reach it */}
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
            <View style={s.modalSheetWrapper}>
            <View
              style={[s.sheet, sheetView === 'contacts' && s.sheetContacts]}
            >
              <View style={s.handle} />

              {/* ── Contacts view ── */}
              {sheetView === 'contacts' && (
                <View style={s.contactsViewContainer}>
                  <View style={s.sheetHeaderRow}>
                    <Pressable
                      onPress={() => {
                        setSheetView('main');
                        setDraftContactIds([]);
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="חזרה"
                    >
                      <Ionicons name="chevron-forward" size={22} color="#334155" />
                    </Pressable>
                    <Text style={s.sheetTitle}>בחירה מאנשי קשר</Text>
                    {/* Live counter */}
                    {draftContactIds.length > 0 ? (
                      <Text style={s.draftCounter}>נבחרו {draftContactIds.length}</Text>
                    ) : (
                      <View style={{ width: 42 }} />
                    )}
                  </View>

                  {/* ── Selected-contact chips — above search, capped height ── */}
                  {draftContactIds.length > 0 && (
                    <View style={s.selectedSummaryBox}>
                      <Text style={s.selectedSummaryLabel}>נבחרו</Text>
                      <ScrollView
                        scrollEnabled
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        scrollIndicatorInsets={{ right: 1 }}
                        style={{ maxHeight: 96 }}
                        keyboardShouldPersistTaps="handled"
                      >
                        <View style={s.chipWrap}>
                          {draftContactIds.map((key) => {
                            const c = contacts.find((ct) => contactKey(ct) === key);
                            const phone = c ? getPrimaryPhone(c) : '';
                            const label = c?.name?.trim() || phone || key;
                            return (
                              <View key={key} style={s.chip}>
                                {/* ✕ on LEFT side (RTL logical end) */}
                                <Pressable
                                  onPress={() => {
                                    setDraftContactIds((prev) =>
                                      prev.filter((k) => k !== key)
                                    );
                                  }}
                                  hitSlop={6}
                                  accessible={true}
                                  accessibilityRole="button"
                                  accessibilityLabel={`הסר ${label}`}
                                >
                                  <Ionicons name="close" size={12} color={PRIMARY} />
                                </Pressable>
                                <Text style={s.chipText} numberOfLines={1}>
                                  {label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}

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
                    keyExtractor={(c, i) => contactKey(c) || `c-${i}`}
                    style={s.contactList}
                    contentContainerStyle={{ paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled
                    nestedScrollEnabled
                    renderItem={({ item }) => {
                      const alreadyAdded = isAlreadyAdded(item);
                      const key = contactKey(item);
                      const selected = !alreadyAdded && draftContactIds.includes(key);
                      const phone = getPrimaryPhone(item);
                      const displayName = item.name?.trim() || phone;
                      return (
                        <Pressable
                          style={[
                            s.contactRow,
                            selected && s.contactRowSelected,
                            alreadyAdded && s.contactRowDisabled,
                          ]}
                          onPress={() => toggleContactDraft(item)}
                          disabled={alreadyAdded}
                          accessible={true}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected, disabled: alreadyAdded }}
                          accessibilityLabel={displayName}
                        >
                          {/* RTL: name+phone on the right, checkmark on the left */}
                          <View style={s.contactRowInfo}>
                            <Text style={s.contactName} numberOfLines={1}>
                              {displayName}
                            </Text>
                            {phone.length > 0 && (
                              <Text style={s.contactPhone} numberOfLines={1}>
                                {phone}
                              </Text>
                            )}
                          </View>
                          {/* Checkmark on visual left (logical end in RTL) */}
                          <View style={[s.contactCheck, selected && s.contactCheckSelected]}>
                            {(selected || alreadyAdded) && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color={alreadyAdded ? '#94a3b8' : '#fff'}
                              />
                            )}
                          </View>
                        </Pressable>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={s.emptyContacts}>
                        {loadingContacts ? 'טוען...' : 'לא נמצאו אנשי קשר'}
                      </Text>
                    }
                  />

                  {/* Save button — pinned to bottom */}
                  <Pressable
                    style={[
                      s.saveBtn,
                      draftContactIds.length === 0 && s.saveBtnDisabled,
                    ]}
                    onPress={saveContactsDraft}
                    disabled={draftContactIds.length === 0}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`שמור ${draftContactIds.length} אנשי קשר`}
                  >
                    <Text style={s.saveBtnText}>
                      {draftContactIds.length > 0
                        ? `שמור (${draftContactIds.length})`
                        : 'שמור'}
                    </Text>
                  </Pressable>
                </View>
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
            </View>
            </View>
          </View>
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
  modalSheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    // No flex:1 here — main view ("הוסף משתתף") must size to content only
    maxHeight: '88%',
  },
  // Applied only in contacts view — restores flex distribution for FlatList
  sheetContacts: {
    flex: 1,
  },
  // Flex container for the contacts view — distributes space so FlatList fills remainder
  contactsViewContainer: {
    flex: 1,
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
    // flex: 1 fills remaining space between summary/search and the save button
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  contactRowSelected: {
    backgroundColor: TINT,
    borderRadius: 8,
  },
  contactRowDisabled: {
    opacity: 0.4,
  },
  contactRowInfo: {
    flex: 1,
    alignItems: 'flex-end',
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
  // Checkmark box on visual left (logical end in RTL)
  contactCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCheckSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  // Selected-contact chips summary box (above search field)
  selectedSummaryBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  selectedSummaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 6,
  },
  // RTL chip wrap — inside ScrollView, no maxHeight needed here
  chipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  // Live counter shown in header row
  draftCounter: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
    minWidth: 42,
    textAlign: 'right',
  },
  saveBtnDisabled: {
    backgroundColor: '#e5e7eb',
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
