import { useLocalSearchParams } from 'expo-router';
import EventScreen from '@/lib/components/event/EventScreen';

export default function EventDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen mode="details" eventId={id} />;
}
