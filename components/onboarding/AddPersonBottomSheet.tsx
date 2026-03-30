// FIXED: added single/multi mode to shared contact picker
// FIXED: family-member contact flow now uses shared light contact picker in single mode
// FIXED: legacy dark native picker removed from family-profile flow
// FAMILY FLOW: single-select contact import with phone disambiguation
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { colors, shadows } from '../../constants/theme';
// SHARED: phone selection logic for contact import
// FIXED: updated phone label filter to mobile-capable labels only
import {
  getMobilePhones,
  getPhoneLabel,
  getPrimaryPhone,
  normalizePhone,
} from '../../lib/utils/contactPhone';

const PRIMARY = colors.primary; // '#36a9e2'
const TINT = '#e8f5fd';

export interface SelectedContactData {
  name: string;
  phone?: string;
  email?: string;
  contactId?: string;
}

interface AddPersonBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  // FIXED: selected contact data passed into family-member editor
  onContactSelected: (data: SelectedContactData) => void;
  onManual: () => void;
}

export function AddPersonBottomSheet({
  visible,
  onClose,
  onContactSelected,
  onManual,
}: AddPersonBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  // ── View state ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<'main' | 'contacts' | 'phone-picker' | 'no-mobile'>('main');
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Phone disambiguation state (family flow)
  const [disambigContact, setDisambigContact] = useState<Contacts.Contact | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string>('');

  // ── Animation + state reset ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Reset all internal state on each open
      setView('main');
      setContacts([]);
      setSearch('');
      setLoadingContacts(false);
      setSelectedKey(null);
      setDisambigContact(null);
      setSelectedPhone('');
      // no-mobile state resets automatically (shares disambigContact)
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // ── Load contacts ──────────────────────────────────────────────────────────
  const openContactsPicker = async () => {
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
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName,
      });
      // FIXED: updated phone label filter to mobile-capable labels only
      // Only show contacts that have at least one mobile-capable number
      const withPhone = (result.data ?? []).filter(
        (c) => c.name && getMobilePhones(c).length > 0
      );
      setContacts(withPhone);
      setSearch('');
      setSelectedKey(null);
      setView('contacts');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לטעון אנשי קשר.');
    } finally {
      setLoadingContacts(false);
    }
  };

  // ── Helpers shared by both confirmation paths ──────────────────────────────
  const resolveContactFields = (contact: Contacts.Contact) => ({
    name:
      contact.name?.trim() ||
      [
        (contact as { firstName?: string }).firstName?.trim(),
        (contact as { lastName?: string }).lastName?.trim(),
      ]
        .filter(Boolean)
        .join(' ') ||
      'איש קשר',
    email: contact.emails?.[0]?.email || undefined,
    contactId: (contact as { id?: string }).id,
  });

  // ── Confirm selection (contacts view → phone check) ────────────────────────
  // FIXED: updated phone label filter to mobile-capable labels only
  const confirmSelection = () => {
    if (!selectedKey) return;
    const contact = contacts.find(
      (c) => ((c as { id?: string }).id ?? getPrimaryPhone(c)) === selectedKey
    );
    if (!contact) return;

    // FAMILY FLOW: single-select contact import with phone disambiguation
    const mobilePhones = getMobilePhones(contact);

    if (mobilePhones.length === 0) {
      // No mobile-capable numbers — show help state instead of all-number fallback
      setDisambigContact(contact);
      setView('no-mobile');
    } else if (mobilePhones.length > 1) {
      // Multiple mobile numbers — open disambiguation picker (mobile only)
      setDisambigContact(contact);
      setSelectedPhone(mobilePhones[0]?.number ?? ''); // preselect first mobile
      setView('phone-picker');
    } else {
      // Exactly one mobile number — continue directly to family-member editor
      const { name, email, contactId } = resolveContactFields(contact);
      const phone = normalizePhone(mobilePhones[0]?.number ?? '') || undefined;
      onContactSelected({ name, phone, email, contactId });
      onClose();
    }
  };

  // ── Confirm phone selection (phone-picker view) ────────────────────────────
  const confirmPhoneSelection = () => {
    if (!disambigContact || !selectedPhone) return;
    const { name, email, contactId } = resolveContactFields(disambigContact);
    const phone = normalizePhone(selectedPhone) || undefined;
    onContactSelected({ name, phone, email, contactId });
    onClose();
  };

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      (getPrimaryPhone(c) ?? '').includes(q)
    );
  });

  const contactKey = (c: Contacts.Contact) =>
    (c as { id?: string }).id ?? getPrimaryPhone(c);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1 }}>
          {/* Backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessible={false}
          />

            <Animated.View
              style={[
                s.sheet,
                (view === 'contacts' || view === 'phone-picker' || view === 'no-mobile') && s.sheetContacts,
                { transform: [{ translateY: slideAnim }] },
                shadows.strong,
              ]}
            >
            {/* Drag indicator */}
            <View style={s.handle} />

            {/* ── Main view ── */}
            {view === 'main' && (
              <>
                <Text style={s.title}>איך תרצי להוסיף אדם?</Text>

                {/* From Contacts */}
                <Pressable
                  onPress={openContactsPicker}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="בחירה מאנשי קשר"
                  accessibilityHint="בחירה מתוך אנשי הקשר שלך"
                  style={[s.optionRow, shadows.subtle]}
                >
                  <View
                    style={[
                      s.optionIcon,
                      { backgroundColor: `${PRIMARY}18` },
                    ]}
                  >
                    <MaterialIcons
                      name="contact-page"
                      size={26}
                      color={PRIMARY}
                    />
                  </View>
                  <View style={s.optionTexts}>
                    <Text style={s.optionTitle}>
                      {loadingContacts ? 'טוען...' : 'בחירה מאנשי קשר'}
                    </Text>
                    <Text style={s.optionSub}>בחירה מתוך אנשי הקשר שלך.</Text>
                  </View>
                </Pressable>

                {/* Manual Entry */}
                <Pressable
                  onPress={() => {
                    onClose();
                    onManual();
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="הוספה ידנית"
                  accessibilityHint="הוספה באמצעות הזנת שם ופרטים"
                  style={[s.optionRow, shadows.subtle]}
                >
                  <View
                    style={[
                      s.optionIcon,
                      { backgroundColor: `${PRIMARY}18` },
                    ]}
                  >
                    <MaterialIcons
                      name="person-add"
                      size={26}
                      color={PRIMARY}
                    />
                  </View>
                  <View style={s.optionTexts}>
                    <Text style={s.optionTitle}>הוספה ידנית</Text>
                    <Text style={s.optionSub}>
                      הוספה באמצעות הזנת שם ופרטים.
                    </Text>
                  </View>
                </Pressable>
              </>
            )}

            {/* ── Phone-picker view (disambiguation when contact has multiple numbers) ── */}
            {view === 'phone-picker' && disambigContact && (
              <View style={s.contactsContainer}>
                {/* Header row */}
                <View style={s.contactsHeader}>
                  <Pressable
                    onPress={() => {
                      setView('contacts');
                      setDisambigContact(null);
                      setSelectedPhone('');
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="חזרה"
                  >
                    <Ionicons name="chevron-forward" size={22} color="#334155" />
                  </Pressable>
                  <Text style={s.contactsTitle}>בחירת מספר טלפון</Text>
                  <View style={{ width: 42 }} />
                </View>

                {/* Helper text */}
                <Text style={s.phonePickerHelper}>
                  באיזה מספר נשתמש עבור{' '}
                  {disambigContact.name?.trim() || 'בן המשפחה'}?
                </Text>

                {/* FIXED: updated phone label filter to mobile-capable labels only
                    Show ONLY mobile-capable numbers — no landline/fax fallback */}
                {getMobilePhones(disambigContact).map((phone, idx) => {
                  const isSelected = selectedPhone === phone.number;
                  return (
                    <Pressable
                      key={`phone-${phone.number ?? ''}-${idx}`}
                      style={[
                        s.contactRow,
                        isSelected && s.contactRowSelected,
                      ]}
                      onPress={() => setSelectedPhone(phone.number ?? '')}
                      accessible={true}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${getPhoneLabel(phone.label)} ${phone.number ?? ''}`}
                    >
                      {/* Label + number — RTL right side */}
                      <View style={s.contactRowInfo}>
                        <Text style={s.contactName}>
                          {getPhoneLabel(phone.label)}
                        </Text>
                        <Text style={s.contactPhone}>{phone.number}</Text>
                      </View>
                      {/* Radio circle — visual left (logical end in RTL) */}
                      <View
                        style={[
                          s.contactCheck,
                          isSelected && s.contactCheckSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#fff"
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}

                {/* "המשך" CTA */}
                <Pressable
                  style={[s.ctaBtn, !selectedPhone && s.ctaBtnDisabled]}
                  onPress={confirmPhoneSelection}
                  disabled={!selectedPhone}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="המשך"
                  accessibilityState={{ disabled: !selectedPhone }}
                >
                  <Text style={s.ctaBtnText}>המשך</Text>
                </Pressable>
              </View>
            )}

            {/* ── No-mobile view — shown when contact has no mobile-capable numbers ── */}
            {/* FIXED: updated phone label filter to mobile-capable labels only */}
            {view === 'no-mobile' && disambigContact && (
              <View style={s.contactsContainer}>
                {/* Back header */}
                <View style={s.contactsHeader}>
                  <Pressable
                    onPress={() => {
                      setView('contacts');
                      setDisambigContact(null);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="חזרה"
                  >
                    <Ionicons name="chevron-forward" size={22} color="#334155" />
                  </Pressable>
                  <Text style={s.contactsTitle}>מספר טלפון</Text>
                  <View style={{ width: 42 }} />
                </View>

                {/* Icon + message */}
                <View style={s.noMobileBox}>
                  <MaterialIcons name="phone-disabled" size={36} color="#cbd5e1" />
                  <Text style={s.noMobileText}>
                    לא נמצא מספר נייד לאיש קשר זה
                  </Text>
                  <Text style={s.noMobileSubText}>
                    {disambigContact.name?.trim() || 'איש הקשר'} אינו כולל מספר נייד בפנקס הטלפונים.
                  </Text>
                </View>

                {/* Primary: manual entry */}
                <Pressable
                  style={s.ctaBtn}
                  onPress={() => {
                    onClose();
                    onManual();
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="הזנה ידנית"
                >
                  <Text style={s.ctaBtnText}>הזנה ידנית</Text>
                </Pressable>

                {/* Secondary: back to contact list */}
                <Pressable
                  style={s.noMobileBackBtn}
                  onPress={() => {
                    setView('contacts');
                    setDisambigContact(null);
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="חזרה לרשימת אנשי הקשר"
                >
                  <Text style={s.noMobileBackText}>חזרה</Text>
                </Pressable>
              </View>
            )}

            {/* ── Contacts view (single-select) ── */}
            {view === 'contacts' && (
              <View style={s.contactsContainer}>
                {/* Header row */}
                <View style={s.contactsHeader}>
                  <Pressable
                    onPress={() => {
                      setView('main');
                      setSelectedKey(null);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="חזרה"
                  >
                    <Ionicons name="chevron-forward" size={22} color="#334155" />
                  </Pressable>
                  <Text style={s.contactsTitle}>בחירה מאנשי קשר</Text>
                  {selectedKey ? (
                    <Text style={s.selectedLabel}>נבחר</Text>
                  ) : (
                    <View style={{ width: 42 }} />
                  )}
                </View>

                {/* Search */}
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="חיפוש לפי שם או מספר..."
                  placeholderTextColor="#9ca3af"
                  textAlign="right"
                  accessible={true}
                  accessibilityLabel="חיפוש"
                />

                {/* Contact list */}
                <FlatList
                  data={filteredContacts}
                  keyExtractor={(c, i) => contactKey(c) || `c-${i}`}
                  style={s.contactList}
                  contentContainerStyle={{ paddingBottom: 4 }}
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled
                  nestedScrollEnabled
                  renderItem={({ item }) => {
                    const key = contactKey(item);
                    const isSelected = selectedKey === key;
                    const phone = getPrimaryPhone(item);
                    const displayName = item.name?.trim() || phone;
                    return (
                      <Pressable
                        style={[
                          s.contactRow,
                          isSelected && s.contactRowSelected,
                        ]}
                        onPress={() =>
                          setSelectedKey((prev) =>
                            prev === key ? null : key
                          )
                        }
                        accessible={true}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={displayName}
                      >
                        {/* Name + phone — RTL right side */}
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
                        {/* Radio indicator — visual left (logical end in RTL) */}
                        <View
                          style={[
                            s.contactCheck,
                            isSelected && s.contactCheckSelected,
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#fff"
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

                {/* FIXED: added sticky confirm CTA for single-select contact picker */}
                {/* Hidden when no contact is selected; appears as soon as one is chosen */}
                {selectedKey && (
                  <Pressable
                    style={s.confirmCta}
                    onPress={confirmSelection}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="הוספת איש קשר"
                  >
                    <Text style={s.confirmCtaText}>הוספת איש קשר</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  sheetContacts: {
    // FIXED: contact list is now scrollable within bottom sheet
    // Use a concrete height (not maxHeight) so flex:1 children can measure themselves.
    // position:absolute ignores flex:1 from the parent — height must be explicit.
    height: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 20,
  },
  // ── Main view ────────────────────────────────────────────────────────────
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f6f7f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  optionSub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  // ── Contacts view ─────────────────────────────────────────────────────────
  contactsContainer: {
    flex: 1,
  },
  contactsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  contactsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
    minWidth: 42,
    textAlign: 'right',
  },
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
    textAlign: 'right',
  },
  contactList: {
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
  contactCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCheckSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  ctaBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContacts: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  // ── No-mobile empty/help state ────────────────────────────────────────────
  noMobileBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noMobileText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 22,
  },
  noMobileSubText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  noMobileBackBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  noMobileBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  phonePickerHelper: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 12,
  },
  // FIXED: added sticky confirm CTA for single-select contact picker
  confirmCta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
