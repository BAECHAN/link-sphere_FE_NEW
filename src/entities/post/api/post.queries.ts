import {
  useInfiniteQuery,
  useMutation,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
  useQuery,
  InfiniteData,
} from '@tanstack/react-query';
import { postApi } from '@/entities/post/api/post.api';
import {
  CreatePost,
  PostListRequest,
  PostListResponse,
  UpdatePost,
} from '@/entities/post/model/post.schema';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { TEXTS } from '@/shared/config/texts';
import {
  handlePostCreateSuccess,
  handlePostUpdateSuccess,
  postInvalidateQueries,
  postKeys,
  postMutationKeys,
} from '@/entities/post/api/post.keys';
import { POST_PAGE_SIZE } from '@/entities/post/config/const';
import { PaginationRequest } from '@/shared/api/common.schema';

export const useCreatePostMutation = () => {
  return useMutation({
    mutationKey: postMutationKeys.create,
    mutationFn: async (payload: CreatePost) => {
      return await postApi.createPost(payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.postCreated,
      errorMessage: TEXTS.messages.error.postCreateFailed,
    },
    onSuccess: () => {
      handlePostCreateSuccess();
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
    select: (data) => {
      const seen = new Set<string>();
      const posts = data.pages
        .flatMap((page) => page.content)
        .filter((post) => (seen.has(post.id) ? false : seen.add(post.id) && true));
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        posts,
        totalElements: data.pages[0]?.totalElements ?? 0,
      };
    },
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
    select: (data) => {
      const seen = new Set<string>();
      const posts = data.pages
        .flatMap((page) => page.content)
        .filter((post) => (seen.has(post.id) ? false : seen.add(post.id) && true));
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        posts,
        totalElements: data.pages[0]?.totalElements ?? 0,
      };
    },
  });
};

export const useFetchPostDetailQuery = (postId: string) => {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => postApi.fetchPostDetail(postId),
    enabled: !!postId,
  });
};

export const useSuspenseFetchPostDetailQuery = (postId: string) => {
  return useSuspenseQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => postApi.fetchPostDetail(postId),
  });
};

export const useDeletePostMutation = () => {
  return useMutation({
    mutationKey: postMutationKeys.delete,
    mutationFn: async (postId: string) => {
      return await postApi.deletePost(postId);
    },
    meta: {
      successMessage: TEXTS.messages.success.postDeleted,
      errorMessage: TEXTS.messages.error.postDeleteFailed,
    },
    onMutate: async (postId: string) => {
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });

      const previousData = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: postKeys.listRoot,
      });

      queryClient.setQueriesData<InfiniteData<PostListResponse>>(
        { queryKey: postKeys.listRoot },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              content: page.content.filter((post) => post.id !== postId),
              totalElements: page.totalElements - 1,
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _postId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      postInvalidateQueries.list();
    },
  });
};

export const useUpdatePostMutation = (postId: string) => {
  return useMutation({
    mutationKey: postMutationKeys.update(postId),
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
    mutationKey: postMutationKeys.updateVisibility(postId),
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
