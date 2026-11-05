import { useCreatePostMutation } from '@/entities/post/api/post.queries';
import { useForm, useWatch, type Path, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePost, createPostSchema } from '@/entities/post/model/post.schema';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { usePendingSubmit } from '@/shared/hooks/usePendingSubmit';
import { useHasLeftPage } from '@/shared/hooks/useHasLeftPage';
import { showLeftPageFailureToast } from '@/shared/lib/toast/LeftPageFailureToast';
import { NavigationService } from '@/shared/lib/router/navigation';
import { UrlUtil } from '@/shared/utils/url.util';
import { ScrollUtil } from '@/shared/utils/scroll.util';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useSignedOutNotice } from '@/entities/auth/hooks/useSignedOutNotice';
import { TEXTS } from '@/shared/config/texts';
import { ErrorUtil } from '@/shared/utils/error.util';
import { useEffect, useRef, useState } from 'react';
import { PostUtil, PostSubmitErrorResolution } from '@/entities/post/utils/post.util';
import { useLinkPreview } from '@/entities/post/hooks/useLinkPreview';

type PostSubmitFormError = Extract<PostSubmitErrorResolution, { kind: 'form' }>;

// 떠난 뒤 등록이 실패해 토스트의 [다시 등록하기]로 돌아올 때 실리는 입력과 실패 판정 - 돌아오면 머물렀을 때와
// 같은 안내를 다시 띄운다(버튼을 누르면 토스트가 닫혀 이유가 함께 사라진다, docs/UNSAVED-CHANGES-GUARD.md §5)
interface PostCreateLocationState {
  restoredSubmission?: { values: CreatePost; resolution: PostSubmitErrorResolution };
}

/** 실패를 고칠 수 있는 입력칸 아래 또는 버튼 위 안내(FormAlert)에 남긴다 */
function showSubmitError(
  form: UseFormReturn<CreatePost>,
  setSubmitError: (error: PostSubmitFormError) => void,
  resolution: PostSubmitErrorResolution
) {
  if (resolution.kind === 'field') {
    form.setError(
      resolution.field,
      { type: 'server', message: resolution.message },
      { shouldFocus: true }
    );
  } else {
    setSubmitError(resolution);
  }
}

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
  usePendingSubmit('post-create', isCreating, TEXTS.unsavedChanges.pending.postCreate);
  const hasLeftPage = useHasLeftPage();
  const guard = useAuthGuard();
  const signedOutNotice = useSignedOutNotice(form.formState.isDirty);

  // 작성 중 링크 미리보기 - 이메일 미인증이면 BE가 403으로 거절하므로 묻지 않는다
  const urlValue = useWatch({ control: form.control, name: 'url' });
  const titleValue = useWatch({ control: form.control, name: 'title' });
  const linkPreview = useLinkPreview(urlValue, account?.emailVerified === true);
  const previewUrlError = linkPreview.status === 'urlError' ? linkPreview.message : null;

  useEffect(
    function showPreviewUrlErrorOnField() {
      // 도메인 없음 등은 등록해도 똑같이 실패하므로 등록 전에 URL 칸에 띄운다. URL을 고치면
      // clearSubmitErrorsOnEdit이 type 'server' 에러를 지운다.
      if (previewUrlError) {
        form.setError('url', { type: 'server', message: previewUrlError });
      }
    },
    [previewUrlError, form]
  );
  // 입력칸과 무관한 실패(요청 한도·네트워크 등)의 안내 - 버튼 위 FormAlert에 남는다
  const [submitError, setSubmitError] = useState<PostSubmitFormError | null>(null);

  useEffect(
    function clearSubmitErrorsOnEdit() {
      // 사용자가 무엇이든 고치면 이전 실패 안내를 지운다. 서버가 붙인 입력칸 에러(type 'server')는
      // zod 검증으로 지워지지 않는 칸(북마크 폴더 등)이 있어 여기서 직접 지운다.
      // watch(콜백) 대신 subscribe를 쓴다 - watch()가 있으면 React 규칙 린트가 이 훅 전체를 건너뛴다
      // (eslint.config.js의 react-hooks/incompatible-library 주석). 콜백의 name은 string으로 넘어온다.
      return form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          setSubmitError(null);

          if (name && form.getFieldState(name as Path<CreatePost>).error?.type === 'server') {
            form.clearErrors(name as Path<CreatePost>);
          }
        },
      });
    },
    [form]
  );

  const location = useLocation();
  const restoredSubmission = (location.state as PostCreateLocationState | null)?.restoredSubmission;

  useEffect(
    function restoreSubmissionAfterLeftPageFailure() {
      // useSignUp.ts의 restoreInputAfterLeftPageFailure와 같은 이유 - 새로 입력 중이면 덮지 않고, 되살린 입력도
      // 작성 중(dirty)으로 잡는다
      if (!restoredSubmission || form.formState.isDirty) {
        return;
      }

      form.reset(restoredSubmission.values, { keepDefaultValues: true });
      showSubmitError(form, setSubmitError, restoredSubmission.resolution);
    },
    [restoredSubmission, form]
  );

  // 되살린 안내가 화면 밖이면 보이게 내릴 때 기준이 되는 제출 버튼 - 안내는 그 바로 위에 있다
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    function revealRestoredSubmitError() {
      // 돌아온 화면은 맨 위에서 시작해, 데스크톱에선 폼 맨 아래 버튼 위 안내가 화면 밖에 남는다 - 안내와 버튼이
      // 보이게 내린다. 이미 보이면(모바일 하단 고정 바 등) 움직이지 않는다(block: 'nearest')
      if (submitError && submitError === restoredSubmission?.resolution) {
        submitButtonRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: ScrollUtil.getBehavior(),
        });
      }
    },
    [submitError, restoredSubmission]
  );

  async function submitPost(formData: CreatePost) {
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
    // 떠난 뒤 실패하면 되살릴 폼 값 - formData는 zod가 바꾼 값이라(categoryIds가 숫자) 폼 값과 모양이 다르다
    const submittedValues = form.getValues();

    try {
      await createPost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    } catch (error) {
      // 요청하는 사이 로그인이 만료됐다(ErrorUtil.isSessionExpired) - 풀린 뒤에 누르면 가드가 먼저 막아 여기 오지 않는다.
      // 다시 로그인하라는 안내는 로그인 창이, 폼 안 안내는 useSignedOutNotice가 맡는다. 입력은 그대로 남는다
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      // 원인별로 고칠 수 있는 입력칸 아래 또는 버튼 위 안내에 남긴다 - mutation이
      // manualErrorHandling이라 전역 토스트는 뜨지 않는다(post.queries.ts).
      const resolution = PostUtil.resolveSubmitError(error, {
        mode: 'create',
        hasFolders: (formData.folderIds?.length ?? 0) > 0,
      });

      // 응답 전에 "나가기"로 떠났으면 안내를 띄울 폼이 없다 - 닫을 때까지 남는 토스트로 대신 알리고, 원인을
      // 특정하지 못한 실패면 제목과 겹치는 "일시적인 문제로 등록하지 못했어요" 대신 할 일만 적는다
      if (hasLeftPage()) {
        const restoredState: PostCreateLocationState = {
          restoredSubmission: { values: submittedValues, resolution },
        };

        showLeftPageFailureToast({
          key: 'post-create',
          title: ErrorUtil.resolveFailureMessage(
            error,
            TEXTS.messages.error.leftPageFailure.postCreateTitle,
            TEXTS.messages.error.leftPageFailure.outcomeUnknownTitle
          ),
          description:
            resolution.kind === 'form' && resolution.unclassified
              ? TEXTS.messages.error.leftPageFailure.retryLater
              : resolution.message,
          action: {
            label: TEXTS.buttons.createPostAgain,
            onClick: () =>
              NavigationService.navigate(ROUTES_PATHS.POST.SUBMIT, { state: restoredState }),
          },
        });
        return;
      }

      showSubmitError(form, setSubmitError, resolution);
      return;
    }

    // 응답 전에 "나가기"로 떠났으면 옮겨 간 화면에 그대로 둔다 - 성공 토스트는 mutation의
    // meta.successMessage가 띄운다. clearNow보다 먼저 본다: 같은 경로에 새로 열린 폼의 키를 지우지 않게
    if (hasLeftPage()) {
      return;
    }

    clearNow();
    onFormReset();
    // replace: 제출이 끝난 폼 엔트리를 결과 화면으로 대체 → 뒤로가기 시 빈 폼으로 돌아가지 않음
    navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
  }

  // 로그인이 풀린 채 눌렀으면 보내지 않고 로그인 창을 연다 - 입력은 그대로고, 로그인한 뒤 다시 누르면 등록한다
  // (댓글·답글 등록과 같은 useAuthGuard). 로그인 상태면 가드가 바로 실행하므로 그 저장이 끝날 때까지 기다린다
  const onSubmit = form.handleSubmit(async (formData: CreatePost) => {
    let submitting: Promise<void> | undefined;

    guard(() => {
      submitting = submitPost(formData);
    });

    await submitting;
  });

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  return {
    form,
    onSubmit,
    isCreating,
    onFormReset,
    // 로그인이 풀린 채 남아 있으면 그 안내가 먼저다 - 다시 로그인하면 사라지고 이전 안내가 다시 보인다
    submitError: signedOutNotice
      ? { kind: 'form' as const, message: signedOutNotice }
      : submitError,
    linkPreview,
    titleValue,
    submitButtonRef,
  };
}
