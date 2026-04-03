import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddPersonBottomSheet } from '../../components/onboarding/AddPersonBottomSheet';
import {
  ColorPicker,
  PET_COLORS,
  PROFILE_COLORS,
} from '../../components/onboarding/ColorPicker';
import {
  FamilyMemberDisplayCard,
  FamilyMemberEditCard,
  FamilyMemberManagementCard,
} from '../../components/onboarding/FamilyMemberCard';
import { colors, shadows } from '../../constants/theme';
import type { FamilyMember } from '../../contexts/OnboardingContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
// FIXED: verified family member status reactivity after matchedUserId update
import {
  MAX_PEOPLE,
  MAX_PETS,
  useFamilyProfileEditor,
} from '../../hooks/useFamilyProfileEditor';

// FIXED: share-sheet invitation implemented for "שלח הזמנה" and "שלח שוב"
const INVITE_LINK = 'https://inyomi.app/join';

export default function FamilyProfileScreen() {
  const router = useRouter();
  const { data, hydrateFromServer } = useOnboarding();

  // FIXED: removed isPersonalOnly flag — screen is unified for all space types
  const screenTitle = 'ניהול פרופיל';

  // Initialise from previously saved context data (unlike onboarding which starts empty)
  const editor = useFamilyProfileEditor(data.familyData?.familyMembers ?? []);

  // FIXED: verified family member status reactivity after matchedUserId update
  // Subscribe to the server profile so that when the Convex backend sets matchedUserId
  // (after an invited user registers), this screen re-renders to show "מחובר" without
  // requiring a manual app restart.
  const serverProfile = useQuery(api.users.getMyProfile);
  useEffect(() => {
    if (!serverProfile?.familyContacts || !Array.isArray(serverProfile.familyContacts)) return;
    const serverMembers = serverProfile.familyContacts as FamilyMember[];
    const localMembers = data.familyData?.familyMembers ?? [];
    // Only re-hydrate when a matchedUserId was gained server-side that local context lacks
    const hasNewMatch = serverMembers.some((sm) => {
      const local = localMembers.find((lm) => lm.id === sm.id);
      return local !== undefined && !local.matchedUserId && sm.matchedUserId;
    });
    if (hasNewMatch) {
      hydrateFromServer({ familyContacts: serverMembers });
    }
  }, [serverProfile, data.familyData?.familyMembers, hydrateFromServer]);
  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    nickname,
    setNickname,
    personalColor,
    setPersonalColor,
    familyMembers,
    pendingMember,
    setPendingMember,
    editingId,
    isBottomSheetOpen,
    setIsBottomSheetOpen,
    personalSaved,
    personMembers,
    petMembers,
    canAddPerson,
    canAddPet,
    isAddingNewPerson,
    isAddingNewPet,
    getTakenColorsForPerson,
    getTakenColorsForPet,
    openAddPersonSheet,
    handleAddPet,
    startManualAddPerson,
    confirmPendingMember,
    cancelPending,
    startEditMember,
    removeMember,
    handleSavePersonalName,
    handleContactSelected,
    saveProfile,
    // FIXED: wired correct actions per family-member status
    convertingToContactId,
    markMemberInvited,
    startConvertToContact,
    handleContactForConversion,
    cancelConversion,
  } = editor;

  // FIXED: profile form now collapses to saved display card after save
  // FIXED: profile card now opens collapsed if user already has saved data
  const [profileSaved, setProfileSaved] = useState(
    () => firstName.trim().length > 0
  );

  // FIXED: "הוספה מאנשי קשר" now opens contact picker directly, skipping intermediate sheet
  const [openSheetToContacts, setOpenSheetToContacts] = useState(false);

  // FIXED: delete confirmation dialog text aligned right (RTL)
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null);

  const handleFirstNameChange = (v: string) => { setFirstName(v); setProfileSaved(false); };
  const handleLastNameChange = (v: string) => { setLastName(v); setProfileSaved(false); };
  const handleNicknameChange = (v: string) => { setNickname(v); setProfileSaved(false); };

  const handleSaveProfile = () => {
    handleSavePersonalName();
    setProfileSaved(true);
  };

  // FIXED: displayName shows "firstName lastName (nickname)" format
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const displayName = fullName
    ? nickname.trim()
      ? `${fullName} (${nickname.trim()})`
      : fullName
    : 'הפרופיל שלך';

  const handleSaveAndClose = () => {
    // FIXED: family profile persistence — saveProfile() patches existing user, no new space created
    saveProfile();
    router.back();
  };

  // FIXED: share-sheet invitation implemented for "שלח הזמנה" and "שלח שוב"
  const handleSendInvite = async (member: FamilyMember) => {
    const message = `היי, הזמנתי אותך להצטרף ל-InYomi כדי לצפות באירועים ובמשימות שאני משתפת איתך. אפשר להצטרף דרך הקישור: ${INVITE_LINK}`;
    try {
      const result = await Share.share({ message });
      // Mark as invited on any sharing action (dismissed = user closed without sharing)
      if (result.action !== Share.dismissedAction) {
        markMemberInvited(member.id);
      }
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לשתף כרגע.');
    }
  };

  // FIXED: delete confirmation dialog text aligned right (RTL) — uses custom modal
  const handleDeleteMember = (member: FamilyMember) => {
    setDeleteTarget(member);
  };

  // ── Shared edit card renderer ─────────────────────────────────────────────

  const renderEditCard = (member: FamilyMember) => {
    if (editingId !== member.id || !pendingMember) return null;
    const isPet = member.type === 'pet';
    return (
      <FamilyMemberEditCard
        key={`edit-${member.id}`}
        name={pendingMember.name}
        color={pendingMember.color}
        palette={isPet ? PET_COLORS : PROFILE_COLORS}
        takenColors={
          isPet
            ? getTakenColorsForPet(member.id)
            : getTakenColorsForPerson(member.id)
        }
        onChangeName={(t) => setPendingMember((p) => p && { ...p, name: t })}
        onChangeColor={(c) => setPendingMember((p) => p && { ...p, color: c })}
        onConfirm={confirmPendingMember}
        onCancel={cancelPending}
        label="עריכה:"
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Top bar */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          <Pressable
            onPress={() => router.back()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            className="p-2"
          >
            <MaterialIcons
              name="arrow-forward"
              size={24}
              color={colors.slate}
            />
          </Pressable>
          <Text
            className="text-base font-bold text-right"
            style={{ color: colors.slate }}
          >
            {screenTitle}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Owner card ────────────────────────────────────────────────── */}
          {/* FIXED: replaced ownerFullName with split fields, removed fake camera affordance */}
          {/* FIXED: profile form now collapses to saved display card after save */}
          <Text className="text-xs font-bold text-gray-400 text-right mb-2 pr-1">
            השם שלך
          </Text>

          {profileSaved ? (
            <Pressable
              onPress={() => setProfileSaved(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`ערוך פרופיל — ${displayName}`}
              className="bg-white p-4 rounded-2xl flex-row items-center justify-between mb-6"
              style={shadows.soft}
            >
              <View className="p-2">
                <MaterialIcons name="edit" size={18} color="#9ca3af" />
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="font-bold text-[15px] text-gray-900">
                  {displayName}
                </Text>
                <View
                  style={{ backgroundColor: personalColor }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <Text className="text-xs font-bold text-white opacity-80">
                    {displayName.substring(0, 2)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View className="bg-white rounded-3xl p-5 mb-6" style={shadows.soft}>
              <View className="flex-row-reverse items-center gap-4 mb-4">
                <View
                  className="w-14 h-14 rounded-full items-center justify-center"
                  style={{ backgroundColor: personalColor }}
                >
                  <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>
                    {(firstName || '?').charAt(0)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-400 text-right mb-1">
                    שם פרטי ושם משפחה
                  </Text>
                  <View className="flex-row-reverse gap-2 mb-2">
                    <TextInput
                      value={firstName}
                      onChangeText={handleFirstNameChange}
                      placeholder="שם פרטי"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 bg-[#f6f7f8] rounded-xl px-3 text-right text-base"
                      style={{ height: 44 }}
                      returnKeyType="next"
                      accessible={true}
                      accessibilityLabel="שם פרטי"
                    />
                    <TextInput
                      value={lastName}
                      onChangeText={handleLastNameChange}
                      placeholder="שם משפחה"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 bg-[#f6f7f8] rounded-xl px-3 text-right text-base"
                      style={{ height: 44 }}
                      returnKeyType="next"
                      accessible={true}
                      accessibilityLabel="שם משפחה"
                    />
                  </View>
                  <TextInput
                    value={nickname}
                    onChangeText={handleNicknameChange}
                    placeholder="כינוי (אופציונלי)"
                    placeholderTextColor="#9ca3af"
                    className="bg-[#f6f7f8] rounded-xl px-3 text-right text-base mb-2"
                    style={{ height: 44 }}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveProfile}
                    accessible={true}
                    accessibilityLabel="כינוי"
                  />
                  {/* FIXED: replaced ✓ icon button with labeled "שמירת פרטים" button */}
                  <Pressable
                    onPress={handleSaveProfile}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="שמירת פרטים"
                    className="mt-1 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text className="text-white font-bold text-base">שמירת פרטים</Text>
                  </Pressable>
                  {personalSaved ? (
                    <Text
                      className="text-xs text-right mt-1"
                      style={{ color: colors.primary }}
                    >
                      נשמר ✓
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text className="text-xs text-gray-400 text-right mb-2">
                בחירת צבע אישי
              </Text>
              {/* FIXED: taken colors now pass { color, name } for initials overlay */}
              <ColorPicker
                selectedColor={personalColor}
                onSelectColor={setPersonalColor}
                takenColors={familyMembers.map((m) => ({ color: m.color, name: m.name }))}
                size={38}
              />
            </View>
          )}

          {/* ── Family members section ─────────────────────────────────────── */}
          {/* FIXED: implemented family-member card UI with status chips and masked phone */}
          <Text className="text-sm font-bold text-gray-700 text-right mb-1 pr-1">
            בני משפחה נוספים (עד {MAX_PEOPLE})
          </Text>

          {/* Explainer text */}
          <Text className="text-xs text-gray-400 text-right mb-4 pr-1 leading-relaxed">
            אפשר להוסיף בני משפחה דרך אנשי קשר כדי להזמין אותם בהמשך, או ליצור פרופיל פנימי לילדים ובני משפחה בלי סמארטפון לצורך שיוך וסינון.
          </Text>

          {/* Two add buttons */}
          {canAddPerson && (
            <View className="flex-row-reverse gap-2 mb-4">
              {/* FIXED: opens contact picker directly, skipping intermediate sheet */}
              <Pressable
                onPress={() => { setOpenSheetToContacts(true); openAddPersonSheet(); }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="הוספה מאנשי קשר"
                className="flex-1 flex-row-reverse items-center justify-center gap-2 py-3 rounded-xl border"
                style={{ borderColor: colors.primary, backgroundColor: '#e8f5fd' }}
              >
                <MaterialIcons name="contacts" size={16} color={colors.primary} />
                <Text className="font-semibold text-sm" style={{ color: colors.primary }}>
                  הוספה מאנשי קשר
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { cancelPending(); startManualAddPerson(); }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="הוספה ידנית"
                className="flex-1 flex-row-reverse items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 bg-white"
              >
                <MaterialIcons name="person-add" size={16} color="#6b7280" />
                <Text className="font-semibold text-sm text-gray-600">
                  הוספה ידנית
                </Text>
              </Pressable>
            </View>
          )}

          {/* Member list */}
          {personMembers.length === 0 && !isAddingNewPerson ? (
            <View className="items-center py-5 mb-5">
              <MaterialIcons name="group" size={36} color="#d1d5db" />
              <Text className="text-gray-400 text-center mt-2 text-sm">
                עדיין לא הוספת בני משפחה
              </Text>
            </View>
          ) : (
            <View className="mb-5">
              {/* FIXED: prevented duplicate card render for same family member */}
              {personMembers
                .filter((m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx)
                .map((member) =>
                editingId === member.id && pendingMember ? (
                  renderEditCard(member)
                ) : (
                  <FamilyMemberManagementCard
                    key={member.id}
                    member={member}
                    onEdit={() => startEditMember(member)}
                    onRemove={() => handleDeleteMember(member)}
                    onSendInvite={() => handleSendInvite(member)}
                    onConvertToContact={() => {
                      setOpenSheetToContacts(true);
                      startConvertToContact(member);
                    }}
                  />
                )
              )}
              {isAddingNewPerson && pendingMember && (
                <FamilyMemberEditCard
                  name={pendingMember.name}
                  color={pendingMember.color}
                  palette={PROFILE_COLORS}
                  takenColors={getTakenColorsForPerson()}
                  onChangeName={(t) =>
                    setPendingMember((p) => p && { ...p, name: t })
                  }
                  onChangeColor={(c) =>
                    setPendingMember((p) => p && { ...p, color: c })
                  }
                  onConfirm={confirmPendingMember}
                  onCancel={cancelPending}
                  label="הוספת בן משפחה:"
                />
              )}
            </View>
          )}

          {!canAddPerson && (
            <Text className="text-xs text-gray-300 text-center mb-5">
              הגעת למכסה של {MAX_PEOPLE} בני משפחה.
            </Text>
          )}

          {/* ── Pets section ───────────────────────────────────────────────── */}
          <Text className="text-sm font-bold text-gray-700 text-right mb-1 pr-1">
            חיות מחמד (עד {MAX_PETS})
          </Text>
          <Text className="text-xs text-gray-400 text-right mb-3 pr-1">
            {/* FIXED: updated pets section description text */}
            הוסיפו את חיית המחמד שלכם כדי לעקוב אחרי כל המשימות והאירועים שלה
          </Text>
          <View className="bg-white rounded-3xl p-5 mb-4" style={shadows.soft}>
            {petMembers.length === 0 && !isAddingNewPet ? (
              <View className="items-center py-3" style={styles.dashedBorder}>
                <MaterialIcons name="pets" size={38} color="#d1d5db" />
                <Text className="text-gray-400 font-semibold mt-2 mb-1 text-center">
                  עדיין לא הוספת חיות מחמד
                </Text>
                {canAddPet && (
                  <Pressable
                    onPress={handleAddPet}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="הוספת חיית מחמד"
                    className="flex-row-reverse items-center gap-2 mt-3 px-5 py-2.5 rounded-full border border-gray-300"
                  >
                    <MaterialIcons
                      name="pets"
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      style={{ color: colors.primary }}
                      className="font-semibold"
                    >
                      הוספת חיית מחמד
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                {petMembers.map((member) =>
                  editingId === member.id && pendingMember ? (
                    renderEditCard(member)
                  ) : (
                    <FamilyMemberDisplayCard
                      key={member.id}
                      member={member}
                      onEdit={() => startEditMember(member)}
                      onRemove={() => removeMember(member.id)}
                    />
                  )
                )}
                {isAddingNewPet && pendingMember && (
                  <FamilyMemberEditCard
                    name={pendingMember.name}
                    color={pendingMember.color}
                    palette={PET_COLORS}
                    takenColors={getTakenColorsForPet()}
                    onChangeName={(t) =>
                      setPendingMember((p) => p && { ...p, name: t })
                    }
                    onChangeColor={(c) =>
                      setPendingMember((p) => p && { ...p, color: c })
                    }
                    onConfirm={confirmPendingMember}
                    onCancel={cancelPending}
                    label="הוספת חיית מחמד:"
                  />
                )}
                {canAddPet ? (
                  <Pressable
                    onPress={handleAddPet}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="הוספת חיית מחמד נוספת"
                    className="flex-row-reverse items-center justify-center gap-2 py-3 border border-dashed border-gray-200 rounded-xl mt-1"
                  >
                    <MaterialIcons
                      name="pets"
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      style={{ color: colors.primary }}
                      className="font-semibold"
                    >
                      הוספת חיית מחמד
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="text-xs text-gray-300 text-center mt-2">
                    הגעת למכסה של {MAX_PETS} חיות מחמד.
                  </Text>
                )}
              </>
            )}
          </View>

          <Text className="text-xs text-gray-400 text-center px-4 mt-1">
            השינויים נשמרים כשתלחצ/י על "שמירה" למטה.
          </Text>
        </ScrollView>

        {/* Bottom save button */}
        <View
          className="px-5 pb-10 pt-4"
          style={{ backgroundColor: 'rgba(246,247,248,0.97)' }}
        >
          <Pressable
            onPress={handleSaveAndClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="שמירה וחזרה להגדרות"
            className="w-full h-16 rounded-2xl items-center justify-center"
            style={[{ backgroundColor: colors.primary }, shadows.primaryCta]}
          >
            <Text className="text-white font-bold text-lg">שמירה</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* FIXED: "הפוך לאיש קשר" updates existing record in place, preserves existing fields */}
      <AddPersonBottomSheet
        visible={isBottomSheetOpen}
        onClose={() => {
          setIsBottomSheetOpen(false);
          setOpenSheetToContacts(false);
          cancelConversion();
        }}
        onContactSelected={
          convertingToContactId ? handleContactForConversion : handleContactSelected
        }
        onManual={startManualAddPerson}
        openContactsDirectly={openSheetToContacts}
      />

      {/* FIXED: delete confirmation dialog text aligned right (RTL) */}
      <Modal
        visible={deleteTarget !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setDeleteTarget(null)}
          accessible={false}
        >
          <Pressable
            style={{ width: '82%', backgroundColor: 'white', borderRadius: 18, padding: 24 }}
            onPress={() => {}}
            accessible={false}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'right', marginBottom: 8 }}>
              מחיקת בן משפחה
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'right', lineHeight: 22, marginBottom: 24 }}>
              {`האם למחוק את ${deleteTarget?.name ?? ''} מהפרופיל המשפחתי?`}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              <Pressable
                onPress={() => {
                  if (deleteTarget) removeMember(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="מחיקה"
                style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#dc2626' }}>מחיקה</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="ביטול"
                style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>ביטול</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dashedBorder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
});
