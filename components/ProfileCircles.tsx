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
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  }
  return (name.trim()[0] ?? '?').toUpperCase();
}

const CIRCLE_SIZE = 20;
const OVERLAP = 6;

export function ProfileCircles({
  profiles,
  extraCount = 0,
  context,
  maxVisible = 3,
}: ProfileCirclesProps): React.JSX.Element | null {
  if (profiles.length === 0 && extraCount === 0) return null;

  const visible = profiles.slice(0, maxVisible);
  const hiddenCount = extraCount + Math.max(0, profiles.length - maxVisible);

  const label = context === 'sharedWith' ? 'משותף עם' : 'גם הוסיפו ליומן';

  return (
    <View style={s.row} accessible={true} accessibilityLabel={label}>
      {visible.map((p, i) => (
        <View
          key={p.id}
          style={[
            s.circle,
            { backgroundColor: p.color, zIndex: visible.length - i },
            i > 0 && s.overlap,
          ]}
        >
          <Text style={s.initials}>{getInitials(p.name)}</Text>
        </View>
      ))}
      {hiddenCount > 0 && (
        <View
          style={[
            s.circle,
            s.extraCircle,
            { zIndex: 0 },
            visible.length > 0 && s.overlap,
          ]}
        >
          <Text style={s.extraText}>+{hiddenCount}</Text>
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
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  overlap: {
    marginLeft: -OVERLAP,
  },
  initials: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
  extraCircle: {
    backgroundColor: '#94a3b8',
  },
  extraText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
});
