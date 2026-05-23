import { useLocalSearchParams } from 'expo-router';
import TaskEditorScreen from '@/lib/components/task/TaskEditorScreen';

export default function NewTask(): React.JSX.Element {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  return <TaskEditorScreen mode="create" returnTo={returnTo} />;
}
