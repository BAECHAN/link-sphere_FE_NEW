import { useState } from 'react';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';

interface UseAvailabilityMessageOptions {
  isChecking: boolean;
  isAvailable: boolean;
  /** 확인 중일 때 보여줄 문구 */
  checkingText: string;
  /** 사용 가능으로 확인됐을 때 보여줄 문구 */
  availableText: string;
  /** 평소(빈 칸·형식 미충족·조회 실패) 보여줄 규칙 안내 문구 */
  hintText: string;
}

/**
 * 실시간 중복확인 입력칸(가입 화면 이메일·닉네임, 마이페이지 닉네임) 아래 한 줄 문구를 정한다.
 * 줄이 비는 순간이 없도록 평소엔 안내 문구를 두고, 확인 중·사용 가능이 같은 줄을 갈아 끼운다
 * (문구가 생겼다 사라지며 아래 칸이 밀리던 레이아웃 시프트 방지). 중복·형식 오류는 호출부가
 * RHF 필드 에러로 반영해 FormField가 우선 표시하므로 여기서 다루지 않는다.
 *
 * 확인 요청 직후 "확인 중"이 뜨기 전 지연 구간에는 직전 문구를 그대로 둔다 - 그 사이 안내
 * 문구로 돌아가면 "사용 가능 → 안내 → 사용 가능"으로 글자가 깜빡인다. 그동안 제출 버튼은
 * 호출부가 확인 중 상태로 막고 있다.
 */
export function useAvailabilityMessage({
  isChecking,
  isAvailable,
  checkingText,
  availableText,
  hintText,
}: UseAvailabilityMessageOptions) {
  const showChecking = useDelayedLoading(isChecking, LOADING_INDICATOR_DELAY_MS);
  const [wasAvailable, setWasAvailable] = useState(false);

  // 확인이 끝난 상태만 기억한다 - 렌더 중 이전 값과 비교해 갱신하는 React 공식 패턴
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  if (!isChecking && isAvailable !== wasAvailable) {
    setWasAvailable(isAvailable);
  }

  const showAvailable = isChecking ? !showChecking && wasAvailable : isAvailable;

  return {
    description: showChecking ? checkingText : showAvailable ? availableText : hintText,
    descriptionVariant: showAvailable ? ('success' as const) : ('default' as const),
  };
}
