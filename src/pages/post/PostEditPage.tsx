import { useParams } from 'react-router-dom';
import { UpdatePostForm } from '@/features/post/update/ui/UpdatePostForm';

export function PostEditPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <UpdatePostForm postId={id} />;
}
