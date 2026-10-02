import { Button } from '@/shared/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useProtectedNavigate } from '@/entities/auth/hooks/useProtectedNavigate';
import { PostList } from '@/widgets/post/post-list/ui/PostList';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { POST_CARD_GRID } from '@/widgets/post/post-card/config/post-card-grid.const';
import type { Post as PostItem } from '@/entities/post/model/post.schema';

// 모듈 최상단에 둬 렌더마다 같은 함수가 넘어가게 한다 (docs/FE-ARCHITECTURE.md §26)
function renderFeedPost(post: PostItem, rowIndex: number) {
  return (
    <PostCard
      post={post}
      backSource="feed"
      // 첫 행(최대 3장)만 LCP 후보로 우선 로딩한다 - 실측: 이 썸네일이 프로덕션
      // LCP 요소였다(docs/plans/2026-09-25-lighthouse-perf.md 참고).
      priorityThumbnail={rowIndex === 0}
    />
  );
}

export function Post() {
  const protectedNavigate = useProtectedNavigate();

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-screen-title">Recent Links</h1>
        <Button
          size="sm"
          className="md:h-10"
          onClick={() => protectedNavigate(ROUTES_PATHS.POST.SUBMIT)}
        >
          Submit Link
        </Button>
      </div>

      <PostListSearch />
      <PostList renderPost={renderFeedPost} grid={POST_CARD_GRID} />
    </div>
  );
}
