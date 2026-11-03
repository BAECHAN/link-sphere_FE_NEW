import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, userEvent } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { FolderTree } from '@/widgets/bookmark/folder-tree/ui/FolderTree';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const serverError = () =>
  HttpResponse.json(
    { status: 500, message: 'server error', data: null, timestamp: '' },
    { status: 500 }
  );

function renderFolderTree() {
  return renderWithProviders(<FolderTree selectedKey="all" onSelect={vi.fn()} />, {
    wrapperOptions: { initialEntries: ['/bookmark'] },
  });
}

describe('FolderTree — 폴더 목록을 받지 못했을 때', () => {
  it('폴더 자리에 안내와 다시 시도를 두고, 목록 없이 되는 항목은 그대로 쓸 수 있다', async () => {
    server.use(http.get(url(API_ENDPOINTS.bookmark.folders), serverError));
    renderFolderTree();

    expect(await screen.findByText(TEXTS.bookmark.folder.listLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTS.buttons.retry })).toBeEnabled();
    // 개수를 모르니 감춘다 - 이름이 정확히 '미분류'뿐이다
    expect(screen.getByRole('button', { name: TEXTS.bookmark.folder.uncategorized })).toBeEnabled();
    expect(screen.getByRole('button', { name: TEXTS.bookmark.folder.all })).toBeEnabled();
    expect(screen.getByRole('button', { name: TEXTS.bookmark.folder.create })).toBeEnabled();
    // 1안(2026-11-03 사용자 선택) - "내 폴더" 라벨은 폴더가 있을 때만 보이는 조건 그대로다
    expect(screen.queryByText(TEXTS.bookmark.folder.myFolders)).not.toBeInTheDocument();
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
    renderFolderTree();

    await user.click(await screen.findByRole('button', { name: TEXTS.buttons.retry }));

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    expect(screen.queryByText(TEXTS.bookmark.folder.listLoadFailed)).not.toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it('오프라인이라 요청이 멈춘 동안은 스피너를 보이고, 다시 연결되면 목록을 받는다', async () => {
    onlineManager.setOnline(false);

    try {
      renderFolderTree();

      // 빈 목록처럼 보이지 않게 첫 로딩과 같은 스피너(DelayedFallback 500ms 뒤)를 보인다
      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByText(TEXTS.bookmark.folder.listLoadFailed)).not.toBeInTheDocument();
    } finally {
      act(() => {
        onlineManager.setOnline(true);
      });
    }

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
