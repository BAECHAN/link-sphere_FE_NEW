import { useEffect, useLayoutEffect } from 'react';
import { useBookmarkFolderPostsInfiniteQuery } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  useWindowGridVirtualizer,
  type CardGridSpec,
} from '@/shared/hooks/useWindowGridVirtualizer';
import { Post } from '@/entities/post/model/post.schema';

// 3열 기준 옛 IntersectionObserver rootMargin(1200px)과 체감이 비슷하도록 잡은 값
const PREFETCH_ROW_LOOKAHEAD = 2;
const DEFAULT_ROW_HEIGHT = 600;

function getPostId(post: Post): string {
  return post.id;
}

/**
 * 폴더별 북마크 게시글 목록 데이터와 무한 스크롤 로직을 포함하는 훅
 * grid는 그리는 카드의 치수 - 카드를 넘기는 페이지가 함께 정한다(docs/FE-ARCHITECTURE.md §26).
 */
export const useBookmarkPostList = (
  grid: CardGridSpec,
  folderKey: BookmarkFolderKey,
  sort: BookmarkFolderSort,
  search?: string
) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useBookmarkFolderPostsInfiniteQuery(folderKey, sort, search);

  const posts = data?.posts ?? [];
  const correctedSearch = data?.correctedSearch;

  const { containerRef, virtualizer, rows, columnCount, remeasureScrollMargin } =
    useWindowGridVirtualizer({
      listId: `bookmark-${folderKey}`,
      items: posts,
      getItemId: getPostId,
      minColumnWidth: grid.minColumnWidth,
      maxColumns: grid.maxColumns,
      gapBreakpoints: grid.rowGap,
      estimateRowHeight: (count) => grid.rowHeightEstimate[count] ?? DEFAULT_ROW_HEIGHT,
    });

  // correctedSearch 안내 문구가 나타나거나 사라지면 컨테이너의 문서 상단 기준 위치가
  // 바뀌므로 scrollMargin을 다시 잰다
  useLayoutEffect(() => {
    remeasureScrollMargin();
  }, [correctedSearch, remeasureScrollMargin]);

  const lastVirtualRowIndex = virtualizer.getVirtualItems().at(-1)?.index;

  useEffect(() => {
    if (lastVirtualRowIndex === undefined) {
      return;
    }
    if (
      lastVirtualRowIndex >= rows.length - PREFETCH_ROW_LOOKAHEAD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVirtualRowIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    posts,
    correctedSearch,
    isLoading,
    isFetchingNextPage,
    containerRef,
    virtualizer,
    rows,
    columnCount,
  };
};
