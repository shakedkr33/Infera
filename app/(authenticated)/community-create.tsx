import { api } from '@/convex/_generated/api';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';

const AVAILABLE_TAGS = ['גן', 'בית ספר', 'חוג', 'משפחה', 'שכונה', 'עבודה', 'אישי'] as const;
type Tag = (typeof AVAILABLE_TAGS)[number];

// ─── Success Sheet ────────────────────────────────────────────────────────────

interface SuccessSheetProps {
  visible: boolean;
  name: string;
  inviteCode: string;
  onDone: () => void;
}

function SuccessSheet({ visible, name, inviteCode, onDone }: SuccessSheetProps) {
  const inviteUrl = `https://inyomi.app/join/${inviteCode}`;
  // TODO: לחבר ל-Universal Links כשהאפליקציה בפרודקשן

  const handleShare = async () => {
    await Share.share({
      message: `הצטרפו לקהילה "${name}" באפליקציית InYomi: ${inviteUrl}`,
    });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    Alert.alert('הועתק!', 'הקישור הועתק ללוח');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={successStyles.overlay}>
        <View style={successStyles.sheet}>
          <View style={successStyles.handle} />

          <Text style={successStyles.emoji}>🎉</Text>
          <Text style={successStyles.title}>הקהילה נוצרה!</Text>
          <Text style={successStyles.subtitle}>
            שתפו את הקישור עם חברים ומכרים
          </Text>

          {/* inviteCode משמש פנימית בלבד – לא מוצג למשתמש */}

          <Pressable
            style={[successStyles.btn, { backgroundColor: PRIMARY }]}
            onPress={handleShare}
            accessible
            accessibilityRole="button"
            accessibilityLabel="שיתוף קישור הזמנה"
          >
            <MaterialIcons name="share" size={20} color="#fff" />
            <Text style={successStyles.btnText}>שיתוף קישור</Text>
          </Pressable>

          <Pressable
            style={[successStyles.btn, successStyles.btnOutline]}
            onPress={handleCopy}
            accessible
            accessibilityRole="button"
            accessibilityLabel="העתקת קישור הזמנה"
          >
            <MaterialIcons name="content-copy" size={20} color={PRIMARY} />
            <Text style={[successStyles.btnText, { color: PRIMARY }]}>
              העתקת קישור
            </Text>
          </Pressable>

          <Pressable
            style={successStyles.doneBtn}
            onPress={onDone}
            accessible
            accessibilityRole="button"
            accessibilityLabel="המשך"
          >
            <Text style={successStyles.doneBtnText}>המשך</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateCommunityScreen() {
  const router = useRouter();
  const createCommunity = useMutation(api.communities.createCommunity);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);

  const [successData, setSuccessData] = useState<{
    name: string;
    inviteCode: string;
  } | null>(null);

  const nameRef = useRef<TextInput>(null);

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('שם הקהילה הוא שדה חובה');
      nameRef.current?.focus();
      return;
    }
    setNameError('');
    Keyboard.dismiss();
    setLoading(true);

    try {
      const community = await createCommunity({
        name: trimmed,
        description: description.trim() || undefined,
        tags: selectedTags.length > 0 ? [...selectedTags] : undefined,
      });

      if (!community) throw new Error('שגיאה ביצירת הקהילה');

      setSuccessData({ name: community.name, inviteCode: community.inviteCode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה ביצירת הקהילה';
      Alert.alert('שגיאה', msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name.trim().length > 0 && !loading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="סגור"
        >
          <MaterialIcons name="close" size={24} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>יצירת קהילה חדשה</Text>
        {/* spacer to balance close button */}
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* שם הקהילה */}
        <View style={styles.field}>
          <Text style={styles.label}>שם הקהילה</Text>
          <TextInput
            ref={nameRef}
            style={[styles.input, !!nameError && styles.inputError]}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError('');
            }}
            placeholder="שם הקהילה (למשל: גן שקד)"
            placeholderTextColor="#9ca3af"
            maxLength={40}
            textAlign="right"
            writingDirection="rtl"
            returnKeyType="next"
            onSubmitEditing={() => {}}
            accessible
            accessibilityLabel="שם הקהילה"
          />
          {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
          <Text style={styles.charCount}>{name.length}/40</Text>
        </View>

        {/* תיאור */}
        <View style={styles.field}>
          <Text style={styles.label}>תיאור (לא חובה)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="כמה מילים על הקהילה (לא חובה)"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlign="right"
            writingDirection="rtl"
            textAlignVertical="top"
            accessible
            accessibilityLabel="תיאור הקהילה"
          />
        </View>

        {/* תגיות */}
        <View style={styles.field}>
          <Text style={styles.label}>תגיות</Text>
          <View style={styles.chipsRow}>
            {AVAILABLE_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleTag(tag)}
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityLabel={tag}
                  accessibilityState={{ checked: selected }}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* כפתור יצירה */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
          accessible
          accessibilityRole="button"
          accessibilityLabel="צור קהילה"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>צור קהילה</Text>
          )}
        </Pressable>
      </View>

      {/* Success modal */}
      {successData && (
        <SuccessSheet
          visible
          name={successData.name}
          inviteCode={successData.inviteCode}
          onDone={() => {
            setSuccessData(null);
            router.replace('/(authenticated)/communities');
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'right',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'left',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  chipSelected: {
    backgroundColor: PRIMARY,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  createBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: {
    backgroundColor: '#93c5fd',
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

const successStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginVertical: 4,
  },
  codeLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
  },
  btnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  doneBtn: {
    marginTop: 4,
    paddingVertical: 8,
  },
  doneBtnText: {
    fontSize: 15,
    color: '#9ca3af',
  },
});
