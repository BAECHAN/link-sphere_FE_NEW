import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { HttpResponse, http as mswHttp } from 'msw';
import { API_BASE_URL } from '@/shared/config/api';
import { useLogin } from '@/features/auth/login/hooks/useLogin';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const SAVED_KEY = STORAGE_KEYS.AUTH.SAVED_EMAIL;

function renderLogin(options?: {
  state?: { email?: string } | null;
  onInputDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = createTestQueryClient();
  const entry = { pathname: '/login', state: options?.state ?? null };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return renderHook(
    () => ({
      login: useLogin({ onInputDirtyChange: options?.onInputDirtyChange }),
      navigate: useNavigate(),
    }),
    { wrapper: Wrapper }
  );
}

describe('useLogin', () => {
  beforeEach(() => {
    LocalStorageUtil.clear();
  });

  describe('초기 값', () => {
    it('저장된 이메일도 넘어온 이메일도 없으면 빈 폼에 이메일 저장은 꺼져 있다', () => {
      const { result } = renderLogin();

      expect(result.current.login.form.getValues()).toEqual({
        email: '',
        password: '',
        saveEmail: false,
      });
    });

    it('저장된 이메일이 있으면 이메일을 채우고 이메일 저장을 켠다', () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'saved@example.com');

      const { result } = renderLogin();

      expect(result.current.login.form.getValues()).toEqual({
        email: 'saved@example.com',
        password: '',
        saveEmail: true,
      });
    });

    it('다른 화면에서 넘어온 이메일은 저장된 이메일보다 우선한다', () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'saved@example.com');

      const { result } = renderLogin({ state: { email: 'arrived@example.com' } });

      expect(result.current.login.form.getValues('email')).toBe('arrived@example.com');
      expect(result.current.login.form.getValues('saveEmail')).toBe(true);
    });

    it('이메일이 넘어왔어도 저장된 이메일이 없으면 이메일 저장은 꺼져 있다', () => {
      const { result } = renderLogin({ state: { email: 'arrived@example.com' } });

      expect(result.current.login.form.getValues('email')).toBe('arrived@example.com');
      expect(result.current.login.form.getValues('saveEmail')).toBe(false);
    });

    it('넘어온 이메일이 빈 문자열이면 저장된 이메일을 쓴다', () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'saved@example.com');

      const { result } = renderLogin({ state: { email: '' } });

      expect(result.current.login.form.getValues('email')).toBe('saved@example.com');
    });
  });

  describe('입력 여부 알림', () => {
    it('아무것도 입력하지 않았으면 입력이 없다고 알린다', () => {
      const onInputDirtyChange = vi.fn();

      renderLogin({ onInputDirtyChange });

      expect(onInputDirtyChange).toHaveBeenLastCalledWith(false);
      expect(onInputDirtyChange).not.toHaveBeenCalledWith(true);
    });

    it('저장된 이메일로 미리 채워진 값은 입력으로 보지 않는다', () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'saved@example.com');
      const onInputDirtyChange = vi.fn();

      renderLogin({ onInputDirtyChange });

      expect(onInputDirtyChange).not.toHaveBeenCalledWith(true);
    });

    it('넘어온 이메일로 미리 채워진 값은 입력으로 보지 않는다', () => {
      const onInputDirtyChange = vi.fn();

      renderLogin({ state: { email: 'arrived@example.com' }, onInputDirtyChange });

      expect(onInputDirtyChange).not.toHaveBeenCalledWith(true);
      expect(onInputDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it('이메일을 바꾸면 입력이 있다고 알리고, 기본값으로 되돌리면 없다고 알린다', async () => {
      const onInputDirtyChange = vi.fn();
      const { result } = renderLogin({ onInputDirtyChange });

      act(() => {
        result.current.login.form.setValue('email', 'typed@example.com', { shouldDirty: true });
      });
      await waitFor(() => expect(onInputDirtyChange).toHaveBeenLastCalledWith(true));

      act(() => {
        result.current.login.form.setValue('email', '', { shouldDirty: true });
      });
      await waitFor(() => expect(onInputDirtyChange).toHaveBeenLastCalledWith(false));
    });

    it('비밀번호만 입력해도 입력이 있다고 알린다', async () => {
      const onInputDirtyChange = vi.fn();
      const { result } = renderLogin({ onInputDirtyChange });

      act(() => {
        result.current.login.form.setValue('password', 'secret', { shouldDirty: true });
      });

      await waitFor(() => expect(onInputDirtyChange).toHaveBeenLastCalledWith(true));
    });

    it('이메일 저장 체크박스만 바꾸면 입력으로 보지 않는다', async () => {
      const onInputDirtyChange = vi.fn();
      const { result } = renderLogin({ onInputDirtyChange });

      act(() => {
        result.current.login.form.setValue('saveEmail', true, { shouldDirty: true });
      });

      await waitFor(() =>
        expect(result.current.login.form.formState.dirtyFields.saveEmail).toBe(true)
      );
      expect(onInputDirtyChange).not.toHaveBeenCalledWith(true);
    });

    it('콜백을 넘기지 않아도 입력해도 오류 없이 동작한다', async () => {
      const { result } = renderLogin();

      act(() => {
        result.current.login.form.setValue('password', 'secret', { shouldDirty: true });
      });

      await waitFor(() =>
        expect(result.current.login.form.formState.dirtyFields.password).toBe(true)
      );
    });
  });

  describe('같은 화면에서 이메일이 다시 넘어올 때', () => {
    it('입력 중이 아니면 새 이메일로 채우고 입력으로 보지 않는다', async () => {
      const onInputDirtyChange = vi.fn();
      const { result } = renderLogin({ onInputDirtyChange });
      // 화면에서는 입력창이 register로 연결돼 있다
      result.current.login.form.register('email');

      act(() => {
        result.current.navigate('/login', { state: { email: 'later@example.com' } });
      });

      await waitFor(() =>
        expect(result.current.login.form.getValues('email')).toBe('later@example.com')
      );
      expect(result.current.login.form.formState.dirtyFields.email).toBeFalsy();
      expect(onInputDirtyChange).not.toHaveBeenCalledWith(true);
    });

    it('입력 중이면 입력한 값을 덮어쓰지 않는다', async () => {
      const { result } = renderLogin();
      result.current.login.form.register('email');

      act(() => {
        result.current.login.form.setValue('password', 'secret', { shouldDirty: true });
      });
      await waitFor(() =>
        expect(result.current.login.form.formState.dirtyFields.password).toBe(true)
      );

      act(() => {
        result.current.navigate('/login', { state: { email: 'later@example.com' } });
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.login.form.getValues('email')).toBe('');
      expect(result.current.login.form.getValues('password')).toBe('secret');
    });
  });

  describe('제출', () => {
    it('이메일과 비밀번호만 서버로 보낸다', async () => {
      let body: unknown;
      server.use(
        http.post('/auth/login', async ({ request }) => {
          body = await request.json();

          return MockEnvelopeUtil.json(mockLoginResponse);
        })
      );
      const { result } = renderLogin();

      await act(async () => {
        await result.current.login.onSubmit({
          email: 'user@example.com',
          password: 'pw-1234!',
          saveEmail: true,
        });
      });

      expect(body).toEqual({ email: 'user@example.com', password: 'pw-1234!' });
    });

    it('이메일 저장을 켜고 로그인하면 이메일을 저장한다', async () => {
      const { result } = renderLogin();

      await act(async () => {
        await result.current.login.onSubmit({
          email: 'user@example.com',
          password: 'pw-1234!',
          saveEmail: true,
        });
      });

      expect(LocalStorageUtil.getItem<string>(SAVED_KEY)).toBe('user@example.com');
    });

    it('이메일 저장을 끄고 로그인하면 저장돼 있던 이메일을 지운다', async () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'old@example.com');
      const { result } = renderLogin();

      await act(async () => {
        await result.current.login.onSubmit({
          email: 'user@example.com',
          password: 'pw-1234!',
          saveEmail: false,
        });
      });

      expect(LocalStorageUtil.getItem<string>(SAVED_KEY)).toBeNull();
    });

    it('폼으로 제출하면 이메일 저장 체크 상태가 반영된다', async () => {
      const { result } = renderLogin();

      act(() => {
        result.current.login.form.setValue('email', 'user@example.com');
        result.current.login.form.setValue('password', 'pw-1234!');
        result.current.login.form.setValue('saveEmail', true);
      });

      await act(async () => {
        await result.current.login.form.handleSubmit(result.current.login.onSubmit)();
      });

      expect(LocalStorageUtil.getItem<string>(SAVED_KEY)).toBe('user@example.com');
    });

    it('로그인에 실패하면 오류를 던지고 이메일을 저장하거나 지우지 않는다', async () => {
      LocalStorageUtil.setItem(SAVED_KEY, 'old@example.com');
      server.use(
        mswHttp.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({ message: 'unauthorized' }, { status: 401 });
        })
      );
      const { result } = renderLogin();

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.login.onSubmit({
            email: 'new@example.com',
            password: 'wrong',
            saveEmail: true,
          });
        } catch (error) {
          thrown = error;
        }
      });

      expect(thrown).toBeDefined();
      expect(LocalStorageUtil.getItem<string>(SAVED_KEY)).toBe('old@example.com');
    });

    it('요청이 진행 중인 동안에만 대기 상태가 된다', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post('/auth/login', async () => {
          await gate;

          return MockEnvelopeUtil.json(mockLoginResponse);
        })
      );
      const { result } = renderLogin();

      expect(result.current.login.isPending).toBe(false);

      let submitting: Promise<void> = Promise.resolve();
      act(() => {
        submitting = result.current.login.onSubmit({
          email: 'user@example.com',
          password: 'pw-1234!',
          saveEmail: false,
        });
      });
      await waitFor(() => expect(result.current.login.isPending).toBe(true));

      await act(async () => {
        release();
        await submitting;
      });
      await waitFor(() => expect(result.current.login.isPending).toBe(false));
    });
  });
});
