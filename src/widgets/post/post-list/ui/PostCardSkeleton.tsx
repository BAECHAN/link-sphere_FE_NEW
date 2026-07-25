import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/atoms/card';
import { Skeleton } from '@/shared/ui/atoms/skeleton';

/**
 * PostCard의 실제 레이아웃(작성자 줄 → 제목 → 설명 → 링크 프리뷰 → 액션 바)에 맞춘 골격.
 * 로딩이 끝났을 때 레이아웃이 튀지 않도록 여백·크기를 PostCard와 동일하게 맞춘다.
 */
export function PostCardSkeleton() {
  return (
    <Card className="relative flex flex-col overflow-hidden">
      <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-4 md:h-5 w-4/5" />
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 flex flex-col">
        <div className="space-y-1.5 mb-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
        </div>

        <div className="border rounded-lg overflow-hidden mt-1">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="p-2 md:p-3 bg-muted/30 flex items-center justify-between">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="size-6 rounded-full shrink-0" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex gap-2 flex-wrap items-center">
        <Skeleton className="h-7 md:h-9 w-28 rounded-full" />
        <div className="flex items-center gap-1 md:gap-1.5 ml-auto">
          <Skeleton className="size-8 md:size-9 rounded-full" />
          <Skeleton className="size-8 md:size-9 rounded-full" />
        </div>
      </CardFooter>
    </Card>
  );
}

interface PostListSkeletonProps {
  count?: number;
}

/** PostList의 그리드 클래스와 동일하게 맞춰야 로딩 → 렌더 전환에서 시프트가 없다 */
export function PostListSkeleton({ count = 6 }: PostListSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  );
}
