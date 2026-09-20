import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from 'next-themes';
import { renderWithProviders, userEvent } from '@/test/utils';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';
import { Navbar } from '@/widgets/layout/navbar/ui/Navbar';

// sonner.tsx:9가 useTheme()으로 읽는 값은 화면에 안 보이므로, DOM의 .dark와 어긋났던
// 버그를 단언하기 위한 테스트 전용 프로브. NavbarSearch.test.tsx의 LocationSearchProbe 패턴.
function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();

  return <div data-testid="theme-probe">{`${theme}/${resolvedTheme}`}</div>;
}

// main.tsx:22-27과 동일한 설정으로 감싼다 - renderWithProviders에는 ThemeProvider가 없다.
// widgets 레이어는 app 레이어(src/app/providers/ThemeProvider.tsx)를 import할 수 없어
// (ESLint 레이어 규칙) 그 래퍼가 그대로 전달하는 next-themes의 ThemeProvider를 직접 쓴다.
function renderNavbar() {
  return renderWithProviders(
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={STORAGE_KEYS.THEME}
    >
      <Navbar />
      <ThemeProbe />
    </ThemeProvider>,
    { wrapperOptions: { initialEntries: ['/post'] } }
  );
}

// setup.ts는 localStorage를 비우지 않고, cleanup()은 documentElement를 되돌리지 않는다
// (storage.util.test.ts와 같은 이유로 테스트 파일이 직접 정리한다)
afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});

describe('Navbar — 테마 토글', () => {
  it('토글하면 선택이 localStorage에 저장돼 새로고침 후에도 살아남는다', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: TEXTS.nav.toggleTheme }));

    // 수정 전에는 null - classList만 만지고 next-themes를 거치지 않았다
    expect(window.localStorage.getItem(STORAGE_KEYS.THEME)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('토글 후 useTheme() 값과 <html> 클래스가 같은 테마를 가리킨다', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: TEXTS.nav.toggleTheme }));

    // 수정 전에는 'system/light' - 토스트만 반대 테마로 뜨던 원인
    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark/dark');
  });

  it('다시 누르면 라이트로 돌아간다', async () => {
    const user = userEvent.setup();
    renderNavbar();
    const toggle = screen.getByRole('button', { name: TEXTS.nav.toggleTheme });

    await user.click(toggle);
    // useClickGuard(8ms, useClickGuard.ts)가 사람이 낼 수 없는 속도의 채터링성
    // 재클릭만 걸러낸다 - 사람의 실제 재클릭(수십ms 이상)은 이 정도만 지나도 통과한다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await user.click(toggle);

    expect(window.localStorage.getItem(STORAGE_KEYS.THEME)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('OS가 다크면 첫 클릭이 라이트로 간다 (theme이 아니라 resolvedTheme 기준)', async () => {
    // setup.ts는 matches:false 고정이라 OS 다크 경로를 못 탄다.
    // vi.unstubAllGlobals()는 setup.ts의 IntersectionObserver/ResizeObserver 스텁까지
    // 같이 걷어내므로 쓰지 않고, 이 케이스에서만 matchMedia를 다시 씌운다.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: TEXTS.nav.toggleTheme }));

    expect(window.localStorage.getItem(STORAGE_KEYS.THEME)).toBe('light');
  });
});
