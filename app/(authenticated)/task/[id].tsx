import { useLocalSearchParams } from 'expo-router';
import TaskEditorScreen from '@/lib/components/task/TaskEditorScreen';

export default function EditTask(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskEditorScreen mode="edit" taskId={id} />;
}
