import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { postApi } from '@/domains/post/_common/api/post.api';
import { CreatePost } from '@/domains/post/_common/model/post.schema';
import { TEXTS } from '@/shared/config/texts';
import { postInvalidateQueries, postKeys } from '@/domains/post/_common/api/post.keys';
import { POST_PAGE_SIZE } from '@/domains/post/_common/config/const';
import { PaginationRequest } from '@/shared/api/common.schema';

export const useCreatePostMutation = () => {
  return useMutation({
    mutationFn: async (payload: CreatePost) => {
      return await postApi.createPost(payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.postCreated,
      errorMessage: TEXTS.messages.error.postCreateFailed,
    },
    onSuccess: () => {
      postInvalidateQueries.list();
    },
  });
};

export const useFetchPostListQuery = () => {
  return useInfiniteQuery({
    queryKey: postKeys.list(),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) => {
      return postApi.fetchPostList({ page: pageParam, size: POST_PAGE_SIZE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.last) return undefined;
      return lastPage.page + 1;
    },
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      posts: data.pages.flatMap((page) => page.content),
      totalElements: data.pages[0]?.totalElements ?? 0,
    }),
  });
};
