import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirmEmailVerificationMutation } from '@/entities/auth/api/auth.queries';
import { ErrorUtil } from '@/shared/utils/error.util';

// unknown: 응답을 못 받아 인증됐는지 모른다 - 토큰이 이미 쓰였을 수 있어 error와 구분한다
type ConfirmStatus = 'pending' | 'success' | 'error' | 'unknown';

/**
 * VerifyEmailPage 마운트 시 URL의 token으로 확인 요청을 한 번만 보낸다. React StrictMode는
 * 개발 모드에서 effect를 두 번 실행하는데, 토큰은 1회용이라 두 번째 호출이 이미 쓰인
 * 토큰으로 401을 받게 된다 - ref로 실제 요청은 한 번만 나가게 막는다(네트워크 탭으로 직접
 * 확인 - 요청은 정확히 1회만 나간다).
 *
 * 결과는 mutation의 isSuccess/isError나 mutate 콜백이 아니라 mutateAsync의 promise로 받는다.
 * StrictMode가 effect를 정리했다 다시 붙일 때 useMutation의 구독이 잠깐 풀리면서 observer가
 * 진행 중인 mutation에서 떨어지고(@tanstack/query-core 5.90.16 `mutationObserver.js:38-42`),
 * 다시 구독해도 붙지 않는다(`onSubscribe`가 비어 있다, `subscribable.js:18-19`). ref 때문에
 * mutate도 다시 부르지 않으니 observer는 응답을 받지 못해 개발 모드에서 화면이 "확인 중"에
 * 멈췄다. promise는 observer와 상관없이 끝나고, StrictMode의 재실행은 state를 지우지 않는다.
 */
export function useConfirmEmailVerification() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { mutateAsync: confirmEmailVerification } = useConfirmEmailVerificationMutation();
  const [status, setStatus] = useState<ConfirmStatus>('pending');

  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (!token || hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;

    confirmEmailVerification({ token })
      .then(() => setStatus('success'))
      .catch((error: unknown) =>
        setStatus(ErrorUtil.isOutcomeUnknown(error) ? 'unknown' : 'error')
      );
  }, [token, confirmEmailVerification]);

  return { status: token ? status : 'error' };
}
