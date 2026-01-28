import { X } from 'lucide-react-native';
import type React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { tw } from '@/lib/rtl';

type WebViewModalProps = {
  visible: boolean;
  url: string;
  title: string;
  onClose: () => void;
};

export const WebViewModal: React.FC<WebViewModalProps> = ({
  visible,
  url,
  title,
  onClose,
}) => {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
      visible={visible}
    >
      <View className="flex-1 bg-[#0a0a0a]">
        {/* הוספת padding עליון ליצירת רווח והורדת הכותרת */}
        <View className="pt-12" />
        <SafeAreaView className="flex-1 bg-[#0a0a0a]">
          <View
            className={`${tw.flexRow} items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3`}
          >
            <Text className="flex-1 text-white text-lg font-semibold">
              {title}
            </Text>
            <TouchableOpacity
              accessibilityLabel="סגור"
              accessibilityRole="button"
              accessible={true}
              onPress={onClose}
            >
              <X color="#e5e7eb" size={24} />
            </TouchableOpacity>
          </View>
          <WebView className="flex-1" source={{ uri: url }} />
        </SafeAreaView>
      </View>
    </Modal>
  );
};
