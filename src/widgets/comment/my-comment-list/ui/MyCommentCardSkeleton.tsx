import { Card } from '@/shared/ui/atoms/card';
import { Skeleton } from '@/shared/ui/atoms/skeleton';

/**
 * MyCommentCard의 실제 레이아웃(댓글 내용 → 원글 배지 + 작성일)에 맞춘 골격.
 * 로딩이 끝났을 때 레이아웃이 튀지 않도록 여백·크기를 MyCommentCard와 동일하게 맞춘다.
 */
export function MyCommentCardSkeleton() {
  return (
    <Card className="p-3 gap-3">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-10" />
      </div>
    </Card>
  );
}

interface MyCommentListSkeletonProps {
  count?: number;
}

/** MyCommentList의 목록 클래스와 동일하게 맞춰야 로딩 → 렌더 전환에서 시프트가 없다 */
export function MyCommentListSkeleton({ count = 6 }: MyCommentListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <MyCommentCardSkeleton key={index} />
      ))}
    </div>
  );
}
