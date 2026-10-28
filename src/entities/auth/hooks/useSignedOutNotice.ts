import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

/**
 * 로그인이 풀린 채 쓰던 화면에 남아 있는 동안(auth.store signedOutInPlace) 쓰던 폼에 띄울 안내 문구.
 * 저장을 눌렀는지, 왜 풀렸는지(만료·다른 탭 로그아웃)와 상관없이 같고, 다시 로그인하면 사라진다(docs/AUTH.md §8-I).
 * 쓴 내용이 없는 폼에는 띄우지 않는다.
 */
export function useSignedOutNotice(isWriting: boolean): string | null {
  const isSignedOutInPlace = useAuthStore((state) => state.signedOutInPlace !== null);

  return isSignedOutInPlace && isWriting ? TEXTS.messages.error.signedOutBeforeSave : null;
}
