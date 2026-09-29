import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse, delay } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdateAccount } from '@/features/account/update/hooks/useUpdateAccount';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

vi.mock('@/entities/account/api/account.keys', () => ({
  accountKeys: { root: ['account'] },
  accountMutationKeys: { update: ['account', 'update'] },
  handleAccountUpdateSuccess: vi.fn(),
}));

// URL.createObjectURL 스텁 — URL 클래스 자체는 유지하고 메서드만 추가
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useUpdateAccount', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    // QueryClient 캐시에 account 데이터를 직접 주입 → GET 요청 없이 즉시 account 반환
    queryClient.setQueryData(['account'], mockAccount);
  });

  it('초기값이 account 데이터로 세팅된다', async () => {
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    // useEffect([account, reset])가 실행된 후 form 값이 세팅될 때까지 대기
    await waitFor(() => expect(result.current.form.getValues('nickname')).toBe('testuser'));
    expect(result.current.account?.nickname).toBe('testuser');
  });

  it('이미지 파일 선택 시 avatarPreview가 blob URL로 업데이트된다', () => {
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });

    act(() => {
      result.current.handleAvatarChange(file);
    });

    expect(result.current.avatarPreview).toBe('blob:mock-url');
  });

  it('파일이 30MB를 넘으면 업로드 시도 없이 즉시 거부하고 미리보기를 바꾸지 않는다', () => {
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    const file = new File(['img'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 31 * 1024 * 1024 });
    const previousPreview = result.current.avatarPreview;

    act(() => {
      result.current.handleAvatarChange(file);
    });

    // 미리보기가 바뀌지 않았다 = blob URL을 만들지도, pendingFile로 들고 있지도 않는다는 뜻
    expect(result.current.avatarPreview).toBe(previousPreview);
  });

  it('제출 후 응답을 기다리는 동안(pending)에도 입력값이 그대로 유지된다', async () => {
    // PATCH 응답을 영원히 지연시켜, pending 중 폼 값이 건드려지지 않는지 확인한다
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async () => {
        await delay('infinite');
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.handleAvatarChange(file);
      result.current.form.setValue('nickname', 'newNick');
    });

    act(() => {
      void result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    // 응답이 오지 않는 동안에도 방금 입력한 값이 전부 그대로 남아있어야 한다
    expect(result.current.form.getValues('nickname')).toBe('newNick');
    expect(result.current.avatarPreview).toBe('blob:mock-url');
    expect(result.current.isDirty).toBe(true);
  });

  it('제출이 성공하면 서버 응답으로 폼이 reset되어 dirty가 해제된다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async () => {
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, nickname: 'newNick' },
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() => expect(result.current.form.formState.isDirty).toBe(false));
    expect(result.current.form.getValues('nickname')).toBe('newNick');
  });

  it('이미지 없이 닉네임만 변경하면 PATCH /auth/account만 호출된다', async () => {
    const patchCalled = vi.fn();

    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
        patchCalled(await request.json());
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, nickname: 'newNick' },
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick');
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() =>
      expect(patchCalled).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'newNick' }))
    );
  });

  it('이미지와 닉네임 모두 변경 시 서명 URL 발급→직접 업로드 후 updateAccount가 호출된다', async () => {
    const signUrlCalled = vi.fn();
    const uploadCalled = vi.fn();
    const patchCalled = vi.fn();

    server.use(
      http.post(url(API_ENDPOINTS.upload.signedUrl), () => {
        signUrlCalled();
        return HttpResponse.json(
          {
            status: 201,
            message: 'ok',
            data: {
              uploadUrl: 'https://fake-storage.test/upload',
              token: 'fake-token',
              publicUrl: 'https://example.com/new-avatar.png',
            },
            timestamp: '',
          },
          { status: 201 }
        );
      }),
      http.put('https://fake-storage.test/upload', () => {
        uploadCalled();
        return new HttpResponse(null, { status: 200 });
      }),
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
        patchCalled(await request.json());
        return HttpResponse.json(
          { status: 200, message: 'ok', data: mockAccount, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.handleAvatarChange(file);
      result.current.form.setValue('nickname', 'newNick');
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() => {
      expect(signUrlCalled).toHaveBeenCalled();
      expect(uploadCalled).toHaveBeenCalled();
      expect(patchCalled).toHaveBeenCalledWith(
        expect.objectContaining({ image: 'https://example.com/new-avatar.png' })
      );
    });
  });

  it('409(닉네임 중복)로 실패하면 롤백 후에도 닉네임·이미지 미리보기가 그대로 남아 바로 재시도할 수 있다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), () =>
        HttpResponse.json(
          {
            status: 409,
            code: 'DUPLICATE_NICKNAME',
            message: '이미 사용 중인 닉네임입니다.',
            timestamp: '',
          },
          { status: 409 }
        )
      )
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.handleAvatarChange(file);
      result.current.form.setValue('nickname', 'taken', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // 캐시는 롤백됐지만(전역 account.nickname은 다시 testuser), 폼에 입력했던 값과
    // 골랐던 이미지 미리보기는 사라지지 않는다 — 재시도하려고 처음부터 다시 입력할 필요가 없다.
    expect(result.current.form.getValues('nickname')).toBe('taken');
    expect(result.current.avatarPreview).toBe('blob:mock-url');
  });

  it('타이핑을 멈추면 디바운스 후 가용성 검사가 실행되고, 사용 중인 닉네임이면 인라인 오류를 띄운다', async () => {
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'taken', { shouldDirty: true });
    });

    // 디바운스(500ms)가 정착해야 검사가 시작된다
    await waitFor(() => expect(result.current.hasNicknameError).toBe(true), { timeout: 2000 });
    expect(result.current.form.formState.errors.nickname).toBeTruthy();
  });

  it('닉네임 형식이 잘못되면(zod 검증) 가용성 조회 없이 즉시 에러가 뜬다', async () => {
    // 저장 버튼의 disabled 조건은 form.formState.errors.nickname을 직접 보므로, 이 에러가 뜨는
    // 순간 (디바운스·서버 조회를 기다릴 필요 없이) 버튼이 비활성 상태가 된다.
    const checkCalled = vi.fn();
    server.use(
      http.get(url(API_ENDPOINTS.auth.nicknameAvailability), ({ request }) => {
        checkCalled(new URL(request.url).searchParams.get('nickname'));
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { available: true }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    // 2자 미만 - 형식(zod) 검증 자체를 통과 못한다
    act(() => {
      result.current.form.setValue('nickname', 'a', { shouldDirty: true, shouldValidate: true });
    });

    await waitFor(() => expect(result.current.form.formState.errors.nickname).toBeTruthy());
    // 형식 오류인 동안엔 가용성 체크(중복 여부)로 넘어가지 않는다
    expect(result.current.isCheckingNickname).toBe(false);
    expect(result.current.hasNicknameError).toBe(false);

    // 디바운스가 정착할 시간을 넉넉히 기다려도 서버에 물어보지 않았어야 한다
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(checkCalled).not.toHaveBeenCalled();
  });

  it('가용한 닉네임이면 디바운스 후 isNicknameAvailable이 true가 된다', async () => {
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.isNicknameAvailable).toBe(true), { timeout: 2000 });
    expect(result.current.form.formState.errors.nickname).toBeFalsy();
  });

  it('가용성 조회 자체가 실패하면(네트워크 오류 등) 저장은 막지 않되 확인됐다고 속이지도 않는다', async () => {
    // 오프라인 등으로 조회 API 자체가 실패하는 상황을 재현한다
    server.use(http.get(url(API_ENDPOINTS.auth.nicknameAvailability), () => HttpResponse.error()));

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });

    // 디바운스가 정착하고 조회 시도까지 끝날 시간을 기다린다
    await waitFor(() => expect(result.current.isCheckingNickname).toBe(false), { timeout: 2000 });

    // "사용 가능"으로 확정된 것처럼 보이면 안 된다 - 그냥 idle이어야 한다
    expect(result.current.isNicknameAvailable).toBe(false);
    expect(result.current.hasNicknameError).toBe(false);
    // 그러면서도 저장 자체는 막지 않는다 (에러도 없음 = 버튼이 비활성화되지 않음)
    expect(result.current.form.formState.errors.nickname).toBeFalsy();
  });

  it('타이핑 중(디바운스 미정착)에는 hasDebounceSettled가 false라 저장 버튼이 비활성 상태가 된다', async () => {
    // 저장 버튼 클릭이 blur를 먼저 유발해 검사가 끝나기 전에 제출되던 1차 버전의 레이스는, 렌더
    // 파생값인 hasDebounceSettled가 타이핑 직후 즉시 false가 되어 버튼이 이미 비활성 상태로
    // 그려지므로 애초에 클릭 자체가 통과하지 못한다 (Bluesky StepHandle과 동일한 방식).
    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));
    expect(result.current.hasDebounceSettled).toBe(true);

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });

    // 타이핑 직후 - 디바운스 타이머가 아직 안 끝났으므로 즉시 false
    expect(result.current.hasDebounceSettled).toBe(false);

    // 디바운스가 정착하면 다시 true로 돌아온다 (검사 완료 여부와 무관)
    await waitFor(() => expect(result.current.hasDebounceSettled).toBe(true), { timeout: 2000 });
  });

  it('닉네임을 바꿨다가 원래 값으로 되돌리면 재조회 없이 idle 상태로 돌아간다', async () => {
    const checkCalled = vi.fn();
    server.use(
      http.get(url(API_ENDPOINTS.auth.nicknameAvailability), ({ request }) => {
        checkCalled(new URL(request.url).searchParams.get('nickname'));
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { available: true }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });
    await waitFor(() => expect(result.current.isNicknameAvailable).toBe(true), { timeout: 2000 });
    expect(checkCalled).toHaveBeenCalledWith('newNick');

    checkCalled.mockClear();

    // 원래 닉네임(testuser)으로 되돌린다
    act(() => {
      result.current.form.setValue('nickname', 'testuser', { shouldDirty: false });
    });

    await waitFor(() => expect(result.current.isNicknameAvailable).toBe(false), { timeout: 2000 });
    expect(result.current.hasNicknameError).toBe(false);
    expect(result.current.isCheckingNickname).toBe(false);
    expect(result.current.form.formState.errors.nickname).toBeFalsy();
    // 원래 값은 자기 자신의 닉네임이므로 서버에 다시 물어보지 않는다
    expect(checkCalled).not.toHaveBeenCalled();
  });

  it('account가 뒤늦게 도착해도(새로고침 등) 하이드레이션은 1회만 일어난다', async () => {
    // beforeEach가 미리 넣어둔 캐시를 지워 "account가 아직 없는" 상태로 마운트한다.
    // setQueryData(key, undefined)는 React Query가 "변경 없음"으로 처리해 캐시가 안
    // 지워지므로 removeQueries를 써야 한다.
    queryClient.removeQueries({ queryKey: ['account'] });

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.form.getValues('nickname')).toBe('');

    // account가 뒤늦게 도착 - 1회차 하이드레이션
    act(() => {
      queryClient.setQueryData(['account'], mockAccount);
    });
    await waitFor(() => expect(result.current.form.getValues('nickname')).toBe('testuser'));

    // 사용자가 아직 저장하지 않은 값을 입력 중인데
    act(() => {
      result.current.form.setValue('nickname', 'inProgress', { shouldDirty: true });
    });

    // 다른 곳(다른 탭 등)에서 계정 정보가 다시 갱신되어도 - 이미 하이드레이션했으므로
    // 사용자가 입력 중인 값을 조용히 덮어쓰지 않는다
    act(() => {
      queryClient.setQueryData(['account'], { ...mockAccount, nickname: 'changedElsewhere' });
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('changedElsewhere'));
    expect(result.current.form.getValues('nickname')).toBe('inProgress');
  });
});
