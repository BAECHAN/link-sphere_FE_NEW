import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { MutationObserver, QueryObserver } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ApiError } from '@/shared/types/common.type';
// 전역 에러 핸들러(queryCache·mutationCache onError)가 붙은 실제 싱글턴이어야 토스트 id가 보인다
// eslint-disable-next-line custom-query-rules/no-query-client-singleton-import
import { queryClient } from '@/shared/lib/react-query/config/queryClient';

const failWith = (status: number) => () =>
  Promise.reject(new ApiError({ status, code: 'SERVER_ERROR', message: 'fail', timestamp: '' }));

/** 실패하는 조회를 하나 돌린다. 재시도는 기다리지 않는다 */
const fetchFailing = (key: string, status: number, meta?: Record<string, unknown>) =>
  queryClient.prefetchQuery({ queryKey: [key], queryFn: failWith(status), retry: false, meta });

const toastIds = (spy: MockInstance<typeof toast.error>) =>
  spy.mock.calls.map(([, options]) => options?.id);

// 조회 실패 토스트는 문구가 같으면 한 장이다 - 미리 받기 뒤 화면이 다시 요청하거나 여러 조회가 함께 실패해도 같은
// 안내가 쌓이지 않게 문구로 id를 단다(sonner는 같은 id면 떠 있는 토스트를 그 자리에서 갱신한다).
describe('queryClient 전역 조회 에러 토스트', () => {
  let toastError: MockInstance<typeof toast.error>;

  beforeEach(() => {
    queryClient.clear();
    toastError = vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('같은 문구로 실패한 조회들은 같은 id로 띄운다', async () => {
    await Promise.all([fetchFailing('a', 500), fetchFailing('b', 500)]);

    expect(toastError).toHaveBeenCalledTimes(2);
    const [firstId, secondId] = toastIds(toastError);
    expect(firstId).toEqual(expect.any(String));
    expect(secondId).toBe(firstId);
  });

  it('문구가 다르면 다른 id로 띄운다', async () => {
    await fetchFailing('a', 500);
    await fetchFailing('b', 500, { errorMessage: TEXTS.messages.error.fetchPosts });

    const [serverErrorId, customId] = toastIds(toastError);
    expect(customId).toEqual(expect.any(String));
    expect(customId).not.toBe(serverErrorId);
  });

  it('요청 한도 초과는 지금처럼 고정 id를 쓴다', async () => {
    await fetchFailing('a', 429);

    expect(toastIds(toastError)).toEqual(['error-rate-limited']);
  });

  // mutation은 사용자가 누른 동작마다 결과를 알린다 - 같은 문구여도 합치지 않는다
  it('mutation 실패 토스트에는 id를 달지 않는다', async () => {
    const mutation = new MutationObserver(queryClient, { mutationFn: failWith(500) });

    await mutation.mutate().catch(() => {});

    expect(toastIds(toastError)).toEqual([undefined]);
  });
});

// 닫힌 채 마운트된 폴더 선택 창처럼 꺼진 구독자만 지켜보는 조회의 실패는 보여 줄 화면이 없다 - meta.silentWhenInactive를
// 단 조회만 알리지 않는다(isUnwatchedQueryFailure)
describe('queryClient 꺼진 구독자만 있는 조회', () => {
  const SILENT_WHEN_INACTIVE = { silentWhenInactive: true };
  let toastError: MockInstance<typeof toast.error>;

  beforeEach(() => {
    queryClient.clear();
    toastError = vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  const observeFolders = (enabled: boolean, meta?: Record<string, unknown>) =>
    new QueryObserver(queryClient, {
      queryKey: ['folders'],
      queryFn: failWith(500),
      retry: false,
      enabled,
      meta,
    }).subscribe(() => {});

  it('silentWhenInactive를 단 조회는 켜진 구독자가 없으면 토스트를 띄우지 않는다', async () => {
    const unsubscribe = observeFolders(false, SILENT_WHEN_INACTIVE);

    await fetchFailing('folders', 500, SILENT_WHEN_INACTIVE);
    unsubscribe();

    expect(toastError).not.toHaveBeenCalled();
  });

  it('켜진 구독자가 있으면 지금처럼 알린다', async () => {
    const unsubscribe = observeFolders(true, SILENT_WHEN_INACTIVE);

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    unsubscribe();
  });

  it('표시가 없는 조회는 꺼진 구독자만 있어도 알린다', async () => {
    const unsubscribe = observeFolders(false);

    await fetchFailing('folders', 500);
    unsubscribe();

    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
