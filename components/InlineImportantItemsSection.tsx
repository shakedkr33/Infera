/**
 * InlineImportantItemsSection
 *
 * Renders an expandable "חשוב לזכור" section that lives below an event card.
 * Used in Home timeline and Calendar timeline.
 *
 * - Personal checkboxes per user — state is derived from the user's personal
 *   tasks (sourceType === 'community_event_important_item').
 * - Checking an item creates/updates a personal task for the current user only.
 *   Does NOT affect other users.
 * - RTL-correct layout and Hebrew labels.
 */
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { rtl } from '@/lib/rtl';

export interface ImportantItem {
  id: string;
  title: string;
}

interface InlineImportantItemsSectionProps {
  eventId: string;
  items: ImportantItem[];
  /** Map of itemId → completed state for the current user */
  checks: Record<string, boolean>;
  /** When true the section starts expanded */
  defaultExpanded?: boolean;
}

export function InlineImportantItemsSection({
  eventId,
  items,
  checks,
  defaultExpanded = false,
}: InlineImportantItemsSectionProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggleCheck = useMutation(api.tasks.toggleImportantItemCheck);

  if (items.length === 0) return null;

  const checkedCount = items.filter((item) => checks[item.id]).length;
  const allDone = checkedCount === items.length;

  const summaryLabel = allDone
    ? 'כל פריטי חשוב לזכור בוצעו ✓'
    : items.length === 1
      ? 'חשוב לזכור · פריט אחד'
      : `חשוב לזכור · ${items.length} פריטים`;

  const handleToggle = async (item: ImportantItem) => {
    try {
      await toggleCheck({
        eventId: eventId as Id<'events'>,
        itemId: item.id,
        itemTitle: item.title,
      });
    } catch {
      // silently ignore — Convex will surface errors in dev
    }
  };

  return (
    <View style={s.wrapper}>
      {/* ── Chevron row ──────────────────────────────────────────────────── */}
      <Pressable
        style={s.chevronRow}
        onPress={() => setExpanded((v) => !v)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'כווץ חשוב לזכור' : 'הצג חשוב לזכור'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {allDone && !expanded ? (
          <Text style={s.allDoneText}>{summaryLabel}</Text>
        ) : (
          <Text style={s.summaryText}>{summaryLabel}</Text>
        )}
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color="#f59e0b"
          style={s.chevronIcon}
        />
      </Pressable>

      {/* ── Item list ─────────────────────────────────────────────────────── */}
      {expanded && (
        <View style={s.itemList}>
          <Text style={s.sectionLabel}>📌 חשוב לזכור</Text>
          {items.map((item) => {
            const checked = checks[item.id] ?? false;
            return (
              <View key={item.id} style={s.itemRow}>
                <TaskCheckbox
                  checked={checked}
                  onToggle={() => handleToggle(item)}
                />
                <Text
                  style={[s.itemTitle, checked && s.itemTitleDone]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </View>
            );
          })}
          {allDone && <Text style={s.allDoneInList}>כל הפריטים בוצעו ✓</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.18)',
    paddingTop: 6,
  },
  chevronRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    minHeight: 28,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  summaryText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
    textAlign: rtl.textAlign,
  },
  allDoneText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: rtl.textAlign,
  },
  itemList: {
    marginTop: 6,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: rtl.textAlign,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    minHeight: 44,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    textAlign: rtl.textAlign,
    lineHeight: 20,
  },
  itemTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  allDoneInList: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: rtl.textAlign,
    marginTop: 4,
  },
});
