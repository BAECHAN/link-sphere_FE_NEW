import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FallbackProps } from 'react-error-boundary';
import { toast } from '@/shared/lib/toast/toast';
import { useSuspenseFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { bookmarkFolderInvalidateQueries } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { ApiError } from '@/shared/types/common.type';
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

  return TEXTS.post.detail.back;
}

function PostDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: post } = useSuspenseFetchPostDetailQuery(id || '');
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);
  const location = useLocation();
  const backLabel = resolveBackLabel(location);
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* sticky: 내 댓글 목록 등에서 진입하면 해당 댓글로 이미 스크롤된 상태로 화면이
          시작해(CommentList의 scrollToHashedComment 참고), 버튼이 최상단에만 있으면
          화면 밖에 있는 상태로 시작한다. Navbar(h-16, z-nav)와 같은 배경 처리로 그
          바로 아래 이어 붙인다. */}
      <div className="sticky top-16 z-panel py-2 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="-ml-2 min-h-11 md:min-h-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          {backLabel}
        </Button>
      </div>

      <PostCard post={post} isDetail />

      <div className="pt-6 border-t">
        <CommentList postId={post.id} postAuthorId={post.author.id} />
      </div>
    </div>
  );
}

/**
 * 비공개·삭제 글(404)은 서버 장애가 아니라 접근 불가 상태다.
 * 안내 토스트 후 목록으로 돌려보낸다. 그 외 에러는 화면 안에서 인라인으로 알린다.
 */
function PostDetailErrorFallback({ error }: FallbackProps) {
  const navigate = useNavigate();
  const isNotFound = error instanceof ApiError && error.status === 404;

  useEffect(
    function redirectWhenPostUnavailable() {
      if (!isNotFound) {
        return;
      }
      toast.error(TEXTS.post.detail.notFound, { id: 'post-detail-not-found' });
      navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    },
    [isNotFound, navigate]
  );

  if (isNotFound) {
    return <SpinnerOverlay />;
  }

  return <ErrorState>{TEXTS.messages.error.fetchPosts}</ErrorState>;
}

export function PostDetailPage() {
  return (
    <AsyncBoundary errorFallback={PostDetailErrorFallback}>
      <PostDetailContent />
    </AsyncBoundary>
  );
}
