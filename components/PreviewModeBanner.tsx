import { X } from 'lucide-react-native';
import type React from 'react';
import { TouchableOpacity } from 'react-native';

type PreviewModeBannerProps = {
  onClose?: () => void;
};

export const PreviewModeBanner: React.FC<PreviewModeBannerProps> = ({
  onClose,
}) => {
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <TouchableOpacity
      className="absolute right-4 z-50 rounded-full p-2"
      onPress={handleClose}
      style={{
        top: 50,
        backgroundColor: 'rgba(31, 41, 55, 0.8)',
      }}
    >
      <X color="#e5e7eb" size={24} />
    </TouchableOpacity>
  );
};
