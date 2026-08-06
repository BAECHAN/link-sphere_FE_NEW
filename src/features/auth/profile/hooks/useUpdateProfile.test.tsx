import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse, delay } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdateProfile } from '@/features/auth/profile/hooks/useUpdateProfile';
import { useMyPageModalStore } from '@/shared/store/mypage.store';
import { mockAccount } from '@/mocks/fixtures/auth.fixtures';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

vi.mock('@/entities/user/api/auth.keys', () => ({
  authInvalidateQueries: { all: vi.fn() },
  authKeys: { root: () => ['auth'], account: () => ['auth', 'account'] },
  authMutationKeys: { updateAccount: ['auth', 'updateAccount'] },
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

describe('useUpdateProfile', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    // QueryClient 캐시에 account 데이터를 직접 주입 → GET 요청 없이 즉시 account 반환
    queryClient.setQueryData(['auth', 'account'], mockAccount);
    // 모달 스토어는 싱글톤이라 이전 테스트의 재오픈 값이 새지 않도록 초기화
    useMyPageModalStore.setState({ restoreValues: null });
  });

  it('초기값이 account 데이터로 세팅된다', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    // useEffect([account, reset])가 실행된 후 form 값이 세팅될 때까지 대기
    await waitFor(() => expect(result.current.form.getValues('nickname')).toBe('testuser'));
    expect(result.current.account?.nickname).toBe('testuser');
  });

  it('이미지 파일 선택 시 avatarPreview가 blob URL로 업데이트된다', () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });

    act(() => {
      result.current.handleAvatarChange(file);
    });

    expect(result.current.avatarPreview).toBe('blob:mock-url');
  });

  it('파일이 30MB를 넘으면 업로드 시도 없이 즉시 거부하고 미리보기를 바꾸지 않는다', () => {
    const { result } = renderHook(() => useUpdateProfile(), {
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

  it('제출 시 서버 응답을 기다리지 않고 즉시 onSuccess가 호출된다 (모달 즉시 닫힘)', async () => {
    // PATCH 응답을 영원히 지연시켜, onSuccess가 응답과 무관하게 먼저 불리는지 확인한다
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async () => {
        await delay('infinite');
      })
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProfile(onSuccess), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick');
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    // 응답이 절대 오지 않는 상황에서도 onSuccess는 이미 호출되어 있어야 한다
    expect(onSuccess).toHaveBeenCalled();
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

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProfile(onSuccess), {
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

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProfile(onSuccess), {
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

    // onSuccess는 제출 즉시 호출되므로 응답을 기다리지 않고 먼저 확인할 수 있다
    expect(onSuccess).toHaveBeenCalled();

    await waitFor(() => {
      expect(signUrlCalled).toHaveBeenCalled();
      expect(uploadCalled).toHaveBeenCalled();
      expect(patchCalled).toHaveBeenCalledWith(
        expect.objectContaining({ image: 'https://example.com/new-avatar.png' })
      );
    });
  });

  it('타이핑을 멈추면 디바운스 후 가용성 검사가 실행되고, 사용 중인 닉네임이면 인라인 오류를 띄운다', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
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

    const { result } = renderHook(() => useUpdateProfile(), {
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
    const { result } = renderHook(() => useUpdateProfile(), {
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

    const { result } = renderHook(() => useUpdateProfile(), {
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
    const { result } = renderHook(() => useUpdateProfile(), {
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

    const { result } = renderHook(() => useUpdateProfile(), {
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
});
