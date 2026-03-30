import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../constants/theme';

// FIXED: expanded PROFILE_COLORS palette from 6 to 12
// FIXED: row 1 = 6 colors + control, row 2 = 7 colors — both rows 7 items wide
/** 13 balanced pastel colors for people */
export const PROFILE_COLORS = [
  '#F4A7B9', // Pink
  '#B5B2E4', // Lavender
  '#A8D8B0', // Mint green
  '#E8C89A', // Peach
  '#89C4F4', // Sky blue
  '#7BC8C0', // Teal
  '#FCA5A5', // Coral
  '#D4E6A5', // Lime
  '#FDE68A', // Butter yellow
  '#F9A8D4', // Soft rose
  '#A5B4FC', // Periwinkle
  '#E9B4A6', // Dusty rose
  '#BAE6D4', // Seafoam
] as const;

/** 5 playful colors for pets — completely separate from people's palette */
export const PET_COLORS = [
  '#FF6B6B', // Coral
  '#FFA94D', // Orange
  '#FFD43B', // Yellow
  '#FF8FD0', // Hot pink
  '#9775FA', // Violet
] as const;

// FIXED: taken colors now show owner initials and are non-tappable
export type TakenColor = { color: string; name: string };

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  /** Colors already in use by other members — shown with initials, non-tappable */
  takenColors?: TakenColor[];
  /** Custom palette; defaults to PROFILE_COLORS */
  palette?: readonly string[];
  size?: number;
}

// FIXED: color picker rows now balanced — 6 colors per row
const FIRST_ROW_COUNT = 6;

export function ColorPicker({
  selectedColor,
  onSelectColor,
  takenColors = [],
  palette = PROFILE_COLORS,
  size = 44,
}: ColorPickerProps) {
  const borderRadius = size / 2;
  // FIXED: color picker now shows 5+expand layout with inline second row
  const [isExpanded, setIsExpanded] = useState(false);

  const needsExpansion = palette.length > FIRST_ROW_COUNT;
  const firstRow = needsExpansion
    ? (palette.slice(0, FIRST_ROW_COUNT) as string[])
    : (palette as unknown as string[]);
  const secondRow = needsExpansion
    ? (palette.slice(FIRST_ROW_COUNT) as unknown as string[])
    : [];

  // Map color → name of the member using it (for initials overlay)
  const takenMap = new Map(takenColors.map(({ color, name }) => [color, name]));

  const renderSwatch = (color: string) => {
    const takenByName = takenMap.get(color);
    const isTaken = takenByName !== undefined;
    const isSelected = selectedColor === color;
    const initials = isTaken ? takenByName.trim().substring(0, 2) : null;

    return (
      <Pressable
        key={color}
        onPress={isTaken ? undefined : () => onSelectColor(color)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={
          isTaken ? `צבע תפוס על ידי ${takenByName}` : `בחירת צבע`
        }
        accessibilityState={{ disabled: isTaken }}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: color,
          borderWidth: isSelected ? 2.5 : 0,
          borderColor: isSelected ? colors.slate : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initials ? (
          <Text
            style={{
              color: 'white',
              fontSize: Math.max(9, Math.floor(size * 0.27)),
              fontWeight: '700',
            }}
          >
            {initials}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  const toggleButton = needsExpansion ? (
    <Pressable
      onPress={() => setIsExpanded((v) => !v)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={isExpanded ? 'הצג פחות צבעים' : 'הצג עוד צבעים'}
      style={{
        width: size,
        height: size,
        borderRadius,
        borderWidth: 1.5,
        borderColor: '#d1d5db',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: '#6b7280',
          fontWeight: '600',
        }}
      >
        {isExpanded ? 'פחות' : 'עוד'}
      </Text>
    </Pressable>
  ) : null;

  return (
    <View>
      {/* Row 1: first 5 swatches + expansion toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {firstRow.map((color) => renderSwatch(color))}
        {toggleButton}
      </View>

      {/* Row 2: remaining colors — expands inline below row 1, no modal */}
      {isExpanded && secondRow.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          {secondRow.map((color) => renderSwatch(color))}
        </View>
      )}
    </View>
  );
}
