/**
 * HomeImportantItemsPreview
 *
 * Compact "📌 חשוב לזכור" preview for a community event card on the main
 * app Home screen, plus the SAME canonical group-level
 * "הוסף למשימות שלי" action already available in Event Details and the
 * community "תזכורות" tab (via `ImportantItemsAddToTasksButton` —
 * `api.tasks.addEventImportantItemsToMyTasks`, ONE parent task with
 * subtasks, never one task/button per item).
 *
 * Does NOT decide Home eligibility — the caller only renders this when the
 * event is already eligible to appear on Home through the existing
 * personal-calendar rules; this component only decides what to show once
 * that eligible card exists.
 */
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ImportantItemsAddToTasksButton } from '@/components/ImportantItemsAddToTasksButton';
import type { Id } from '@/convex/_generated/dataModel';
import { getHomeImportantItemsPreview } from '@/lib/homeImportantItemsPreview';
import { rtl } from '@/lib/rtl';

export interface HomeImportantItem {
  id: string;
  title: string;
}

interface HomeImportantItemsPreviewProps {
  eventId: string;
  items: HomeImportantItem[];
  /** From the single batched api.tasks.getMyImportantItemsBundleStatus query. */
  alreadyAdded: boolean;
}

export function HomeImportantItemsPreview({
  eventId,
  items,
  alreadyAdded,
}: HomeImportantItemsPreviewProps): React.JSX.Element | null {
  if (items.length === 0) return null;

  const { preview, remainingCount } = getHomeImportantItemsPreview(items);

  return (
    <View style={s.wrapper}>
      <Text style={s.label}>📌 חשוב לזכור</Text>
      {preview.map((item) => (
        <Text key={item.id} numberOfLines={1} style={s.itemText}>
          {item.title}
        </Text>
      ))}
      {remainingCount > 0 ? (
        <Text style={s.moreText}>{`ועוד ${remainingCount}`}</Text>
      ) : null}
      <ImportantItemsAddToTasksButton
        alreadyAdded={alreadyAdded}
        eventId={eventId as Id<'events'>}
        onError={() => Alert.alert('שגיאה', 'לא ניתן להוסיף למשימות כרגע')}
        style={s.addBtn}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.18)',
    paddingTop: 8,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: rtl.textAlign,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  itemText: {
    fontSize: 13,
    color: '#1e293b',
    textAlign: rtl.textAlign,
  },
  moreText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: rtl.textAlign,
  },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
});
