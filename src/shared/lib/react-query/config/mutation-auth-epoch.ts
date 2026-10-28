import type { MutationFunctionContext } from '@tanstack/react-query';
import { SessionChangedError, SessionExpiredError } from '@/shared/types/common.type';
import { useAuthStore } from '@/shared/store/auth.store';
import { AuthEpochUtil, type AuthEpoch } from '@/shared/utils/auth-epoch.util';

interface MutationAuthAtStart {
  epoch: AuthEpoch;
  /** 누른 순간 이 탭에 토큰이 있었는지 - 로그인 만료는 세대를 바꾸지 않아(auth-epoch.util.ts) 세대만으로는 모른다 */
  hadToken: boolean;
}

/**
 * mutation을 시작한(사용자가 누른) 순간 이 탭 토큰이 속했던 인증 세대. query-core는 mutation 하나에 context
 * 객체를 한 번 만들어 전역 onMutate와 나중의 mutationFn에 같은 객체를 넘기므로(query-core mutation.ts의
 * execute) 그 객체를 키로 쓴다.
 */
const authAtStart = new WeakMap<MutationFunctionContext, MutationAuthAtStart>();

/** 전역 MutationCache onMutate에서 부른다(queryClient.ts) - 같은 scope 줄에서 기다릴 mutation도 누른 순간에 불린다 */
export const rememberMutationAuthEpoch = (context: MutationFunctionContext): void => {
  authAtStart.set(context, {
    epoch: AuthEpochUtil.ofToken(),
    hadToken: !!useAuthStore.getState().accessToken,
  });
};

/**
 * scope로 줄 서는 mutation의 mutationFn이 요청을 보내기 직전에 부른다. 줄에서 기다리는 사이 인증 세대가
 * 바뀌었으면(다른 탭·같은 탭의 명시적 로그인·로그아웃) 보내지 않고 SessionChangedError로 끝낸다 - 보내면 그
 * 동작이 바뀐 계정으로 실행된다. 이미 보낸 요청은 client.ts가 같은 기준으로 끝낸다(docs/AUTH.md §8-B).
 * 세대는 그대로인데 누를 땐 있던 토큰이 지금 없으면 그 사이 로그인이 만료된 것이다 - 토큰 없이 보내 401을 받지
 * 않고 SessionExpiredError로 끝낸다(앞선 요청이 만료로 끝나 줄이 풀린 경우).
 * 시작 세대가 기록되지 않은 mutation(전역 onMutate가 없는 테스트용 QueryClient)은 확인하지 않는다.
 */
export const assertMutationAuthEpochUnchanged = (context: MutationFunctionContext): void => {
  const atStart = authAtStart.get(context);

  if (!atStart) {
    return;
  }

  if (AuthEpochUtil.hasChangedSince(atStart.epoch)) {
    throw new SessionChangedError();
  }

  if (atStart.hadToken && !useAuthStore.getState().accessToken) {
    throw new SessionExpiredError();
  }
};
