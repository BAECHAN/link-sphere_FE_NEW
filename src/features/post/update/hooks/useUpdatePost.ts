import { useUpdatePostMutation } from '@/entities/post/api/post.queries';
import { useFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { UpdatePost, updatePostSchema } from '@/entities/post/model/post.schema';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useGoBack } from '@/shared/hooks/useGoBack';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { usePendingSubmit } from '@/shared/hooks/usePendingSubmit';
import { useHasLeftPage } from '@/shared/hooks/useHasLeftPage';
import { showLeftPageFailureToast } from '@/shared/lib/toast/LeftPageFailureToast';
import { NavigationService } from '@/shared/lib/router/navigation';
import { TEXTS } from '@/shared/config/texts';
import { UrlUtil } from '@/shared/utils/url.util';
import { ScrollUtil } from '@/shared/utils/scroll.util';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { PostUtil, PostSubmitErrorResolution } from '@/entities/post/utils/post.util';
import { useLinkPreview } from '@/entities/post/hooks/useLinkPreview';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useSignedOutNotice } from '@/entities/auth/hooks/useSignedOutNotice';
import { ErrorUtil } from '@/shared/utils/error.util';
import { useForm, useWatch, type Path, type UseFormReturn } from 'react-hook-form';
import { useLocation } from 'react-router-dom';

type PostSubmitFormError = Extract<PostSubmitErrorResolution, { kind: 'form' }>;

// 떠난 뒤 수정이 실패해 토스트의 [다시 수정하기]로 돌아올 때 실리는 입력과 실패 판정(useCreatePost.ts와 같은
// 이유). 다른 글의 수정 화면에 되살리지 않게 글 id를 함께 싣는다
interface PostUpdateLocationState {
  restoredSubmission?: {
    postId: string;
    values: UpdatePost;
    resolution: PostSubmitErrorResolution;
  };
}

/** 수정 폼엔 북마크 폴더 칸이 없어 입력칸 에러는 URL 칸뿐이다(폴더 실패는 등록에서만 난다) */
function showSubmitError(
  form: UseFormReturn<UpdatePost>,
  setSubmitError: (error: PostSubmitFormError) => void,
  resolution: PostSubmitErrorResolution
) {
  if (resolution.kind === 'form') {
    setSubmitError(resolution);
  } else if (resolution.field === 'url') {
    form.setError('url', { type: 'server', message: resolution.message }, { shouldFocus: true });
  }
}

export function useUpdatePost(postId: string) {
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);
  const { data: post, isLoading } = useFetchPostDetailQuery(postId);
  const { account } = useAccount();
  const { mutateAsync: updatePost, isPending: isUpdating } = useUpdatePostMutation(postId);

  const form = useForm<UpdatePost>({
    resolver: zodResolver(updatePostSchema),
    defaultValues: { url: '', title: '', categoryIds: [], isPrivate: false },
    mode: 'onChange',
  });

  const initializedUrlRef = useRef<string | null>(null);
  const initializedPostIdRef = useRef<string | null>(null);
  const wasUrlChangedRef = useRef(false);
  // 입력칸과 무관한 실패(글 삭제됨·권한·네트워크 등)의 안내 - 버튼 위 FormAlert에 남는다
  const [submitError, setSubmitError] = useState<PostSubmitFormError | null>(null);
  const location = useLocation();
  const restoredSubmission = (location.state as PostUpdateLocationState | null)?.restoredSubmission;

  useEffect(
    function resetFormWithFetchedPost() {
      if (!post) {
        return;
      }

      // 고치던 내용은 다시 불러온 서버 값으로 덮지 않는다 - 로그인이 풀린 채 이 화면에 남았다가 다시 로그인하면
      // 무효화 재조회가 새 post 참조를 내려 수정 중이던 내용이 지워졌다(docs/plans/2026-10-28-keep-writing-in-place.md).
      // formState.isDirty는 렌더 중에 읽혀 구독돼 있고, 이 렌더의 값을 돌려준다(react-hook-form 7.71.0
      // dist/index.esm.mjs:2931 getProxyFormState). 다른 글로 바뀌었으면 덮는다 - PostEditPage가 같은 라우트에서 폼을
      // 다시 마운트하지 않아, 두면 이전 글의 고친 값이 그 글로 저장된다.
      if (initializedPostIdRef.current === post.id && form.formState.isDirty) {
        return;
      }

      form.reset({
        url: post.url,
        title: post.title,
        categoryIds: (post.categories?.map((c) => String(c.id)) ?? []) as unknown as number[],
        isPrivate: post.isPrivate,
      });
      initializedUrlRef.current = post.url;
      initializedPostIdRef.current = post.id;
      wasUrlChangedRef.current = false;

      // 떠난 뒤 실패해 [다시 수정하기]로 돌아왔다 - 서버 값을 기본값으로 둔 채 고친 값을 되살려 작성 중(dirty)으로
      // 잡고, 머물렀을 때와 같은 안내를 띄운다. URL을 바꾼 채였으면 clearDerivedFieldsOnUrlChange가 되살린 제목·
      // 관심 분야를 비우지 않게 이미 바꾼 것으로 둔다
      if (restoredSubmission?.postId === post.id) {
        form.reset(restoredSubmission.values, { keepDefaultValues: true });
        wasUrlChangedRef.current = restoredSubmission.values.url !== post.url;
        showSubmitError(form, setSubmitError, restoredSubmission.resolution);
      }
    },
    [post, restoredSubmission, form]
  );

  // URL을 바꾸는 순간 제목·관심 분야는 옛 링크 기준이 되므로 비운다.
  // 제목을 비우고 저장하면(URL 변경 여부와 무관하게) 서버가 링크에서 제목을 다시 가져온다.
  const urlValue = useWatch({ control: form.control, name: 'url' });

  useEffect(
    function clearDerivedFieldsOnUrlChange() {
      if (initializedUrlRef.current === null) {
        return;
      }

      // urlValue는 reset()이 반영되기 전 렌더에서 캡처될 수 있어(stale) 비교에 쓰지 않고,
      // effect 실행 시점의 최신 값을 다시 읽어 초기 로드 시 오탐(false positive)을 막는다.
      const isUrlChanged = form.getValues('url') !== initializedUrlRef.current;
      if (isUrlChanged && !wasUrlChangedRef.current) {
        form.setValue('title', '', { shouldDirty: true, shouldValidate: true });
        form.setValue('categoryIds', [], { shouldDirty: true });
      }
      wasUrlChangedRef.current = isUrlChanged;
    },
    [urlValue, form]
  );

  const { clearNow } = useUnsavedChanges(`post-update:${postId}`, form.formState.isDirty);
  usePendingSubmit(`post-update:${postId}`, isUpdating, TEXTS.unsavedChanges.pending.postUpdate);
  const hasLeftPage = useHasLeftPage();
  const guard = useAuthGuard();
  const signedOutNotice = useSignedOutNotice(form.formState.isDirty);

  useEffect(
    function clearSubmitErrorsOnEdit() {
      // useCreatePost.ts의 같은 이름 effect와 같은 이유 - 고치면 이전 실패 안내를 지운다
      return form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          setSubmitError(null);

          if (name && form.getFieldState(name as Path<UpdatePost>).error?.type === 'server') {
            form.clearErrors(name as Path<UpdatePost>);
          }
        },
      });
    },
    [form]
  );

  // useCreatePost.ts와 같은 이유 - 되살린 안내가 화면 밖이면 보이게 내릴 때 기준이 되는 제출 버튼
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    function revealRestoredSubmitError() {
      // useCreatePost.ts의 같은 이름 effect와 같은 이유
      if (submitError && submitError === restoredSubmission?.resolution) {
        submitButtonRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: ScrollUtil.getBehavior(),
        });
      }
    },
    [submitError, restoredSubmission]
  );

  // 작성 중 링크 미리보기 - URL을 원래 값에서 바꿨을 때만 묻는다(그대로면 이미 등록된 글이다).
  // 미리보기 BE는 이메일 인증을 요구하므로 미인증이면 묻지 않는다(수정 자체는 미인증도 허용).
  const isUrlChanged = Boolean(post) && urlValue.trim() !== post?.url;
  const linkPreview = useLinkPreview(urlValue, isUrlChanged && account?.emailVerified === true);
  const previewUrlError = linkPreview.status === 'urlError' ? linkPreview.message : null;

  useEffect(
    function showPreviewUrlErrorOnField() {
      // useCreatePost.ts의 같은 이름 effect와 같은 이유
      if (previewUrlError) {
        form.setError('url', { type: 'server', message: previewUrlError });
      }
    },
    [previewUrlError, form]
  );

  // 등록과 동일하게 응답을 기다렸다가 성공했을 때만 이동한다 - 실패하면 고친 내용과 이탈
  // 가드를 그대로 남긴다. 수정은 대부분 크롤링이 없는 짧은 요청이고, URL 변경 재크롤링도
  // 등록과 같은 수 초 수준이다(docs/DECISIONS.md 2026-10-03 항목). 실패는 원인별 안내로
  // 바꾼다(useCreatePost.ts와 같은 이유).
  async function submitPost(formData: UpdatePost) {
    setSubmitError(null);
    // useCreatePost.ts와 같은 이유 - 떠난 뒤 실패하면 되살릴 폼 값
    const submittedValues = form.getValues();

    try {
      await updatePost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    } catch (error) {
      // useCreatePost.ts와 같은 이유 - 폼 안 안내는 useSignedOutNotice가 맡는다
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      const resolution = PostUtil.resolveSubmitError(error, { mode: 'update', hasFolders: false });

      // useCreatePost.ts와 같은 이유 - 떠난 뒤의 실패는 닫을 때까지 남는 토스트로 대신 알린다. 글이 삭제됐거나
      // 남의 글이면 다시 수정해도 실패하므로 버튼을 달지 않는다
      if (hasLeftPage()) {
        const isRetryable = !(resolution.kind === 'form' && resolution.retryable === false);
        const restoredState: PostUpdateLocationState = {
          restoredSubmission: { postId, values: submittedValues, resolution },
        };

        showLeftPageFailureToast({
          key: `post-update:${postId}`,
          title: TEXTS.messages.error.leftPageFailure.postUpdateTitle,
          description:
            resolution.kind === 'form' && resolution.unclassified
              ? TEXTS.messages.error.leftPageFailure.retryLater
              : resolution.message,
          ...(isRetryable && {
            action: {
              label: TEXTS.buttons.updatePostAgain,
              onClick: () =>
                NavigationService.navigate(ROUTES_PATHS.POST.EDIT.replace(':id', postId), {
                  state: restoredState,
                }),
            },
          }),
        });
        return;
      }

      showSubmitError(form, setSubmitError, resolution);
      return;
    }

    // useCreatePost.ts와 같은 이유 - 떠났으면 goBack(navigate(-1))이 옮겨 간 화면에서 한 칸 더
    // 뒤로 가므로 그대로 둔다
    if (hasLeftPage()) {
      return;
    }

    clearNow();
    // 수정 화면에 들어온 곳으로 되돌아간다 (목록 스크롤 위치 유지).
    goBack();
  }

  // useCreatePost.ts와 같은 이유 - 로그인이 풀린 채 눌렀으면 보내지 않고 로그인 창을 연다
  const onSubmit = form.handleSubmit(async (formData: UpdatePost) => {
    let submitting: Promise<void> | undefined;

    guard(() => {
      submitting = submitPost(formData);
    });

    await submitting;
  });

  return {
    form,
    post,
    isLoading,
    isUpdating,
    onSubmit,
    // useCreatePost.ts와 같은 이유
    submitError: signedOutNotice
      ? { kind: 'form' as const, message: signedOutNotice }
      : submitError,
    linkPreview,
    submitButtonRef,
  };
}
