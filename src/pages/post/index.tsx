import { Button } from '@/shared/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { useProtectedNavigate } from '@/entities/user/hooks/useProtectedNavigate';
import { PostList } from '@/widgets/post/post-list/ui/PostList';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';

export function Post() {
  useFetchCategoryOptionQuery();
  const protectedNavigate = useProtectedNavigate();

  return (
    <div className="w-full space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Recent Links</h1>
        <Button
          size="sm"
          className="md:h-10"
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
