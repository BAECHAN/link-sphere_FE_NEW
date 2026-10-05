import { describe, expect, it } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { PostDetailPage } from '@/pages/post/PostDetailPage';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

const DELETED_POST_PATH = '/post/deleted-post-id';

function mockPostDetailNotFound() {
  server.use(
    http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, () =>
      HttpResponse.json(
        {
          status: 404,
          code: 'POST_NOT_FOUND',
          message: 'not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    )
  );
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

function renderPostDetail() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route path={ROUTES_PATHS.POST.ROOT} element={<div>post list</div>} />
      </Routes>
      <LocationProbe />
    </>,
    { wrapperOptions: { initialEntries: [DELETED_POST_PATH] } }
  );
}

describe('PostDetailPage - 삭제·비공개 포스트(404)', () => {
  it('주소를 그대로 둔 채 안내 화면을 보여준다', async () => {
    mockPostDetailNotFound();
    renderPostDetail();

    expect(await screen.findByText(TEXTS.post.detail.notFound.title)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.post.detail.notFound.description)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(DELETED_POST_PATH);
  });

  it('안내 화면이 떠 있는 동안 noindex 메타를 단다', async () => {
    mockPostDetailNotFound();
    renderPostDetail();

    await screen.findByText(TEXTS.post.detail.notFound.title);

    expect(document.head.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull();
  });

  it('목록으로 링크를 누르면 포스트 목록으로 이동한다', async () => {
    mockPostDetailNotFound();
    const user = userEvent.setup();
    renderPostDetail();

    await user.click(await screen.findByRole('link', { name: TEXTS.post.detail.backToList }));

    expect(screen.getByTestId('location')).toHaveTextContent(ROUTES_PATHS.POST.ROOT);
    expect(document.head.querySelector('meta[name="robots"][content="noindex"]')).toBeNull();
  });
});
