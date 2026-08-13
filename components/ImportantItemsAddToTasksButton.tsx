/**
 * ImportantItemsAddToTasksButton
 *
 * The single, canonical "הוסף למשימות שלי" group-level action for a
 * community event's "חשוב לזכור" important items — reuses the EXACT same
 * mutation (`api.tasks.addEventImportantItemsToMyTasks`) that Event Details
 * already uses, so tapping it always creates exactly ONE personal task
 * ("{event title} – חשוב לזכור") with the important items as subtasks,
 * never one task per item.
 *
 * "Already added" state is intentionally NOT queried per-instance here —
 * callers pass `alreadyAdded` computed from the single batched
 * `api.tasks.getMyImportantItemsBundleStatus` query, so Home (which can
 * render many cards at once) never fans out into one query per event, and
 * every surface (Event Details, community "תזכורות" tab, Home) agrees on
 * the same state without inventing separate local booleans.
 */

import { useMutation } from 'convex/react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

interface ImportantItemsAddToTasksButtonProps {
  eventId: Id<'events'>;
  /** True when the current user already has an active bundle task for this event. */
  alreadyAdded: boolean;
  style?: StyleProp<ViewStyle>;
  onError?: () => void;
}

const ADD_LABEL = 'הוסף למשימות שלי';
const ADDED_LABEL = 'נוסף למשימות שלך ✓';

export function ImportantItemsAddToTasksButton({
  eventId,
  alreadyAdded,
  style,
  onError,
}: ImportantItemsAddToTasksButtonProps): React.JSX.Element {
  const addImportantItemsToMyTasks = useMutation(
    api.tasks.addEventImportantItemsToMyTasks
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabled = alreadyAdded || isSubmitting;
  const label = alreadyAdded ? ADDED_LABEL : ADD_LABEL;

  const handlePress = (): void => {
    if (disabled) return;
    setIsSubmitting(true);
    addImportantItemsToMyTasks({ eventId })
      .catch(() => onError?.())
      .finally(() => setIsSubmitting(false));
  };

  return (
    <Pressable
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityHint={
        alreadyAdded
          ? undefined
          : 'מוסיף משימה אחת עם כל פריטי חשוב לזכור כתת-משימות'
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={handlePress}
      style={({ pressed }) => [
        s.btn,
        alreadyAdded && s.btnDone,
        pressed && !disabled && s.btnPressed,
        style,
      ]}
    >
      {isSubmitting ? (
        <ActivityIndicator color="#0369a1" size="small" />
      ) : (
        <Text style={s.btnText}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnDone: {
    borderColor: '#7dd3fc',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: '#0369a1',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
