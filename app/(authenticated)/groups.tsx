import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupsScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#f6f7f8',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 18, color: '#94a3b8' }}>בקרוב</Text>
    </SafeAreaView>
  );
}
