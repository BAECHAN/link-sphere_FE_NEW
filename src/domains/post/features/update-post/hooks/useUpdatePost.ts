import { useUpdatePostMutation } from '@/domains/post/_common/api/post.queries';
import { useFetchPostDetailQuery } from '@/domains/post/_common/api/post.queries';
import { UpdatePost, updatePostSchema } from '@/domains/post/_common/model/post.schema';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

export function useUpdatePost(postId: string) {
  const navigate = useNavigate();
  const { data: post, isLoading } = useFetchPostDetailQuery(postId);
  const { mutateAsync: updatePost, isPending: isUpdating } = useUpdatePostMutation(postId);

  const form = useForm<UpdatePost>({
    resolver: zodResolver(updatePostSchema),
    defaultValues: { title: '', categoryIds: [], isPrivate: false },
    mode: 'onChange',
  });

  useEffect(() => {
    if (post) {
      form.reset({
        title: post.title,
        categoryIds: (post.categories?.map((c) => String(c.id)) ?? []) as unknown as number[],
        isPrivate: post.isPrivate,
      });
    }
  }, [post, form]);

  const onSubmit = form.handleSubmit(async (formData: UpdatePost) => {
    try {
      await updatePost(formData, {
        onSuccess: () => {
          navigate(ROUTES_PATHS.POST.ROOT);
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  return {
    form,
    post,
    isLoading,
    isUpdating,
    onSubmit,
  };
}
