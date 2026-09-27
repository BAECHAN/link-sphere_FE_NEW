import { cn } from '@/shared/lib/tailwind/utils';

interface RequiredMarkProps {
  className?: string;
}

/**
 * 폼 라벨 옆에 붙는 필수 입력 표시(*).
 * `aria-hidden`을 주어 스크린리더가 "별표"라고 읽지 않게 하고, "필수" 안내 자체는
 * 그 필드의 `<input required>` 속성에 맡긴다(W3C WAI: required 속성이 필수임을
 * 프로그래밍적으로 알린다).
 * `ml-1`(Tailwind spacing 토큰 1 = 4px)로 직접 간격을 준다 - `Label`(`shared/ui/atoms/label.tsx`)의
 * 기본 `gap-2`(8px)에 기대지 않는다. 그 `gap-2`는 shadcn/ui 템플릿을 그대로 가져온 값이라
 * 이 프로젝트에서 다자식 라벨(아이콘+텍스트 등) 용도로 실제로 쓰이게 되면 이 4px 요구사항과
 * 충돌할 수 있다 - 그래서 호출부(`FormField`)가 라벨 텍스트와 이 마커를 하나의 span으로
 * 묶어 `Label`에는 항상 단일 자식만 전달한다.
 */
export function RequiredMark({ className }: RequiredMarkProps) {
  return (
    <span aria-hidden="true" className={cn('ml-1 text-destructive', className)}>
      *
    </span>
  );
}
