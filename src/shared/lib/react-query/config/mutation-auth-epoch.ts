import type { MutationFunctionContext } from '@tanstack/react-query';
import { SessionChangedError } from '@/shared/types/common.type';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';

/**
 * mutation을 시작한(사용자가 누른) 순간 이 탭 토큰이 속했던 인증 세대. query-core는 mutation 하나에 context
 * 객체를 한 번 만들어 전역 onMutate와 나중의 mutationFn에 같은 객체를 넘기므로(query-core mutation.ts의
 * execute) 그 객체를 키로 쓴다.
 */
const authEpochAtStart = new WeakMap<MutationFunctionContext, string | null>();

/** 전역 MutationCache onMutate에서 부른다(queryClient.ts) - 같은 scope 줄에서 기다릴 mutation도 누른 순간에 불린다 */
export const rememberMutationAuthEpoch = (context: MutationFunctionContext): void => {
  authEpochAtStart.set(context, AuthEpochUtil.ofToken());
};

/**
 * scope로 줄 서는 mutation의 mutationFn이 요청을 보내기 직전에 부른다. 줄에서 기다리는 사이 인증 세대가
 * 바뀌었으면(다른 탭·같은 탭의 명시적 로그인·로그아웃) 보내지 않고 SessionChangedError로 끝낸다 - 보내면 그
 * 동작이 바뀐 계정으로 실행된다. 이미 보낸 요청은 client.ts가 같은 기준으로 끝낸다(docs/AUTH.md §8-B).
 * 시작 세대가 기록되지 않은 mutation(전역 onMutate가 없는 테스트용 QueryClient)은 확인하지 않는다.
 */
export const assertMutationAuthEpochUnchanged = (context: MutationFunctionContext): void => {
  if (!authEpochAtStart.has(context)) {
    return;
  }

  if (AuthEpochUtil.hasChangedSince(authEpochAtStart.get(context) ?? null)) {
    throw new SessionChangedError();
  }
};
