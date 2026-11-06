import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, userEvent } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { MobileFolderList } from '@/widgets/bookmark/folder-nav/ui/MobileFolderList';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const serverError = () =>
  HttpResponse.json(
    { status: 500, message: 'server error', data: null, timestamp: '' },
    { status: 500 }
  );

function renderMobileFolderList() {
  return renderWithProviders(<MobileFolderList onSelect={vi.fn()} />, {
    wrapperOptions: { initialEntries: ['/bookmark'] },
  });
}

describe('MobileFolderList — 폴더 목록을 받지 못했을 때', () => {
  it('"내 폴더" 아래에 안내와 다시 시도를 두고, 새 폴더 카드는 그대로 둔다', async () => {
    server.use(http.get(url(API_ENDPOINTS.bookmark.folders), serverError));
    renderMobileFolderList();

    expect(await screen.findByText(TEXTS.bookmark.folder.listLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTS.buttons.retry })).toBeEnabled();
    expect(screen.getByText(TEXTS.bookmark.folder.myFolders)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.bookmark.folder.new)).toBeInTheDocument();
    // 개수를 모르니 감춘다 - 이름이 정확히 '미분류'뿐이다
    expect(screen.getByRole('button', { name: TEXTS.bookmark.folder.uncategorized })).toBeEnabled();
  });

  it('다시 시도를 누르면 목록을 다시 받아 보여 준다', async () => {
    const user = userEvent.setup();
    let requests = 0;
    server.use(
      http.get(url(API_ENDPOINTS.bookmark.folders), () => {
        requests += 1;

        if (requests === 1) {
          return serverError();
        }

        return HttpResponse.json(
          { status: 200, message: 'ok', data: mockBookmarkFolderListResponse, timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderMobileFolderList();

    await user.click(await screen.findByRole('button', { name: TEXTS.buttons.retry }));

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    expect(screen.queryByText(TEXTS.bookmark.folder.listLoadFailed)).not.toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it('오프라인이라 요청이 멈춘 동안은 스피너를 보이고, 다시 연결되면 목록을 받는다', async () => {
    onlineManager.setOnline(false);

    try {
      renderMobileFolderList();

      // 폴더 0개처럼 "새 폴더" 카드만 보이지 않게 첫 로딩과 같은 스피너(DelayedFallback 500ms 뒤)를 보인다
      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByText(TEXTS.bookmark.folder.new)).not.toBeInTheDocument();
    } finally {
      act(() => {
        onlineManager.setOnline(true);
      });
    }

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
