import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { TEXTS } from '@/shared/config/texts';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';

// "조건 N개 적용 중" 카운트는 URL 파라미터·검색어 토큰을 조합해 파생되는 값이라,
// 눈에 안 보이는 예외(레거시 필터·이중집계·localStorage 설정)가 조용히 회귀하기 쉽다.

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function renderSearch(initialEntry: string) {
  return renderWithProviders(<PostListSearch />, {
    wrapperOptions: { queryClient, initialEntries: [initialEntry] },
  });
}

beforeEach(() => {
  queryClient.clear();
  useHideBotsStore.setState({ hideBots: false });
  server.use(
    http.get(url(API_ENDPOINTS.common.categoryOption), () =>
      HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: [{ id: 1, name: '백엔드', slug: 'backend', sortOrder: 0, createdAt: '2025-01-01' }],
          timestamp: '',
        },
        { status: 200 }
      )
    )
  );
});

afterEach(() => {
  queryClient.clear();
});

describe('PostListSearch — 조건 N개 적용 중 카운트', () => {
  it('옛 공유 링크의 레거시 필터(?filter=excludeBots)는 카운트에 안 잡히고 초기화 버튼이 비활성화된다', async () => {
    renderSearch('/?filter=excludeBots');

    const resetButton = await screen.findByRole('button', { name: TEXTS.buttons.reset });

    expect(screen.queryByText(/조건 \d+개 적용 중/)).not.toBeInTheDocument();
    expect(resetButton).toBeDisabled();
  });

  it('@카테고리만 있는 검색어는 카운트 1로 잡힌다 (카테고리+키워드 이중집계 안 됨)', async () => {
    renderSearch('/?q=%40%EB%B0%B1%EC%97%94%EB%93%9C');

    await waitFor(() =>
      expect(screen.getByText(TEXTS.post.search.appliedCount(1))).toBeInTheDocument()
    );
  });

  it('봇 글 숨기기는 localStorage 개인 설정이라 켜도 카운트가 오르지 않는다', async () => {
    const user = userEvent.setup();
    renderSearch('/');

    expect(screen.queryByText(/조건 \d+개 적용 중/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(TEXTS.buttons.hideBots));

    await waitFor(() => expect(useHideBotsStore.getState().hideBots).toBe(true));
    expect(screen.queryByText(/조건 \d+개 적용 중/)).not.toBeInTheDocument();
  });
});
