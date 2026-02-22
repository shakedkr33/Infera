import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = SCREEN_HEIGHT * 0.92,
}: BottomSheetProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 25,
        stiffness: 120,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/*
       * Root container: flex column, aligns sheet to the bottom.
       * The backdrop Pressable and the sheet are SIBLINGS — the Pressable never
       * wraps the sheet. This is the key fix: Pressable uses capturing-phase
       * touch interception internally, which blocks nested ScrollViews (wheel
       * picker) even when onStartShouldSetResponder is set on a child View.
       * By keeping them in separate branches, the sheet's ScrollViews receive
       * gestures freely from first touch.
       */}
      <View style={s.overlayContainer}>
        {/* Backdrop — fills only the transparent area above the sheet */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet — no Pressable ancestor, gestures are never intercepted */}
        <Animated.View
          style={[
            s.sheet,
            {
              height: maxHeight,
              paddingBottom: insets.bottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={s.handleContainer}>
            <View style={s.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  // Fills the transparent space above the sheet; tapping it closes the sheet.
  // Being a sibling (not ancestor) of the sheet means it never intercepts
  // touches that belong to the sheet's ScrollViews.
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#f6f7f8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handleContainer: { alignItems: 'center', paddingVertical: 12 },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
});
