import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { cn } from '@/shared/lib/tailwind/utils';
import { Skeleton } from '@/shared/ui/atoms/skeleton';

// 스크롤할 자리를 잡는 용도라 화면을 넘길 만큼이면 된다 - 댓글이 수백 개여도 그만큼 그리지 않는다
const MAX_SKELETON_COUNT = 10;

/** CommentItem의 실제 레이아웃(아바타 + 작성자 줄 → 내용 → 액션 줄)에 맞춘 골격 */
function CommentItemSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

interface CommentListSkeletonProps {
  count: number;
}

/**
 * 댓글이 오는 중인 자리. 금방 오면 번쩍이지 않도록 지연 시간 동안은 보이지 않게 두되(SpinnerOverlay와 같은
 * 지연), 스크롤이 제목까지 올라가도록 높이는 처음부터 차지한다(CommentList의 목록 클래스와 같은 간격).
 */
export function CommentListSkeleton({ count }: CommentListSkeletonProps) {
  const isDelayedLoading = useDelayedLoading(true, LOADING_INDICATOR_DELAY_MS);

  return (
    <div
      aria-busy="true"
      className={cn(
        'space-y-6',
        isDelayedLoading ? 'animate-in fade-in duration-200 ease-out' : 'invisible'
      )}
    >
      {Array.from({ length: Math.min(count, MAX_SKELETON_COUNT) }, (_, index) => (
        <CommentItemSkeleton key={index} />
      ))}
    </div>
  );
}
