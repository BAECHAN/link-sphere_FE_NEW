import {
  useInfiniteQuery,
  useMutation,
  useSuspenseInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { postApi } from '@/domains/post/_common/api/post.api';
import { CreatePost, PostListRequest, UpdatePost } from '@/domains/post/_common/model/post.schema';
import { TEXTS } from '@/shared/config/texts';
import {
  handlePostUpdateSuccess,
  postInvalidateQueries,
  postKeys,
} from '@/domains/post/_common/api/post.keys';
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

export const useFetchPostListQuery = (
  payload?: Pick<PostListRequest, 'search' | 'category' | 'filter' | 'nickname'>
) => {
  return useInfiniteQuery({
    queryKey: postKeys.list(payload),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) => {
      return postApi.fetchPostList({
        page: pageParam,
        size: POST_PAGE_SIZE,
        search: payload?.search,
        category: payload?.category,
        nickname: payload?.nickname,
        filter: payload?.filter,
      });
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

export const useSuspenseFetchPostListQuery = (
  payload?: Pick<PostListRequest, 'search' | 'category' | 'filter' | 'nickname'>
) => {
  return useSuspenseInfiniteQuery({
    queryKey: postKeys.list(payload),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) => {
      return postApi.fetchPostList({
        page: pageParam,
        size: POST_PAGE_SIZE,
        search: payload?.search,
        category: payload?.category,
        nickname: payload?.nickname,
        filter: payload?.filter,
      });
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

export const useFetchPostDetailQuery = (postId: string) => {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => postApi.fetchPostDetail(postId),
    enabled: !!postId,
  });
};

export const useDeletePostMutation = () => {
  return useMutation({
    mutationFn: async (postId: string) => {
      return await postApi.deletePost(postId);
    },
    meta: {
      successMessage: TEXTS.messages.success.postDeleted,
      errorMessage: TEXTS.messages.error.postDeleteFailed,
    },
    onSuccess: () => {
      postInvalidateQueries.list();
    },
  });
};

export const useUpdatePostMutation = (postId: string) => {
  return useMutation({
    mutationFn: async (payload: UpdatePost) => {
      return await postApi.updatePost(postId, payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.postUpdated,
      errorMessage: TEXTS.messages.error.postUpdateFailed,
    },
    onSuccess: () => {
      handlePostUpdateSuccess(postId);
    },
  });
};

export const useUpdatePostVisibilityMutation = (postId: string) => {
  return useMutation({
    mutationFn: async ({ postId, isPrivate }: { postId: string; isPrivate: boolean }) => {
      return await postApi.updatePostVisibility(postId, isPrivate);
    },
    meta: {
      successMessage: '게시물 공개 설정이 변경되었습니다.',
      errorMessage: '게시물 공개 설정 변경에 실패했습니다.',
    },
    onSuccess: () => {
      handlePostUpdateSuccess(postId);
    },
  });
};
