import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

interface TaskCheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

export function TaskCheckbox({ checked, onToggle }: TaskCheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessible={true}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={checked ? 'משימה הושלמה' : 'סמן כהושלם'}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <MaterialIcons name="check" size={16} color="#fff" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(0,102,142,0.45)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
});
