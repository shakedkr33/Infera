import { MaterialIcons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

interface SubtaskImagePreviewModalProps {
  uri: string | null;
  onClose: () => void;
}

export function SubtaskImagePreviewModal({
  uri,
  onClose,
}: SubtaskImagePreviewModalProps): React.JSX.Element | null {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const previewMaxW = windowWidth * 0.9;
  const previewMaxH = windowHeight * 0.78;

  return (
    <Modal
      visible={uri !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.previewOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
        {uri ? (
          <View
            style={[s.previewCard, { width: previewMaxW, zIndex: 1 }]}
            accessibilityViewIsModal
            pointerEvents="box-none"
          >
            <View style={s.previewTopBar}>
              <Pressable
                style={s.previewCloseBtn}
                onPress={onClose}
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
                { width: previewMaxW, height: previewMaxH },
              ]}
            >
              <Image
                source={{ uri }}
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
  );
}

const s = StyleSheet.create({
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
