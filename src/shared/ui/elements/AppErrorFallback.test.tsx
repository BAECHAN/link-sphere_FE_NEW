import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { chunkReloadKey } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';
import { KO_UI_TEXTS } from '@baechan/ui/texts/ko-ui-texts';

const PATHNAME = '/post';
const CHUNK_ERROR = new TypeError(
  'Failed to fetch dynamically imported module: https://linksphere.click/assets/js/PostPage-abc.js'
);

// ChunkReloadUtil의 "이 페이지에서 새로고침을 걸었다"는 모듈 변수라 테스트마다 모듈을 새로 불러 격리한다.
// 문구 Provider도 같은 모듈 그래프에서 가져와 감싼다 - 새로 불린 부품은 새 컨텍스트 객체를 읽으므로
// 먼저 불린 Provider(@/test/utils의 render)로는 문구가 닿지 않는다
async function loadAppErrorFallback() {
  vi.resetModules();
  const { AppErrorFallback } = await import('@/shared/ui/elements/AppErrorFallback');
  const { UiTextsProvider } = await import('@baechan/ui/texts/UiTextsProvider');

  return function AppErrorFallbackWithUiTexts(props: { error: unknown }) {
    return (
      <UiTextsProvider texts={KO_UI_TEXTS}>
        <AppErrorFallback {...props} />
      </UiTextsProvider>
    );
  };
}

describe('AppErrorFallback', () => {
  const reload = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { ...window.location, pathname: PATHNAME, reload, replace });
  });

  afterEach(() => {
    reload.mockReset();
    replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('청크 로드 실패가 처음이면 안내 화면 없이 한 번 새로고침한다', async () => {
    const AppErrorFallback = await loadAppErrorFallback();

    render(<AppErrorFallback error={CHUNK_ERROR} />);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TEXTS.errors.unexpected.title)).toBeNull();
  });

  it('이미 새로고침한 경로에서 또 실패하면 스피너 대신 안내 화면과 홈 버튼을 보여준다', async () => {
    sessionStorage.setItem(chunkReloadKey(PATHNAME), '1');
    const AppErrorFallback = await loadAppErrorFallback();

    render(<AppErrorFallback error={CHUNK_ERROR} />);

    expect(screen.getByText(TEXTS.errors.unexpected.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTS.buttons.home })).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('5xx면 서버 에러 페이지로 이동한다', async () => {
    const AppErrorFallback = await loadAppErrorFallback();
    // 모듈을 새로 불렀으니 ApiError도 같은 모듈 그래프에서 가져와야 instanceof 판별이 맞는다
    const { ApiError } = await import('@/shared/types/common.type');

    render(
      <AppErrorFallback
        error={new ApiError({ status: 503, code: 'ERR', message: 'unavailable', timestamp: '' })}
      />
    );

    expect(replace).toHaveBeenCalledWith(ROUTES_PATHS.SERVER_ERROR);
    expect(screen.queryByText(TEXTS.errors.unexpected.title)).toBeNull();
  });

  it('그 외 에러는 새로고침 없이 안내 화면을 보여준다', async () => {
    const AppErrorFallback = await loadAppErrorFallback();

    render(<AppErrorFallback error={new Error('예상치 못한 오류')} />);

    expect(screen.getByText(TEXTS.errors.unexpected.title)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
