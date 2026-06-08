import { useLocalSearchParams } from 'expo-router';
import TaskEditorScreen from '@/lib/components/task/TaskEditorScreen';

export default function NewTask(): React.JSX.Element {
  const { returnTo, prefillTitle, relatedBirthdayId, relatedBirthdayName } =
    useLocalSearchParams<{
      returnTo?: string;
      prefillTitle?: string;
      relatedBirthdayId?: string;
      relatedBirthdayName?: string;
    }>();

  return (
    <TaskEditorScreen
      mode="create"
      returnTo={returnTo}
      prefillTitle={prefillTitle}
      relatedBirthdayId={relatedBirthdayId}
      relatedBirthdayName={relatedBirthdayName}
    />
  );
}
