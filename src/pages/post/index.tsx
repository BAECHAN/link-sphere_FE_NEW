import { Button } from '@/shared/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useFetchCategoryOptionQuery } from '@/entities/category/api/category.queries';
import { useProtectedNavigate } from '@/entities/auth/hooks/useProtectedNavigate';
import { PostList } from '@/widgets/post/post-list/ui/PostList';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';

export function Post() {
  useFetchCategoryOptionQuery();
  const protectedNavigate = useProtectedNavigate();

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-screen-title">Recent Links</h1>
        <Button
          size="sm"
          // 절제된 트렌드 - 2색 그라데이션 CTA. bg-primary/hover:bg-primary/90(기본
          // variant)를 덮어써도 background-image가 background-color 위에 그려져
          // 시각적으로는 문제없다. Artifact 승인: https://claude.ai/artifact/1Gp7sG9rRhhACeicUwZQLi
          className="md:h-10 bg-linear-to-br from-brand to-brand-2 text-brand-foreground hover:brightness-110 transition-[filter]"
          onClick={() => protectedNavigate(ROUTES_PATHS.POST.SUBMIT)}
        >
          Submit Link
        </Button>
      </div>

      <PostListSearch />
      <PostList />
    </div>
  );
}
