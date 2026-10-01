// 검증용 변경 — PR 영향 그래프 렌더 확인(병합하지 않는다)
import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/shared/ui/atoms/button';
import { useClickGuard } from '@/shared/hooks/useClickGuard';

/**
 * 누를 때마다 상태를 뒤집는 버튼(펼침/접힘, 표시/숨김, 테마 전환 등)용 `Button`.
 * 이런 버튼은 더블클릭하면 원래 상태로 돌아가 "눌렀는데 반영 안 됨"처럼 보이므로,
 * `useClickGuard`(DOUBLE_CLICK_GUARD_MS 이내 재클릭 무시)를 내장해 호출부마다 가드를
 * 직접 넣지 않게 한다. 그 외 props·스타일은 `Button`과 같다.
 */
export const ToggleButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ onClick, ...props }, ref) => {
    const canClick = useClickGuard();

    return (
      <Button
        ref={ref}
        {...props}
        onClick={(e) => {
          if (!canClick()) {
            return;
          }

          onClick?.(e);
        }}
      />
    );
  }
);
ToggleButton.displayName = 'ToggleButton';
