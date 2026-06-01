/**
 * ProfileCircles — overlapping avatar circles for event/task cards.
 *
 * Semantic meaning depends on `context`:
 *   'sharedWith'          → personal events/tasks ("משותף עם")
 *   'alsoAddedToCalendar' → community events ("גם הוסיפו ליומן")
 *
 * The same visual rendering is used in both cases; only the
 * accessibility label differs.
 */
import { StyleSheet, Text, View } from 'react-native';

export type ProfileCircle = {
  id: string;
  name: string;
  color: string;
};

interface ProfileCirclesProps {
  profiles: ProfileCircle[];
  /** Count of external (non-family) participants to show as "+N". */
  extraCount?: number;
  context: 'sharedWith' | 'alsoAddedToCalendar';
  /** Maximum number of avatar circles before collapsing to "+N". */
  maxVisible?: number;
  /**
   * Diameter of each circle in dp.
   * Defaults to 20. Pass 22 for compact card header rows to match task-assignee
   * circle size.
   */
  size?: number;
}

function getInitials(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return '';
  return chars.slice(0, 2).join('');
}

const CIRCLE_SIZE = 20;
const OVERLAP = 6;

export function ProfileCircles({
  profiles,
  extraCount = 0,
  context,
  maxVisible = 3,
  size = CIRCLE_SIZE,
}: ProfileCirclesProps): React.JSX.Element | null {
  const validProfiles = profiles.filter((p) => getInitials(p.name).length > 0);
  if (validProfiles.length === 0 && extraCount === 0) return null;

  const visible = validProfiles.slice(0, maxVisible);
  const hiddenCount =
    extraCount + Math.max(0, validProfiles.length - maxVisible);

  const label = context === 'sharedWith' ? 'משותף עם' : 'גם הוסיפו ליומן';

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  const initialsSize = size >= 22 ? 9 : 8;
  const extraSize = size >= 22 ? 8 : 7;

  return (
    <View style={s.row} accessible={true} accessibilityLabel={label}>
      {visible.map((p, i) => (
        <View
          key={p.id}
          style={[
            s.circle,
            circleStyle,
            { backgroundColor: p.color, zIndex: visible.length - i },
            i > 0 && { marginLeft: -OVERLAP },
          ]}
        >
          <Text style={[s.initials, { fontSize: initialsSize }]}>
            {getInitials(p.name)}
          </Text>
        </View>
      ))}
      {hiddenCount > 0 && (
        <View
          style={[
            s.circle,
            circleStyle,
            s.extraCircle,
            { zIndex: 0 },
            visible.length > 0 && { marginLeft: -OVERLAP },
          ]}
        >
          <Text style={[s.extraText, { fontSize: extraSize }]}>
            +{hiddenCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  initials: {
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
  extraCircle: {
    backgroundColor: '#94a3b8',
  },
  extraText: {
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
});
