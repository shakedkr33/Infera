// FIXED: reusable banner for linked shared events — shows owner label + read-only notice
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface LinkedEventBannerProps {
  ownerName: string | null;
  sourceStatus: 'active' | 'cancelled' | 'deleted';
}

export function LinkedEventBanner({
  ownerName,
  sourceStatus,
}: LinkedEventBannerProps): React.JSX.Element {
  if (sourceStatus === 'deleted') {
    return (
      <View style={[s.banner, s.deletedBanner]}>
        <View style={s.row}>
          <MaterialIcons name="link-off" size={16} color="#6b7280" />
          <Text style={[s.title, s.deletedTitle]}>
            האירוע המקורי נמחק על ידי השולח
          </Text>
        </View>
        <Text style={[s.sub, s.deletedSub]}>מוצגים הפרטים האחרונים שנשמרו</Text>
      </View>
    );
  }

  if (sourceStatus === 'cancelled') {
    return (
      <View style={[s.banner, s.cancelledBanner]}>
        <View style={s.row}>
          <MaterialIcons name="link" size={16} color="#9ca3af" />
          <Text style={[s.title, s.cancelledTitle]}>
            {ownerName
              ? `אירוע משותף · נשלח על ידי ${ownerName}`
              : 'אירוע משותף'}
          </Text>
        </View>
        <Text style={[s.sub, s.cancelledSub]}>האירוע בוטל על ידי השולח</Text>
      </View>
    );
  }

  return (
    <View style={s.banner}>
      <View style={s.row}>
        <MaterialIcons name="link" size={16} color="#36a9e2" />
        <Text style={s.title}>
          {ownerName ? `אירוע משותף · נשלח על ידי ${ownerName}` : 'אירוע משותף'}
        </Text>
      </View>
      <Text style={s.sub}>זהו אירוע לקריאה בלבד. שינויים ישתקפו אוטומטית.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#eff8ff',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(54,169,226,0.2)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1',
    textAlign: 'right',
    flex: 1,
  },
  sub: {
    fontSize: 12,
    color: '#0369a1',
    textAlign: 'right',
    opacity: 0.8,
  },
  // Cancelled state
  cancelledBanner: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  cancelledTitle: {
    color: '#6b7280',
  },
  cancelledSub: {
    color: '#6b7280',
  },
  // Deleted state
  deletedBanner: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  deletedTitle: {
    color: '#6b7280',
  },
  deletedSub: {
    color: '#9ca3af',
  },
});
