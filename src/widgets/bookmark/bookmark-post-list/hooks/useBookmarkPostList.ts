import { useFolderPostsInfiniteQuery } from '@/entities/folder/api/folder.queries';
import { FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

/**
 * 폴더별 북마크 게시글 목록 데이터와 무한 스크롤 로직을 포함하는 훅
 */
export const useBookmarkPostList = (folderKey: FolderKey, sort: FolderSort, search?: string) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFolderPostsInfiniteQuery(folderKey, sort, search);

  const observerRef = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '0px 0px 1200px 0px',
  });

  const posts = data?.posts ?? [];

  return {
    posts,
    correctedSearch: data?.correctedSearch,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    observerRef,
  };
};
