import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { VersionPage } from '@/pages/version/VersionPage';
import { BUILD_INFO } from '@/shared/config/build-info';
import { TEXTS } from '@/shared/config/texts';

const ENTRY_SRC = '/assets/js/index-current.js';
const DEPLOYED_ENTRY_SRC = '/assets/js/index-deployed.js';

function mockVersionJson(sha: string) {
  server.use(
    http.get('*/version.json', () =>
      HttpResponse.json({
        sha,
        ref: 'main',
        mode: 'production',
        runNumber: '42',
        runId: '1234567890',
        builtAt: '2026-09-20T06:55:48.340Z',
      })
    )
  );
}

/** useDeployedBuildInfo가 내부적으로 GET /index.html도 부른다(entry script 조회). */
function mockDeployedIndexHtml(entrySrc: string) {
  server.use(
    http.get(
      '*/index.html',
      () =>
        new HttpResponse(
          `<html><head><script type="module" src="${entrySrc}"></script></head></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
    )
  );
}

describe('VersionPage', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    document.head.innerHTML = `<script type="module" src="${ENTRY_SRC}"></script>`;
    mockDeployedIndexHtml(DEPLOYED_ENTRY_SRC);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
  });

  it('로드된 빌드 sha 단축형과 진입 스크립트를 렌더한다', () => {
    mockVersionJson(BUILD_INFO.sha);
    renderWithProviders(<VersionPage />);

    expect(screen.getByText(BUILD_INFO.sha.slice(0, 7))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ENTRY_SRC))).toBeInTheDocument();
  });

  it('서버 sha가 로드된 sha와 같으면 동기화 배너를 보여주고, 배포된 빌드의 진입 스크립트도 함께 보여준다', async () => {
    mockVersionJson(BUILD_INFO.sha);
    renderWithProviders(<VersionPage />);

    await waitFor(() => {
      expect(screen.getByText(TEXTS.version.bannerMatch)).toBeInTheDocument();
    });
    expect(screen.getByText(new RegExp(DEPLOYED_ENTRY_SRC))).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.version.viewChanges)).not.toBeInTheDocument();
  });

  it('서버 sha가 다르면 불일치 배너와 compare 링크·새로고침 버튼을 보여준다', async () => {
    mockVersionJson('deadbeef1234567890');
    renderWithProviders(<VersionPage />);

    await waitFor(() => {
      expect(screen.getByText(TEXTS.version.bannerMismatch)).toBeInTheDocument();
    });

    const compareLink = screen.getByText(TEXTS.version.viewChanges);
    expect(compareLink).toHaveAttribute(
      'href',
      `https://github.com/BAECHAN/link-sphere_FE_NEW/compare/${BUILD_INFO.sha}...deadbeef1234567890`
    );
    expect(screen.getByText(TEXTS.version.reload)).toBeInTheDocument();
  });

  it('서버 빌드 조회에 실패하면 확인 불가 배너를 보여주고 화면이 깨지지 않는다', async () => {
    server.use(http.get('*/version.json', () => HttpResponse.error()));
    renderWithProviders(<VersionPage />);

    await waitFor(() => {
      expect(screen.getByText(TEXTS.version.checkFailedNotice)).toBeInTheDocument();
    });
    expect(screen.queryByText(TEXTS.version.bannerMatch)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTS.version.bannerMismatch)).not.toBeInTheDocument();
    // 비교할 서버 빌드가 없으니 compare 링크·새로고침 버튼도 없다
    expect(screen.queryByText(TEXTS.version.viewChanges)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTS.version.reload)).not.toBeInTheDocument();
  });
});
