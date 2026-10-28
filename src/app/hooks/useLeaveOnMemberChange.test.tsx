import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useAuthStore } from '@/shared/store/auth.store';
import { hasUnsavedChanges, useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { useLeaveOnMemberChange } from '@/app/hooks/useLeaveOnMemberChange';

const navigateSpy = vi.fn();
let currentAccount: { id: string } | undefined;

vi.mock('@/entities/account/hooks/useAccount', () => ({
  useAccount: () => ({ account: currentAccount }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const DIRTY_KEY = 'post-create';
const PUBLIC_PATH = '/post/post-1';

/**
 * 인증 상태와 그때 보이는 계정을 차례로 바꿔 가며 다시 렌더한다. 계정 undefined는 계정 캐시가 없는 상태다 - 보호 화면에
 * 그대로 둔 동안(inPlace)은 캐시를 남기므로 이전 회원 계정이 그대로 보인다.
 */
type Step =
  | { auth: 'signedIn'; member: string | undefined }
  | { auth: 'inPlace'; member: string | undefined }
  | { auth: 'signedOut' };

function applyStep(step: Step) {
  const store = useAuthStore.getState();

  if (step.auth === 'signedIn') {
    store.setAuth('token');
  } else if (step.auth === 'inPlace') {
    store.expireSession(window.location.pathname);
  } else {
    store.clearAuth();
  }

  currentAccount = step.auth !== 'signedOut' && step.member ? { id: step.member } : undefined;
}

function renderWithSteps(first: Step, ...rest: Step[]) {
  applyStep(first);
  const { rerender } = renderHook(() => useLeaveOnMemberChange());

  rest.forEach((step) => {
    act(() => {
      applyStep(step);
    });
    rerender();
  });

  return { rerender };
}

describe('useLeaveOnMemberChange', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    window.history.replaceState(null, '', PUBLIC_PATH);
  });

  afterEach(() => {
    currentAccount = undefined;
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    useAuthStore.getState().clearAuth();
    window.history.replaceState(null, '', '/');
  });

  it('그 자리에 둔 채 쓰던 중 다른 회원으로 로그인하면 쓰던 글의 등록을 비우고 피드로 간다', () => {
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'inPlace', member: undefined },
      { auth: 'signedIn', member: undefined },
      { auth: 'signedIn', member: 'member-b' }
    );

    expect(hasUnsavedChanges()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
  });

  it('같은 회원으로 다시 로그인하면 그대로 둔다 - 이어서 쓴다', () => {
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'inPlace', member: undefined },
      { auth: 'signedIn', member: 'member-a' }
    );

    expect(hasUnsavedChanges()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('비로그인으로 쓰다가 처음 로그인한 경우는 비교할 이전 회원이 없어 그대로 둔다', () => {
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    renderWithSteps({ auth: 'signedOut' }, { auth: 'signedIn', member: 'member-a' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('공개 화면에서 쓰는 중이 아니면 다른 회원으로 바뀌어도 옮기지 않는다', () => {
    renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'signedIn', member: 'member-b' }
    );

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('보호 화면에 둔 채 다른 회원으로 로그인하면 쓰는 중이 아니어도 피드로 간다 - 남겨 둔 캐시는 이전 회원의 것이다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);

    renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'inPlace', member: 'member-a' },
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'signedIn', member: 'member-b' }
    );

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
  });

  it('보호 화면에 둔 채 쓰던 중 다른 회원으로 로그인하면 쓰던 글의 등록을 비우고 피드로 간다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'inPlace', member: 'member-a' },
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'signedIn', member: 'member-b' }
    );

    expect(hasUnsavedChanges()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
  });

  it('평소대로 로그아웃한 뒤 비로그인으로 새로 쓴 글은 다른 계정으로 로그인해도 버리지 않는다', () => {
    const { rerender } = renderWithSteps(
      { auth: 'signedIn', member: 'member-a' },
      { auth: 'signedOut' }
    );
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    act(() => {
      applyStep({ auth: 'signedIn', member: 'member-b' });
    });
    rerender();

    expect(hasUnsavedChanges()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
