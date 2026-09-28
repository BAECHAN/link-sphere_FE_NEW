import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirmEmailVerificationMutation } from '@/entities/auth/api/auth.queries';

type ConfirmStatus = 'pending' | 'success' | 'error';

/**
 * VerifyEmailPage 마운트 시 URL의 token으로 확인 요청을 한 번만 보낸다. React StrictMode는
 * 개발 모드에서 effect를 두 번 실행하는데, 토큰은 1회용이라 두 번째 호출이 이미 쓰인
 * 토큰으로 401을 받게 된다 - ref로 실제 요청은 한 번만 나가게 막는다(네트워크 탭으로 직접
 * 확인 - 요청은 정확히 1회만 나간다).
 *
 * 상태는 별도 useState 없이 mutation 자신의 isSuccess/isError에서 파생시킨다(인라인
 * {onSuccess, onError} 콜백보다 이 방식이 간단하고, mutate() 호출과 상태 읽기가 같은
 * 소스에서 나와 어긋날 일이 없다).
 *
 * 알려진 제약: `pnpm dev`(StrictMode 개발 모드)에서 이 페이지를 직접 열면 실제 요청은
 * 1회만 나가고 정상 응답(200/401)도 받지만, 화면 상태가 이 콜백 방식·파생 방식 둘 다에서
 * pending에 멈추는 현상이 실측으로 재현된다(정확한 원인 미확인 - StrictMode의 개발 전용
 * 이중 마운트와 관련된 것으로 추정되나 추측일 뿐 확정된 근거는 없음). `pnpm build &&
 * vite preview`(StrictMode의 이중 호출이 없는 프로덕션 빌드)로는 정상 동작을 직접
 * 확인했다 - 실제 배포본(사용자가 받는 코드)에는 영향이 없다. 로컬 dev에서 이 화면을
 * 다시 테스트해야 하면 이 제약을 염두에 둘 것.
 */
export function useConfirmEmailVerification() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const {
    mutate: confirmEmailVerification,
    isSuccess,
    isError,
  } = useConfirmEmailVerificationMutation();

  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (!token || hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    confirmEmailVerification({ token });
  }, [token, confirmEmailVerification]);

  const status: ConfirmStatus = !token || isError ? 'error' : isSuccess ? 'success' : 'pending';

  return { status };
}
