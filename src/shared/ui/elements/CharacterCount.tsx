import { cn } from '@/shared/lib/tailwind/utils';
import { CommonUtil } from '@/shared/utils/common.util';

export interface CharacterCountProps {
  /** 지금 길이 - 무엇으로 셀지는 호출부(도메인 util)가 정한다 */
  current: number;
  /** 상한 - current가 이 값을 넘으면 초과 색으로 바뀐다 */
  max: number;
  /** 숫자 뒤에 붙는 단위·기준(TEXTS에서) */
  suffix?: string;
  /** 입력칸의 aria-describedby가 가리킬 id */
  id?: string;
  className?: string;
}

/**
 * 길이 상한이 있는 입력칸 아래에 늘 보이는 "지금 / 상한" 글자 수. 사용한 양과 상한을 `0 / 140`처럼 나란히
 * 보이는 형태는 Material 글자 수 카운터를, 입력칸 아래 자리는 GOV.UK 글자 수 컴포넌트를 따랐다 - 시안 비교 후
 * 입력칸 아래 오른쪽(A안)으로 결정(docs/DECISIONS.md 2026-11-04).
 *
 * 넘으면 색만 바뀐다. 색만으로 이유를 알릴 수는 없으니 넘었을 때의 이유 문구를 호출부가 옆에 함께 둔다.
 * role은 주지 않는다 - 키 입력마다 바뀌는 글을 화면 읽기 프로그램이 매번 읽지 않도록, 입력칸의
 * aria-describedby로만 이어 포커스할 때 읽히게 한다.
 *
 * @example
 * ```tsx
 * <Textarea aria-describedby={countId} />
 * <CharacterCount id={countId} current={length} max={2000} suffix={TEXTS.comment.form.contentCountSuffix} />
 * ```
 */
export function CharacterCount({ current, max, suffix, id, className }: CharacterCountProps) {
  const isOver = current > max;

  return (
    <p
      id={id}
      className={cn(
        'text-xs tabular-nums whitespace-nowrap',
        isOver ? 'text-destructive' : 'text-muted-foreground',
        className
      )}
    >
      {CommonUtil.commaizeNumber(current)} / {CommonUtil.commaizeNumber(max)}
      {suffix}
    </p>
  );
}
