import { useSearchParams } from 'react-router-dom';
import { usePrefetchPostList } from '@/entities/post/api/post.queries';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { toPostListPayload } from '@/widgets/post/post-list/utils/post-list-payload';
import { useHideBotsStore } from '@/shared/store/hideBots.store';

/**
 * 피드 라우트(lazy 페이지 청크 밖)에서 목록 첫 페이지 요청을 시작한다 — 목록 화면(usePostList)은 청크가
 * 도착해 렌더된 뒤에야 요청해, 청크 다운로드와 목록 요청이 차례로 이어졌다.
 * q·filter는 usePostListParams와 같은 커밋된 URL에서 읽는다(useSearchParamsDraft도 읽기에는 pending을
 * 섞지 않는다). 봇 숨기기는 목록이 쓰는 늦춘 값 대신 지금 값을 쓴다 — 첫 렌더에서 useDeferredValue는
 * 받은 값을 그대로 돌려주므로(https://react.dev/reference/react/useDeferredValue) 첫 진입의 키가 같고,
 * 설정을 바꾼 직후에는 목록보다 한 박자 먼저 요청할 뿐이다.
 */
export function usePostFeedPrefetch() {
  const [searchParams] = useSearchParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);

  usePrefetchPostList(
    toPostListPayload(
      parseSearchQuery(searchParams.get('q') || ''),
      searchParams.get('filter') || undefined,
      hideBots
    )
  );
}
