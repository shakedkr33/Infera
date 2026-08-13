/**
 * InlineImportantItemsSection
 *
 * Renders an expandable "חשוב לזכור" section that lives below an event card
 * (Calendar timeline). "חשוב לזכור" is EVENT CONTENT, not a task/checklist —
 * items are shown as simple structured bullet rows and are NOT
 * user-completable here. Checkboxes exist only on the personal task created
 * via "הוסף למשימות שלי" (see ImportantItemsAddToTasksButton), never on the
 * original event important-items themselves.
 *
 * RTL-correct layout and Hebrew labels.
 */
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rtl } from '@/lib/rtl';

export interface ImportantItem {
  id: string;
  title: string;
}

interface InlineImportantItemsSectionProps {
  items: ImportantItem[];
  /** When true the section starts expanded */
  defaultExpanded?: boolean;
}

export function InlineImportantItemsSection({
  items,
  defaultExpanded = false,
}: InlineImportantItemsSectionProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (items.length === 0) return null;

  const summaryLabel =
    items.length === 1
      ? 'חשוב לזכור · פריט אחד'
      : `חשוב לזכור · ${items.length} פריטים`;

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
        <Text style={s.summaryText}>{summaryLabel}</Text>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color="#f59e0b"
          style={s.chevronIcon}
        />
      </Pressable>

      {/* ── Item list — plain bullet rows, not completable ──────────────── */}
      {expanded && (
        <View style={s.itemList}>
          <Text style={s.sectionLabel}>📌 חשוב לזכור</Text>
          {items.map((item) => (
            <View key={item.id} style={s.itemRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          ))}
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
    minHeight: 28,
  },
  bullet: {
    fontSize: 14,
    color: '#94a3b8',
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    textAlign: rtl.textAlign,
    lineHeight: 20,
  },
});
