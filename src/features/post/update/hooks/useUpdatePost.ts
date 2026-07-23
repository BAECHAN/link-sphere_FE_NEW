import { useUpdatePostMutation } from '@/entities/post/api/post.queries';
import { useFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { UpdatePost, updatePostSchema } from '@/entities/post/model/post.schema';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useGoBack } from '@/shared/hooks/useGoBack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

export function useUpdatePost(postId: string) {
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);
  const { data: post, isLoading } = useFetchPostDetailQuery(postId);
  const { mutate: updatePost, isPending: isUpdating } = useUpdatePostMutation(postId);

  const form = useForm<UpdatePost>({
    resolver: zodResolver(updatePostSchema),
    defaultValues: { url: '', title: '', categoryIds: [], isPrivate: false },
    mode: 'onChange',
  });

  useEffect(
    function resetFormWithFetchedPost() {
      if (post) {
        form.reset({
          url: post.url,
          title: post.title,
          categoryIds: (post.categories?.map((c) => String(c.id)) ?? []) as unknown as number[],
          isPrivate: post.isPrivate,
        });
      }
    },
    [post, form]
  );

  // URL을 바꾸는 순간 제목·관심 분야는 옛 링크 기준이 되므로 비운다.
  // 비운 채로 저장하면 서버가 새 링크의 제목과 AI 자동 분류로 채우고, 원하면 직접 다시 고를 수 있다.
  const urlValue = form.watch('url');
  const wasUrlChangedRef = useRef(false);

  useEffect(
    function clearDerivedFieldsOnUrlChange() {
      if (!post) {
        return;
      }

      const isUrlChanged = urlValue !== post.url;
      if (isUrlChanged && !wasUrlChangedRef.current) {
        form.setValue('title', '', { shouldDirty: true, shouldValidate: true });
        form.setValue('categoryIds', [], { shouldDirty: true });
      }
      wasUrlChangedRef.current = isUrlChanged;
    },
    [urlValue, post, form]
  );

  // 등록과 동일하게 요청을 백그라운드로 보내고 곧바로 목록으로 이동한다.
  // (URL 변경 시 재크롤링 + AI 재분석 때문에 응답이 늦으므로 폼에서 기다리지 않는다)
  const onSubmit = form.handleSubmit((formData: UpdatePost) => {
    updatePost(formData);
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
