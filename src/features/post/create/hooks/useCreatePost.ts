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
import { useEffect, useState } from 'react';
import { PostUtil, PostSubmitErrorResolution } from '@/entities/post/utils/post.util';

type PostSubmitFormError = Extract<PostSubmitErrorResolution, { kind: 'form' }>;

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
  // 입력칸과 무관한 실패(요청 한도·네트워크 등)의 안내 - 버튼 위 FormAlert에 남는다
  const [submitError, setSubmitError] = useState<PostSubmitFormError | null>(null);

  useEffect(
    function clearSubmitErrorsOnEdit() {
      // 사용자가 무엇이든 고치면 이전 실패 안내를 지운다. 서버가 붙인 입력칸 에러(type 'server')는
      // zod 검증으로 지워지지 않는 칸(북마크 폴더 등)이 있어 여기서 직접 지운다.
      const subscription = form.watch((_, { name }) => {
        setSubmitError(null);

        if (name && form.getFieldState(name).error?.type === 'server') {
          form.clearErrors(name);
        }
      });

      return () => subscription.unsubscribe();
    },
    [form]
  );

  const onSubmit = form.handleSubmit(async (formData: CreatePost) => {
    // BE도 같은 검사를 403 EMAIL_NOT_VERIFIED로 거절하지만(방어 계층 중복), 클릭 가능한
    // 채로 두고 안내만 보여준다(disabled 대신 - CLAUDE.md 폼 검증 실패 처리 규칙과 동일 패턴).
    // 다른 실패 안내와 같은 자리(버튼 위 FormAlert)에 남긴다.
    if (account?.emailVerified === false) {
      setSubmitError({ kind: 'form', message: TEXTS.messages.error.emailVerificationRequired });
      return;
    }

    // 응답을 기다렸다가 성공했을 때만 폼을 비우고 이동한다 - 실패하면 입력·이탈 가드를 그대로
    // 남겨 바로 다시 시도할 수 있게 한다. 등록은 실측 중앙값 2.7초라 버튼 라벨("등록 중...")로
    // 충분하다(근거: docs/DECISIONS.md 2026-10-03 항목). reject는 여기서 받아 원인별 안내로
    // 바꾸고 다시 던지지 않는다 - 던지면 handleSubmit 밖으로 처리되지 않은 rejection이 샌다.
    setSubmitError(null);

    try {
      await createPost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    } catch (error) {
      // 원인별로 고칠 수 있는 입력칸 아래 또는 버튼 위 안내에 남긴다 - mutation이
      // manualErrorHandling이라 전역 토스트는 뜨지 않는다(post.queries.ts).
      const resolution = PostUtil.resolveSubmitError(error, {
        mode: 'create',
        hasFolders: (formData.folderIds?.length ?? 0) > 0,
      });

      if (resolution.kind === 'field') {
        form.setError(
          resolution.field,
          { type: 'server', message: resolution.message },
          { shouldFocus: true }
        );
      } else {
        setSubmitError(resolution);
      }

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
    submitError,
  };
}
