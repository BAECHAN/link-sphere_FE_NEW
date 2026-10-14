import { describe, expect, it, vi } from 'vitest';
import { MutationCache, QueryClient, type MutationFunctionContext } from '@tanstack/react-query';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { SessionChangedError } from '@/shared/types/common.type';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import {
  assertMutationAuthEpochUnchanged,
  rememberMutationAuthEpoch,
} from '@/shared/lib/react-query/config/mutation-auth-epoch';

// queryClient.ts와 같은 전역 onMutate를 단 클라이언트
const createClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onMutate: (_variables, _mutation, context) => rememberMutationAuthEpoch(context),
    }),
  });

/**
 * 같은 scope로 mutation 둘을 연달아 시작한다 - 앞 요청이 서버에 가 있고(finishFirst를 부를 때까지 끝나지
 * 않음) 뒤 요청이 줄에서 기다리는 상태까지 만든다. 뒤 요청은 보내기 직전에 세대를 확인한다.
 */
async function startQueuedPair(client: QueryClient) {
  let finishFirst!: () => void;
  const send = vi.fn<() => Promise<string>>().mockResolvedValue('sent');
  const build = (
    mutationFn: (variables: void, context: MutationFunctionContext) => Promise<unknown>
  ) => client.getMutationCache().build(client, { mutationFn, scope: { id: 'probe' } });

  const first = build(
    () =>
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      })
  );
  const queued = build((_variables, context) => {
    assertMutationAuthEpochUnchanged(context);
    return send();
  });

  const firstResult = first.execute(undefined);
  const queuedResult = queued.execute(undefined);
  await vi.waitFor(() => expect(finishFirst).toBeTypeOf('function'));

  return { firstResult, queuedResult, queued, send, finishFirst };
}

describe('mutation 인증 세대 확인 (줄 서 있던 mutation)', () => {
  it('줄에서 기다리는 사이 세대가 바뀌면 보내지 않고 SessionChangedError로 끝난다 - 기다리던 쪽도 끝난다', async () => {
    AuthEpochUtil.markLogin();
    const { firstResult, queuedResult, queued, send, finishFirst } =
      await startQueuedPair(createClient());
    expect(queued.state.isPaused).toBe(true);

    // 다른 탭에서 다른 계정으로 로그인했다
    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');
    finishFirst();

    await firstResult;
    await expect(queuedResult).rejects.toBeInstanceOf(SessionChangedError);
    expect(send).not.toHaveBeenCalled();
  });

  it('세대가 그대로면 차례가 왔을 때 그대로 보낸다', async () => {
    AuthEpochUtil.markLogin();
    const { firstResult, queuedResult, send, finishFirst } = await startQueuedPair(createClient());

    finishFirst();

    await firstResult;
    await expect(queuedResult).resolves.toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('시작 세대가 기록되지 않은 mutation(전역 onMutate가 없는 클라이언트)은 확인하지 않는다', async () => {
    AuthEpochUtil.markLogin();
    const { firstResult, queuedResult, send, finishFirst } = await startQueuedPair(
      new QueryClient()
    );

    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');
    finishFirst();

    await firstResult;
    await expect(queuedResult).resolves.toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
