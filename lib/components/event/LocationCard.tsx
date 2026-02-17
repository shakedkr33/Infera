import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface LocationCardProps {
  location?: string;
  onChange: (loc: string) => void;
}

export function LocationCard({
  location,
  onChange,
}: LocationCardProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const hasLocation = location != null && location.trim() !== '';

  if (!hasLocation && !editing) {
    return (
      <Pressable
        style={s.emptyCard}
        onPress={() => setEditing(true)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="הוסף מיקום"
      >
        <MaterialIcons name="add-location-alt" size={20} color="#94a3b8" />
        <Text style={s.emptyText}>הוסף מיקום</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={[s.iconCircle, { backgroundColor: '#fed7aa' }]}>
          <MaterialIcons name="location-on" size={24} color="#f97316" />
        </View>
        <View style={s.content}>
          <Text style={[s.label, { color: '#f97316' }]}>מיקום</Text>
          <TextInput
            style={s.locationInput}
            value={location}
            onChangeText={onChange}
            placeholder="הוסף מיקום"
            placeholderTextColor="#94a3b8"
            textAlign="right"
            autoFocus={editing}
            onBlur={() => setEditing(false)}
          />
        </View>
        {hasLocation && (
          <Pressable
            style={s.navButton}
            onPress={() =>
              Linking.openURL(
                `https://maps.google.com/?q=${encodeURIComponent(location)}`
              )
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="נווט למיקום"
          >
            <MaterialIcons name="navigation" size={16} color="#fff" />
            <Text style={s.navText}>נווט</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyText: { fontSize: 15, color: '#94a3b8' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationInput: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'right',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#795548',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navText: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
