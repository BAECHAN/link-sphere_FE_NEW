import { FallbackProps } from 'react-error-boundary';
import { usePostDetail } from '@/pages/post/hooks/usePostDetail';
import { usePostNotFoundRedirect } from '@/pages/post/hooks/usePostNotFoundRedirect';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Divider } from '@/shared/ui/atoms/divider';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { ApiError } from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';

function PostDetailContent() {
  const { post, backLabel, goBack } = usePostDetail();

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* 버튼↔카드는 gap-4(16px), 카드↔댓글은 바깥 gap-6(24px) - 두 구간 간격이 달라
          중첩 flex 컨테이너로 나눴다(gap-*는 컨테이너당 균일한 값만 지원). 버튼에
          마진을 직접 주는 방식은 inline-flex 요소라 space-y-6와 충돌해 선언한
          값대로 반영되지 않는 문제가 있었다(docs/DECISIONS.md 2026-09-15 참고) -
          gap은 flex 아이템 단위로 적용돼 이 문제 자체가 없다. */}
      <div className="flex flex-col md:gap-4">
        {/* 모바일에서는 아예 렌더링하지 않는다 - sticky로 상시 고정해봤으나(PR #100)
            Navbar와 함께 124px를 영구 소비해 답답하다는 피드백을 받았다. 모바일은
            BottomTabBar가 항상 떠 있어 Feed 탭으로 돌아갈 수단 자체는 있고, 일반
            브라우저 탭이면 OS/브라우저 뒤로가기가 navigate(-1)과 동등하게 동작한다
            (docs/DECISIONS.md 2026-09-14 "모바일 돌아가기 버튼 제거" 참고). 데스크톱은
            Navbar가 sticky라 이 버튼까지 겹쳐 쌓을 이유가 없어 sticky를 걷어냈다. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="hidden md:inline-flex self-start -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          {backLabel}
        </Button>

        <PostCard post={post} isDetail />
      </div>

      <Divider />
      <CommentList postId={post.id} postAuthorId={post.author.id} />
    </div>
  );
}

/**
 * 비공개·삭제 글(404)은 서버 장애가 아니라 접근 불가 상태다.
 * 안내 토스트 후 목록으로 돌려보낸다. 그 외 에러는 화면 안에서 인라인으로 알린다.
 */
function PostDetailErrorFallback({ error }: FallbackProps) {
  const isNotFound = error instanceof ApiError && error.status === 404;
  usePostNotFoundRedirect(isNotFound);

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
