import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  inferMimeType,
  stripExtension,
  validateAttachmentDraft,
} from '@/lib/attachmentDraftUtils';
import type { EventAttachmentDraft } from '@/lib/types/event';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

export interface AttachmentSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful pick and validation. */
  onPicked: (draft: EventAttachmentDraft) => void;
}

export function AttachmentSourceSheet({
  visible,
  onClose,
  onPicked,
}: AttachmentSourceSheetProps): React.JSX.Element {
  const finishPick = useCallback(
    (draft: EventAttachmentDraft): void => {
      const err = validateAttachmentDraft(draft);
      if (err) {
        Alert.alert(err.title, err.message);
        return;
      }
      const mimeType = draft.mimeType || inferMimeType(draft.originalName);
      onPicked({ ...draft, mimeType });
      onClose();
    },
    [onClose, onPicked]
  );

  const pickGallery = useCallback(async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('הרשאה נדרשת', 'נדרשת גישה לגלריה כדי לבחור תמונה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const filename = asset.fileName ?? asset.uri.split('/').pop() ?? 'image';
    const mimeType = asset.mimeType ?? inferMimeType(filename);
    const sizeBytes = asset.fileSize ?? 0;
    finishPick({
      originalName: filename,
      displayName: stripExtension(filename),
      mimeType,
      sizeBytes,
      localUri: asset.uri,
    });
  }, [finishPick]);

  const pickCamera = useCallback(async (): Promise<void> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('הרשאה נדרשת', 'נדרש האישור לצילום כדי לצלם תמונה');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const filename =
      asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg';
    const mimeType = asset.mimeType ?? inferMimeType(filename);
    const sizeBytes = asset.fileSize ?? 0;
    finishPick({
      originalName: filename,
      displayName: stripExtension(filename),
      mimeType,
      sizeBytes,
      localUri: asset.uri,
    });
  }, [finishPick]);

  const pickFile = useCallback(async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    const filename = asset.name ?? asset.uri.split('/').pop() ?? 'document';
    const mimeType = asset.mimeType ?? inferMimeType(filename);
    const sizeBytes = asset.size ?? 0;
    finishPick({
      originalName: filename,
      displayName: stripExtension(filename),
      mimeType,
      sizeBytes,
      localUri: asset.uri,
    });
  }, [finishPick]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.wrap}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>בחירת מקור</Text>

          <Pressable
            style={styles.optionRow}
            onPress={() => {
              pickGallery().catch(() => {});
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="גלריה"
          >
            <MaterialIcons name="photo-library" size={22} color={PRIMARY} />
            <Text style={styles.optionLabel}>גלריה</Text>
          </Pressable>

          <Pressable
            style={styles.optionRow}
            onPress={() => {
              pickCamera().catch(() => {});
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="צלם תמונה"
          >
            <MaterialIcons name="photo-camera" size={22} color={PRIMARY} />
            <Text style={styles.optionLabel}>צלם תמונה</Text>
          </Pressable>

          <Pressable
            style={styles.optionRow}
            onPress={() => {
              pickFile().catch(() => {});
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="קובץ"
          >
            <MaterialIcons name="insert-drive-file" size={22} color={PRIMARY} />
            <Text style={styles.optionLabel}>קובץ</Text>
          </Pressable>

          <Pressable
            style={[styles.optionRow, styles.cancelRow]}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="ביטול"
          >
            <MaterialIcons name="close" size={22} color="#64748b" />
            <Text style={styles.cancelLabel}>ביטול</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: TINT,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  cancelRow: {
    backgroundColor: '#f1f5f9',
    marginTop: 4,
  },
  cancelLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'right',
  },
});
