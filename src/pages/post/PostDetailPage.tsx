import { FallbackProps } from 'react-error-boundary';
import { Link } from 'react-router-dom';
import { usePostDetail } from '@/pages/post/hooks/usePostDetail';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { ArrowLeft, FileX } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Divider } from '@/shared/ui/atoms/divider';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { ApiError } from '@/shared/types/common.type';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useNoIndex } from '@/shared/hooks/useNoIndex';

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
 * 비공개·삭제 글(404). BE가 둘을 같은 404로 응답하므로 문구도 둘을 함께 덮는다.
 * 주소는 그대로 두고 그 자리에서 안내한다 - 토스트 후 목록으로 replace하던 방식은
 * 사라지는 토스트에만 기대고 어떤 링크가 죽었는지 주소까지 잃게 했다.
 * 200으로 응답하는 화면이라 검색엔진 색인에서 빠지도록 noindex를 단다.
 * "목록으로"는 이동이라 버튼 onClick이 아니라 링크로 둔다
 * (https://www.w3.org/WAI/ARIA/apg/patterns/link/ - 네이티브 <a href> 권장).
 */
function PostNotFound() {
  useNoIndex();

  return (
    <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-2 text-center">
      <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileX className="size-6" />
      </div>
      <h2 className="text-screen-title text-foreground">{TEXTS.post.detail.notFound.title}</h2>
      <p className="text-sm text-muted-foreground">{TEXTS.post.detail.notFound.description}</p>
      <Button asChild className="mt-4">
        <Link to={ROUTES_PATHS.POST.ROOT}>{TEXTS.post.detail.backToList}</Link>
      </Button>
    </div>
  );
}

/**
 * 비공개·삭제 글(404)은 서버 장애가 아니라 접근 불가 상태라 그 자리에서 안내한다.
 * 그 외 에러는 화면 안에서 인라인으로 알린다.
 */
function PostDetailErrorFallback({ error }: FallbackProps) {
  if (error instanceof ApiError && error.status === 404) {
    return <PostNotFound />;
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
