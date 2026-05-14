import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { AttachmentSourceSheet } from '@/lib/components/attachments/AttachmentSourceSheet';
import type { EventAttachmentDraft } from '@/lib/types/event';
import type { SubTask, SubTaskAttachment } from '@/lib/types/task';

const PRIMARY = '#36a9e2';

interface SubtasksSectionProps {
  subtasks: SubTask[];
  allowEditing: boolean;
  onSubtasksChange: (st: SubTask[]) => void;
  onAllowEditingChange: (v: boolean) => void;
}

function createSubtaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function attachmentTypeFromMime(mimeType: string): 'image' | 'file' {
  return mimeType.startsWith('image/') ? 'image' : 'file';
}

function draftToSubtaskAttachment(
  draft: EventAttachmentDraft
): SubTaskAttachment {
  return {
    id: createAttachmentId(),
    type: attachmentTypeFromMime(draft.mimeType),
    storageId: draft.storageId,
    originalName: draft.originalName,
    displayName: draft.displayName,
    mimeType: draft.mimeType,
    sizeBytes: draft.sizeBytes,
    localUri: draft.localUri,
  };
}

function SubtaskAttachmentPreview({
  attachment,
  onImageThumbnailPress,
}: {
  attachment: SubTaskAttachment | undefined;
  onImageThumbnailPress?: (uri: string) => void;
}): React.JSX.Element | null {
  const storageId = attachment?.storageId as Id<'_storage'> | undefined;
  const urlFromStorage = useQuery(
    api.events.getAttachmentUrl,
    storageId ? { storageId } : 'skip'
  );
  const uri = attachment?.localUri ?? urlFromStorage ?? null;
  const isImage = (attachment?.mimeType ?? '').startsWith('image/');

  if (!attachment?.storageId && !attachment?.localUri) {
    return null;
  }

  if (isImage) {
    if (!uri) {
      return (
        <View style={s.thumbWrap} accessible accessibilityLabel="טוען תמונה">
          <ActivityIndicator color={PRIMARY} size="small" />
        </View>
      );
    }
    return (
      <Pressable
        onPress={() => onImageThumbnailPress?.(uri)}
        style={s.thumbPressable}
        hitSlop={8}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="תצוגה מקדימה של תמונה"
        accessibilityHint="פתיחה בתצוגה גדולה"
      >
        <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
      </Pressable>
    );
  }

  return (
    <View
      style={s.fileChip}
      accessible
      accessibilityLabel={`קובץ: ${attachment.displayName}`}
    >
      <MaterialIcons name="insert-drive-file" size={18} color={PRIMARY} />
      <Text style={s.fileChipText} numberOfLines={1}>
        {attachment.displayName || attachment.originalName}
      </Text>
    </View>
  );
}

export function SubtasksSection({
  subtasks,
  allowEditing,
  onSubtasksChange,
  onAllowEditingChange,
}: SubtasksSectionProps): React.JSX.Element {
  const [draftTitle, setDraftTitle] = useState('');
  const [focusDraftTick, setFocusDraftTick] = useState(0);
  const draftInputRef = useRef<TextInput>(null);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const pickSubtaskIdRef = useRef<string | null>(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const previewMaxW = windowWidth * 0.9;
  const previewMaxH = windowHeight * 0.78;

  useEffect(() => {
    if (focusDraftTick > 0) {
      const timeout = setTimeout(() => {
        draftInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [focusDraftTick]);

  const commitDraft = (): void => {
    const title = draftTitle.trim();
    if (!title) {
      draftInputRef.current?.focus();
      return;
    }
    onSubtasksChange([
      ...subtasks,
      { id: createSubtaskId(), title, completed: false },
    ]);
    setDraftTitle('');
    setFocusDraftTick((tick) => tick + 1);
  };

  const updateSubtask = (id: string, title: string): void => {
    onSubtasksChange(
      subtasks.map((st) => (st.id === id ? { ...st, title } : st))
    );
  };

  const toggleSubtask = (id: string): void => {
    onSubtasksChange(
      subtasks.map((st) =>
        st.id === id ? { ...st, completed: !st.completed } : st
      )
    );
  };

  const removeSubtask = (id: string): void => {
    onSubtasksChange(subtasks.filter((st) => st.id !== id));
  };

  const requestRemoveSubtask = (subtask: SubTask): void => {
    const hasContent =
      subtask.title.trim().length > 0 ||
      subtask.attachment !== undefined ||
      subtask.completed;
    if (!hasContent) {
      removeSubtask(subtask.id);
      return;
    }

    Alert.alert('למחוק את תת-המשימה?', '', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: () => removeSubtask(subtask.id),
      },
    ]);
  };

  const setSubtaskAttachment = (
    id: string,
    attachment: SubTaskAttachment | undefined
  ): void => {
    onSubtasksChange(
      subtasks.map((st) => (st.id === id ? { ...st, attachment } : st))
    );
  };

  const openAttachmentPickerFor = (subtaskId: string): void => {
    pickSubtaskIdRef.current = subtaskId;
    setSourceSheetOpen(true);
  };

  const closePickSheet = (): void => {
    pickSubtaskIdRef.current = null;
    setSourceSheetOpen(false);
  };

  const onAttachmentPicked = (draft: EventAttachmentDraft): void => {
    const sid = pickSubtaskIdRef.current;
    if (!sid) return;
    setSubtaskAttachment(sid, draftToSubtaskAttachment(draft));
    pickSubtaskIdRef.current = null;
  };

  const onAttachButtonPress = (st: SubTask): void => {
    if (st.attachment?.localUri || st.attachment?.storageId) {
      Alert.alert('קובץ מצורף', '', [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'החלף קובץ',
          onPress: () => openAttachmentPickerFor(st.id),
        },
        {
          text: 'הסר קובץ',
          style: 'destructive',
          onPress: () => setSubtaskAttachment(st.id, undefined),
        },
      ]);
      return;
    }
    openAttachmentPickerFor(st.id);
  };

  return (
    <View>
      <AttachmentSourceSheet
        visible={sourceSheetOpen}
        onClose={closePickSheet}
        onPicked={(draft) => {
          onAttachmentPicked(draft);
        }}
      />

      <Modal
        visible={imagePreviewUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewUri(null)}
      >
        <View style={s.previewOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImagePreviewUri(null)}
            accessible={false}
          />
          {imagePreviewUri ? (
            <View
              style={[s.previewCard, { width: previewMaxW, zIndex: 1 }]}
              accessibilityViewIsModal
              pointerEvents="box-none"
            >
              <View style={s.previewTopBar}>
                <Pressable
                  style={s.previewCloseBtn}
                  onPress={() => setImagePreviewUri(null)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="סגור"
                  hitSlop={12}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
              <View
                style={[
                  s.previewImageFrame,
                  {
                    width: previewMaxW,
                    height: previewMaxH,
                  },
                ]}
              >
                <Image
                  source={{ uri: imagePreviewUri }}
                  style={s.previewImage}
                  resizeMode="contain"
                  accessible={true}
                  accessibilityLabel="תצוגה מקדימה של תמונה"
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <View style={s.header}>
        <Pressable
          style={s.addBtn}
          onPress={() => {
            setFocusDraftTick((tick) => tick + 1);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="הוסף תת־משימה"
        >
          <MaterialIcons name="add-circle" size={20} color={PRIMARY} />
          <Text style={s.addBtnText}>+ הוסף תת־משימה</Text>
        </Pressable>
        <Text style={s.title}>תתי־משימות</Text>
      </View>

      <View style={s.toggleRow}>
        <Switch
          value={allowEditing}
          onValueChange={onAllowEditingChange}
          trackColor={{ true: PRIMARY, false: '#e2e8f0' }}
          thumbColor="#fff"
          accessible={true}
          accessibilityLabel="משתתפים יכולים לערוך"
        />
        <View style={s.toggleTextBlock}>
          <Text style={s.toggleLabel}>משתתפים יכולים לערוך</Text>
          <Text style={s.helperText}>
            מתאים לרשימות קניות או משימות משותפות
          </Text>
        </View>
      </View>

      <View style={s.list}>
        {subtasks.map((st, idx) => (
          <View key={st.id}>
            <View style={s.subtaskRow}>
              <Pressable
                onPress={() => toggleSubtask(st.id)}
                style={[s.checkbox, st.completed && s.checkboxChecked]}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: st.completed }}
                accessibilityLabel={st.title || 'תת־משימה חדשה'}
              >
                {st.completed ? (
                  <MaterialIcons name="check" size={14} color="#fff" />
                ) : null}
              </Pressable>
              <TextInput
                style={[
                  s.subtaskInput,
                  st.completed && s.subtaskInputCompleted,
                ]}
                value={st.title}
                onChangeText={(text) => updateSubtask(st.id, text)}
                placeholder={
                  idx === 0 ? 'למשל: לקנות חלב...' : 'הוספת תת־משימה נוספת...'
                }
                placeholderTextColor="#9ca3af"
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={() => setFocusDraftTick((tick) => tick + 1)}
                accessible={true}
                accessibilityLabel={st.title || 'תת־משימה'}
              />
              <SubtaskAttachmentPreview
                attachment={st.attachment}
                onImageThumbnailPress={(uri) => setImagePreviewUri(uri)}
              />
              <Pressable
                onPress={() => onAttachButtonPress(st)}
                style={s.imageBtn}
                hitSlop={10}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={
                  st.attachment?.localUri || st.attachment?.storageId
                    ? 'הסר או החלף קובץ'
                    : 'הוסף קובץ או תמונה'
                }
              >
                <MaterialIcons name="attach-file" size={22} color={PRIMARY} />
              </Pressable>
              <Pressable
                onPress={() => requestRemoveSubtask(st)}
                style={s.removeBtn}
                hitSlop={10}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="מחיקת תת־משימה"
              >
                <MaterialIcons name="close" size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <View style={s.divider} />
          </View>
        ))}

        <View style={s.subtaskRow}>
          <Pressable
            style={s.emptyCheckbox}
            onPress={commitDraft}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="הוסף תת־משימה"
          >
            <MaterialIcons name="add" size={16} color={PRIMARY} />
          </Pressable>
          <TextInput
            ref={draftInputRef}
            style={s.subtaskInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="הוסיפי תת־משימה..."
            placeholderTextColor="#9ca3af"
            textAlign="right"
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={commitDraft}
            accessible={true}
            accessibilityLabel="הוסיפי תת־משימה"
          />
          <View style={s.imageBtnPlaceholder} />
          <View style={s.removeBtnPlaceholder} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#111827' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleTextBlock: {
    flex: 1,
    marginRight: 8,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
  },
  helperText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 2,
  },
  list: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 14,
  },
  subtaskRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  emptyCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: '#e8f5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  thumbPressable: {
    borderRadius: 8,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  fileChip: {
    maxWidth: 72,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#e8f5fd',
    borderRadius: 8,
  },
  fileChipText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  imageBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBtnPlaceholder: { width: 40 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  removeBtnPlaceholder: { width: 32 },
  subtaskInput: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    textAlign: 'right',
    minHeight: 38,
  },
  subtaskInputCompleted: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTopBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  previewImageFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
