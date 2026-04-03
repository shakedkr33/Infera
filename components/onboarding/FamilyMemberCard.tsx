import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors, shadows } from '../../constants/theme';
import type { FamilyMember } from '../../contexts/OnboardingContext';
import { ColorPicker, TakenColor } from './ColorPicker';

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: implemented exact status derivation per product spec
// ─────────────────────────────────────────────────────────────────────────────

type FamilyMemberStatus = 'מחובר' | 'שלח שוב' | 'שלח הזמנה' | 'פרופיל פנימי';

// FIXED: removed duplicate "שלח הזמנה" chip — now non-interactive badge only
// "שלח הזמנה" chip uses indigo/violet so it is visually distinct from the primary
// action button (which stays #36a9e2 blue). All chips are plain <View> — non-tappable.
const STATUS_STYLES: Record<FamilyMemberStatus, { bg: string; text: string }> = {
  'מחובר':         { bg: '#dcfce7', text: '#16a34a' },
  'שלח הזמנה':    { bg: '#ede9fe', text: '#7c3aed' },
  'שלח שוב':      { bg: '#fff7ed', text: '#ea580c' },
  'פרופיל פנימי': { bg: '#f1f5f9', text: '#6b7280' },
};

// FIXED: implemented exact status derivation per product spec
// Backward compat: existing members without sourceType/selectedPhoneNumber are
// inferred from presence of phone/contactId so they don't incorrectly show
// as 'פרופיל פנימי' when they were contact-sourced.
function deriveFamilyMemberStatus(member: FamilyMember): FamilyMemberStatus {
  const effectiveSourceType =
    member.sourceType ?? (member.phone || member.contactId ? 'contact' : 'manual');
  const effectiveSelectedPhone =
    member.selectedPhoneNumber ?? (effectiveSourceType === 'contact' ? member.phone : undefined);

  if (member.matchedUserId) return 'מחובר';
  if (effectiveSourceType === 'contact' && member.inviteStatus === 'invited') return 'שלח שוב';
  if (effectiveSourceType === 'contact' && effectiveSelectedPhone) return 'שלח הזמנה';
  return 'פרופיל פנימי';
}

interface DisplayCardProps {
  member: FamilyMember;
  onEdit: () => void;
  onRemove: () => void;
}

export function FamilyMemberDisplayCard({
  member,
  onEdit,
  onRemove,
}: DisplayCardProps) {
  const initials = member.name.trim().substring(0, 2);
  const isPet = member.type === 'pet';

  return (
    <Pressable
      onPress={onEdit}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`ערוך את ${member.name}`}
      className="bg-white p-4 rounded-2xl flex-row items-center justify-between mb-3"
      style={shadows.soft}
    >
      {/* Remove button — left side (RTL end) */}
      <Pressable
        onPress={onRemove}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`הסר את ${member.name}`}
        className="p-2"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name="close" size={20} color="#9ca3af" />
      </Pressable>

      {/* Name + avatar — right side (RTL start) */}
      <View className="flex-row items-center gap-3">
        <Text className="font-bold text-[15px] text-gray-900">
          {member.name}
        </Text>
        <View
          style={{ backgroundColor: member.color }}
          className="w-10 h-10 rounded-full items-center justify-center"
        >
          {isPet ? (
            <MaterialIcons name="pets" size={18} color="white" />
          ) : (
            <Text className="text-xs font-bold opacity-80">{initials}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface EditCardProps {
  name: string;
  color: string;
  onChangeName: (text: string) => void;
  onChangeColor: (color: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  label?: string;
  // FIXED: taken colors now show owner initials and are non-tappable
  /** Colors already taken by other family members — shown with initials, non-tappable */
  takenColors?: TakenColor[];
  /** Color palette to display; defaults to people palette inside ColorPicker */
  palette?: readonly string[];
}

export function FamilyMemberEditCard({
  name,
  color,
  onChangeName,
  onChangeColor,
  onConfirm,
  onCancel,
  label,
  takenColors,
  palette,
}: EditCardProps) {
  const canSave = name.trim().length > 0;

  return (
    <View
      className="bg-white border-2 p-4 rounded-2xl mb-3"
      style={[shadows.soft, { borderColor: colors.primary }]}
    >
      {/* Header row: label right, cancel X left */}
      <View className="flex-row-reverse items-center justify-between mb-3">
        {label ? (
          <Text className="text-xs font-semibold text-gray-500">{label}</Text>
        ) : (
          <View />
        )}
        <Pressable
          onPress={onCancel}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="ביטול"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="p-1"
        >
          <MaterialIcons name="close" size={20} color="#9ca3af" />
        </Pressable>
      </View>

      {/* Name input — single field, no split */}
      <View
        className="bg-[#f6f7f8] rounded-xl overflow-hidden mb-4"
        style={{ minHeight: 52 }}
      >
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder="שם..."
          placeholderTextColor="#9ca3af"
          className="flex-1 px-4 text-base font-bold text-[#111517]"
          style={{ textAlign: 'right', height: 52 }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={canSave ? onConfirm : undefined}
        />
      </View>

      <ColorPicker
        selectedColor={color}
        onSelectColor={onChangeColor}
        takenColors={takenColors}
        palette={palette}
        size={38}
      />

      {/* Save button — blue, full width, disabled while name is empty */}
      <Pressable
        onPress={onConfirm}
        disabled={!canSave}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="שמירה"
        accessibilityState={{ disabled: !canSave }}
        className="mt-4 h-12 rounded-xl items-center justify-center"
        style={{ backgroundColor: canSave ? colors.primary : '#e5e7eb' }}
      >
        <Text
          className="font-bold text-base"
          style={{ color: canSave ? '#ffffff' : '#9ca3af' }}
        >
          שמירה
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: implemented family-member card UI with status chips and masked phone
// FIXED: wired correct actions per family-member status
// Used exclusively in family-profile.tsx (settings screen).
// FamilyMemberDisplayCard is kept unchanged for onboarding-step4.tsx.
// ─────────────────────────────────────────────────────────────────────────────

interface ManagementCardProps {
  member: FamilyMember;
  onEdit: () => void;
  onRemove: () => void;
  onSendInvite: () => void;
  onConvertToContact: () => void;
}

export function FamilyMemberManagementCard({
  member,
  onEdit,
  onRemove,
  onSendInvite,
  onConvertToContact,
}: ManagementCardProps) {
  console.log('[DEBUG] rendering member:', member.id, member.name);
  const initials = member.name.trim().substring(0, 2);
  const isPet = member.type === 'pet';
  const status = deriveFamilyMemberStatus(member);

  // Secondary identifying line
  // FIXED: updated manual member secondary label
  const effectiveSourceType =
    member.sourceType ?? (member.phone || member.contactId ? 'contact' : 'manual');
  const secondaryLabel =
    effectiveSourceType === 'contact' && (member.maskedPhone ?? member.phone)
      ? (member.maskedPhone ?? member.phone)
      : 'ללא אפשרות להתחבר לאפליקציה';

  return (
    <View className="bg-white rounded-2xl p-4 mb-3" style={shadows.soft}>
      {/* Top area: [chip — non-tappable badge] | [name+secondary — tappable] | [avatar] */}
      {/* FIXED: removed duplicate chip for all statuses ("שלח שוב", "שלח הזמנה", etc.) */}
      {/* Chip is a plain <View> — never inside a Pressable — pure visual badge only */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
        {/* Avatar — rightmost in RTL */}
        <View
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: member.color }}
        >
          {isPet ? (
            <MaterialIcons name="pets" size={19} color="white" />
          ) : (
            <Text className="text-xs font-bold text-white opacity-90">
              {initials}
            </Text>
          )}
        </View>

        {/* Name + secondary label — tappable to edit, fills remaining space */}
        <Pressable
          onPress={onEdit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`ערוך את ${member.name}`}
          style={{ flex: 1 }}
        >
          <Text
            className="font-bold text-[15px] text-gray-900 text-right"
            numberOfLines={1}
          >
            {member.name}
          </Text>
          <Text
            className="text-xs text-gray-400 mt-0.5 text-right"
            numberOfLines={1}
          >
            {secondaryLabel}
          </Text>
        </Pressable>

        {/* FIXED: "שלח הזמנה" chip removed from top area — status shown only via action button below */}
      </View>

      {/* ── Actions row ─────────────────────────────────────────────────────── */}
      {/* FIXED: wired correct actions per family-member status */}
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          gap: 8,
        }}
      >
        {/* Primary action — rightmost in RTL */}
        {(status === 'שלח הזמנה' || status === 'שלח שוב') && (
          <Pressable
            onPress={onSendInvite}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={status}
            style={{
              flex: 1,
              backgroundColor: '#e8f5fd',
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#36a9e2' }}>
              {status}
            </Text>
          </Pressable>
        )}
        {status === 'פרופיל פנימי' && (
          <Pressable
            onPress={onConvertToContact}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="הפוך לאיש קשר"
            style={{
              flex: 1,
              backgroundColor: '#f1f5f9',
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
              הפוך לאיש קשר
            </Text>
          </Pressable>
        )}
        {/* Spacer for "מחובר" (no primary action) */}
        {status === 'מחובר' && <View style={{ flex: 1 }} />}

        {/* Edit — icon button */}
        <Pressable
          onPress={onEdit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="עריכה"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#f6f7f8',
          }}
        >
          <MaterialIcons name="edit" size={16} color="#6b7280" />
        </Pressable>

        {/* Delete — icon button (confirmation handled by caller) */}
        <Pressable
          onPress={onRemove}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="מחיקה"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#fff0f0',
          }}
        >
          <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}
