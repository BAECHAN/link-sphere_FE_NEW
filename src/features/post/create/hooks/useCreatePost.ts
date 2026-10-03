import { useCreatePostMutation } from '@/entities/post/api/post.queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePost, createPostSchema } from '@/entities/post/model/post.schema';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { UrlUtil } from '@/shared/utils/url.util';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';

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
  const { account } = useAccount();

  const { mutateAsync: createPost, isPending: isCreating } = useCreatePostMutation();

  const form = useForm<CreatePost>({
    resolver: zodResolver(createPostSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const { clearNow } = useUnsavedChanges('post-create', form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (formData: CreatePost) => {
    // BE도 같은 검사를 403 EMAIL_NOT_VERIFIED로 거절하지만(방어 계층 중복), 클릭 가능한
    // 채로 두고 안내만 보여준다(disabled 대신 - CLAUDE.md 폼 검증 실패 처리 규칙과 동일 패턴).
    if (account?.emailVerified === false) {
      toast.error(TEXTS.messages.error.emailVerificationRequired);
      return;
    }

    // 응답을 기다렸다가 성공했을 때만 폼을 비우고 이동한다 - 실패하면 입력·이탈 가드를 그대로
    // 남겨 바로 다시 시도할 수 있게 한다. 등록은 실측 중앙값 2.7초라 버튼 라벨("등록 중...")로
    // 충분하다(근거: docs/DECISIONS.md 2026-10-03 항목). 에러 토스트는 전역 핸들러가 이미 1개
    // 띄우므로(429면 rateLimited) 여기서는 reject만 삼킨다 - 다시 던지면 handleSubmit 밖으로
    // 처리되지 않은 rejection이 샌다.
    try {
      await createPost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    } catch {
      return;
    }

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
