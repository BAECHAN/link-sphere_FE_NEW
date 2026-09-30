import { useEffect, useState } from 'react';
import { NavigationType, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSuspenseFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { bookmarkFolderInvalidateQueries } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useGoBack } from '@/shared/hooks/useGoBack';

interface PostDetailLocationState {
  backSource?: 'feed' | 'bookmark';
}

/**
 * 돌아가기 버튼의 라벨을 유입 경로에 맞게 고른다 (동작인 useGoBack의 navigate(-1)/replace
 * 분기와는 별개 - 어디로 가는지와 뭐라고 부를지를 분리했다).
 * - key === 'default': 앱 내 이력 없이 들어옴(공유링크·FCM 알림·새로고침) → useGoBack이
 *   실제로 /post로 replace하므로 "목록으로"가 그대로 참이다.
 * - PostCard가 backSource: 'feed'를 state에 실어 보낸 경우(피드/검색에서 옴) → 동일하게
 *   "목록으로"(실제로 이름 있는 화면이라 약속 가능).
 * - 그 외(북마크 - 폴더마다 화면이 달라 하나로 이름 붙일 수 없음, 상세 자기 자신의
 *   제목 링크처럼 출처를 모르는 앱 내 이동 등) → 목적지를 약속하지 않는 중립 표현.
 */
function resolveBackLabel(location: ReturnType<typeof useLocation>): string {
  if (location.key === 'default') {
    return TEXTS.post.detail.backToList;
  }

  const state = location.state as PostDetailLocationState | null;

  if (state?.backSource === 'feed') {
    return TEXTS.post.detail.backToList;
  }

  return TEXTS.buttons.back;
}

interface BackLabelSnapshot {
  key: string;
  pathname: string;
  label: string;
}

/**
 * resolveBackLabel을 위치가 바뀔 때마다 다시 계산하되, 같은 경로 위에 오버레이(북마크 폴더
 * 창·로그인 창·이미지 뷰어 등, useHistoryOverlay)를 여는 PUSH일 때만 직전 라벨을 유지한다.
 * 그 PUSH는 location.state를 오버레이 표시로 통째로 바꿔 backSource가 가려지지만 유입 경로
 * 자체는 그대로이기 때문이다. 같은 경로 안에서 PUSH가 일어나는 건 오버레이뿐이다 — 같은 주소
 * 링크(상세 제목)는 react-router가 REPLACE로 바꾸고, 오버레이 닫기는 원래 엔트리로 가는 POP이라
 * 둘 다 지금처럼 다시 계산한다. 이전 위치와 비교해야 해 렌더 중 state를 맞추는 방식을 쓴다
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 */
function useBackLabel(): string {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [snapshot, setSnapshot] = useState<BackLabelSnapshot>(() => ({
    key: location.key,
    pathname: location.pathname,
    label: resolveBackLabel(location),
  }));

  if (snapshot.key !== location.key) {
    const isOverlayPush =
      navigationType === NavigationType.Push && snapshot.pathname === location.pathname;

    setSnapshot({
      key: location.key,
      pathname: location.pathname,
      label: isOverlayPush ? snapshot.label : resolveBackLabel(location),
    });
  }

  return snapshot.label;
}

export function usePostDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: post } = useSuspenseFetchPostDetailQuery(id || '');
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);
  const backLabel = useBackLabel();
  const queryClient = useQueryClient();

  // 상세 조회가 BE에서 post_views를 갱신한다(최근 열람순 정렬용) — 북마크 목록의
  // sort=viewed 쿼리는 이 열람과 무관한 별도 캐시라 자동으로 알지 못한다. staleTime(3분)
  // 안에서는 방금 본 글이 목록에 반영 안 되고 새로고침해야만 보이던 문제라 여기서 무효화한다.
  useEffect(
    function invalidateViewedSortOnPostView() {
      bookmarkFolderInvalidateQueries.postsRoot(queryClient);
    },
    [post.id, queryClient]
  );

  return { post, backLabel, goBack };
}
