import { useLocalSearchParams } from 'expo-router';
import TaskEditorScreen from '@/lib/components/task/TaskEditorScreen';

export default function EditTask(): React.JSX.Element {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  return <TaskEditorScreen mode="edit" taskId={id} returnTo={returnTo} />;
}
