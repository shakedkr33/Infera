import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

const TAG_BG = '#E8F5FD';
const TAG_TEXT = '#36a9e2';

type CommunityEventNameTagProps = {
  name: string;
};

/**
 * Subtle community source pill for event rows outside the community screen.
 */
export function CommunityEventNameTag({
  name,
}: CommunityEventNameTagProps): ReactElement | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`קהילה ${trimmed}`}
      accessible={true}
      style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
    >
      <View
        style={{
          backgroundColor: TAG_BG,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{
            color: TAG_TEXT,
            fontSize: 11,
            fontWeight: '600',
            textAlign: 'right',
          }}
        >
          {trimmed}
        </Text>
      </View>
    </View>
  );
}
