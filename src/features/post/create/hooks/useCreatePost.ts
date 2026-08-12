import { useCreatePostMutation } from '@/entities/post/api/post.queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePost, createPostSchema } from '@/entities/post/model/post.schema';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { UrlUtil } from '@/shared/utils/url.util';

const DEFAULT_VALUES: CreatePost = {
  url: '',
  title: '',
  categoryIds: [],
  isPrivate: false,
  bookmark: false,
  folderIds: [],
};

export function useCreatePost() {
  const navigate = useNavigate();

  const { mutate: createPost, isPending: isCreating } = useCreatePostMutation();

  const form = useForm<CreatePost>({
    resolver: zodResolver(createPostSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const { clearNow } = useUnsavedChanges('post-create', form.formState.isDirty);

  const onSubmit = form.handleSubmit((formData: CreatePost) => {
    createPost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    clearNow();
    onFormReset();
    // replace: 제출이 끝난 폼 엔트리를 결과 화면으로 대체 → 뒤로가기 시 빈 폼으로 돌아가지 않음
    navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
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
