import { useUpdatePostMutation } from '@/entities/post/api/post.queries';
import { useFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { UpdatePost, updatePostSchema } from '@/entities/post/model/post.schema';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useGoBack } from '@/shared/hooks/useGoBack';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { UrlUtil } from '@/shared/utils/url.util';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

export function useUpdatePost(postId: string) {
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);
  const { data: post, isLoading } = useFetchPostDetailQuery(postId);
  const { mutateAsync: updatePost, isPending: isUpdating } = useUpdatePostMutation(postId);

  const form = useForm<UpdatePost>({
    resolver: zodResolver(updatePostSchema),
    defaultValues: { url: '', title: '', categoryIds: [], isPrivate: false },
    mode: 'onChange',
  });

  const initializedUrlRef = useRef<string | null>(null);
  const wasUrlChangedRef = useRef(false);

  useEffect(
    function resetFormWithFetchedPost() {
      if (post) {
        form.reset({
          url: post.url,
          title: post.title,
          categoryIds: (post.categories?.map((c) => String(c.id)) ?? []) as unknown as number[],
          isPrivate: post.isPrivate,
        });
        initializedUrlRef.current = post.url;
        wasUrlChangedRef.current = false;
      }
    },
    [post, form]
  );

  // URL을 바꾸는 순간 제목·관심 분야는 옛 링크 기준이 되므로 비운다.
  // 제목을 비우고 저장하면(URL 변경 여부와 무관하게) 서버가 링크에서 제목을 다시 가져온다.
  const urlValue = form.watch('url');

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

  // 등록과 동일하게 응답을 기다렸다가 성공했을 때만 이동한다 - 실패하면 고친 내용과 이탈
  // 가드를 그대로 남긴다. 수정은 대부분 크롤링이 없는 짧은 요청이고, URL 변경 재크롤링도
  // 등록과 같은 수 초 수준이다(docs/DECISIONS.md 2026-10-03 항목). 에러 토스트는 전역
  // 핸들러가 띄우므로 reject만 삼킨다(useCreatePost.ts와 같은 이유).
  const onSubmit = form.handleSubmit(async (formData: UpdatePost) => {
    try {
      await updatePost({ ...formData, url: UrlUtil.normalizeUrl(formData.url) });
    } catch {
      return;
    }

    clearNow();
    // 수정 화면에 들어온 곳으로 되돌아간다 (목록 스크롤 위치 유지).
    goBack();
  });

  return {
    form,
    post,
    isLoading,
    isUpdating,
    onSubmit,
  };
}
