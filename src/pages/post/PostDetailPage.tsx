import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FallbackProps } from 'react-error-boundary';
import { toast } from '@/shared/lib/toast/toast';
import { useSuspenseFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { folderInvalidateQueries } from '@/entities/folder/api/folder.keys';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { ArrowLeft } from 'lucide-react';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { ApiError } from '@/shared/types/common.type';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useGoBack } from '@/shared/hooks/useGoBack';

function PostDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: post } = useSuspenseFetchPostDetailQuery(id || '');
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);

  // 상세 조회가 BE에서 post_views를 갱신한다(최근 열람순 정렬용) — 북마크 목록의
  // sort=viewed 쿼리는 이 열람과 무관한 별도 캐시라 자동으로 알지 못한다. staleTime(3분)
  // 안에서는 방금 본 글이 목록에 반영 안 되고 새로고침해야만 보이던 문제라 여기서 무효화한다.
  useEffect(
    function invalidateViewedSortOnPostView() {
      folderInvalidateQueries.postsRoot();
    },
    [post.id]
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={goBack} aria-label={TEXTS.common.back}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{TEXTS.post.detail.heading}</h1>
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

  return (
    <div className="text-center py-12 text-destructive">{TEXTS.messages.error.fetchPosts}</div>
  );
}

export function PostDetailPage() {
  return (
    <AsyncBoundary errorFallback={PostDetailErrorFallback}>
      <PostDetailContent />
    </AsyncBoundary>
  );
}
