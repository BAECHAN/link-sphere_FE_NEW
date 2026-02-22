import { useCreatePostMutation } from '@/domains/post/_common/api/post.queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePost, createPostSchema } from '@/domains/post/_common/model/post.schema';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

const DEFAULT_VALUES: CreatePost = {
  url: '',
  categoryIds: [],
  isPrivate: false,
};

export function useCreatePost() {
  const navigate = useNavigate();

  const { mutateAsync: createPost, isPending: isCreating } = useCreatePostMutation();

  const form = useForm<CreatePost>({
    resolver: zodResolver(createPostSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const onSubmit = form.handleSubmit(async (formData: CreatePost) => {
    try {
      await createPost(formData, {
        onSuccess: () => {
          onFormReset();
          navigate(ROUTES_PATHS.POST.ROOT);
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  return {
    form,
    onSubmit,
    isCreating,
    onFormReset,
  };
}
