import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { useDebounce } from '@/shared/hooks/useDebounce';

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'duplicate';

interface UseAvailabilityCheckOptions {
  /** 검사 대상 입력값 (RHF의 watch 값) */
  value: string;
  /** 형식이 유효할 때만 서버를 호출하기 위한 zod 스키마 - 잘못된 형식은 조회할 필요가 없다 */
  schema: z.ZodType<string>;
  checkFn: (value: string) => Promise<boolean>;
}

/**
 * 가입 화면 이메일·닉네임 실시간 중복확인 - useUpdateAccount.ts의 닉네임 중복확인과 동일한
 * 디바운스·취소·상태머신 형태를 이메일에도 함께 쓸 수 있도록 일반화했다. 마이페이지 쪽은
 * 계정별 예외(본인 현재 닉네임 제외)가 있어 건드리지 않고 그대로 둔다.
 */
export function useAvailabilityCheck({ value, schema, checkFn }: UseAvailabilityCheckOptions) {
  // 마지막으로 조회를 마친 값과 그 결과. 화면에 보이는 status는 아래에서 렌더 중에 파생한다 -
  // effect 안에서 'idle'/'checking'을 바로 넣으면 낡은 상태로 한 번 더 렌더된다
  // (https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect)
  const [result, setResult] = useState<{
    value: string;
    status: Exclude<AvailabilityStatus, 'checking'>;
  } | null>(null);
  const checkedRef = useRef<string | null>(null);
  const debouncedValue = useDebounce(value, 500);
  const hasDebounceSettled = value === debouncedValue;

  const trimmed = debouncedValue.trim();
  // 형식 오류는 zod 리졸버가 별도로 안내하므로 여기서는 조회하지 않고 조용히 idle로 둔다
  const isCheckable = !!trimmed && schema.safeParse(trimmed).success;

  // 형식이 틀려지면 이전 결과를 버린다 - 같은 값으로 돌아와도 다시 조회하며 '확인 중'을 보여준다
  if (!isCheckable && result !== null) {
    setResult(null);
  }

  const status: AvailabilityStatus = !isCheckable
    ? 'idle'
    : result?.value === trimmed
      ? result.status
      : 'checking';

  useEffect(() => {
    if (!isCheckable) {
      checkedRef.current = null;
      return;
    }
    if (trimmed === checkedRef.current) {
      return;
    }

    let cancelled = false;
    void (async () => {
      let available: boolean;
      try {
        available = await checkFn(trimmed);
      } catch {
        // 조회 자체가 실패했다(네트워크 오류 등) - 제출을 막지는 않지만("사용 가능"이 실제로
        // 확인된 게 아니므로) 확인됐다고 속이지도 않는다. 실제 중복이면 제출 시점에 BE가
        // 409로 다시 막아준다.
        if (!cancelled) {
          setResult({ value: trimmed, status: 'idle' });
        }
        return;
      }
      if (cancelled) {
        // 검사 도중 값이 또 바뀌어 새 effect가 떴다 - 낡은 응답이므로 버린다
        return;
      }

      checkedRef.current = trimmed;
      setResult({ value: trimmed, status: available ? 'available' : 'duplicate' });
    })();

    return () => {
      cancelled = true;
    };
  }, [trimmed, isCheckable, checkFn]);

  return {
    status,
    isChecking: status === 'checking',
    isAvailable: status === 'available',
    isDuplicate: status === 'duplicate',
    hasDebounceSettled,
  };
}
