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
  Post,
  PostListRequest,
  PostListResponse,
  UpdatePost,
} from '@/entities/post/model/post.schema';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { TEXTS } from '@/shared/config/texts';
import {
  handlePostCreateSuccess,
  handlePostUpdateSuccess,
  postKeys,
  postMutationKeys,
} from '@/entities/post/api/post.keys';
import { POST_PAGE_SIZE } from '@/entities/post/config/const';
import { handlePostDeleteSuccess } from '@/entities/folder/api/folder.keys';
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

/** hover 시 게시글 상세 미리 로드 — useSuspenseFetchPostDetailQuery 와 동일 키/queryFn */
export const prefetchPostDetail = (postId: string) => {
  queryClient.prefetchQuery({
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
      // 북마크 폴더 페이지의 목록(folder posts) + 폴더별 bookmarkCount 재검증
      handlePostDeleteSuccess();
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
    onSuccess: (updated) => {
      // 서버가 반환한 수정본을 캐시에 직접 반영 → 목록 재진입 시 옛 데이터 잔상 방지
      queryClient.setQueryData<Post>(postKeys.detail(postId), updated);
      queryClient.setQueriesData<InfiniteData<PostListResponse>>(
        { queryKey: postKeys.listRoot },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              content: page.content.map((post) => (post.id === postId ? updated : post)),
            })),
          };
        }
      );
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
      successMessage: TEXTS.messages.success.postVisibilityUpdated,
      errorMessage: TEXTS.messages.error.postVisibilityUpdateFailed,
    },
    onSuccess: () => {
      handlePostUpdateSuccess(postId);
    },
  });
};
