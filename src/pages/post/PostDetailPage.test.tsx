import { describe, expect, it } from 'vitest';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { PostDetailPage } from '@/pages/post/PostDetailPage';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';

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

describe('PostDetailPage - 탭 제목', () => {
  it('글 제목을 탭 제목으로 쓰고, 상세를 떠나면 원래 제목으로 되돌린다', async () => {
    document.title = 'Link Sphere';
    const user = userEvent.setup();
    // renderWithProviders에는 TooltipProvider가 없다 - 카드의 TooltipWrapper가 요구해 직접 감싼다
    renderWithProviders(
      <TooltipProvider>
        <Routes>
          <Route path="/post/:id" element={<PostDetailPage />} />
          <Route path={ROUTES_PATHS.POST.ROOT} element={<div>post list</div>} />
        </Routes>
      </TooltipProvider>,
      { wrapperOptions: { initialEntries: [`/post/${mockPost.id}`] } }
    );

    await screen.findByText(mockPost.title);

    expect(document.title).toBe(TEXTS.post.detail.documentTitle(mockPost.title));

    // 앱 내 이력 없이 들어왔으므로 돌아가기 버튼이 목록으로 replace한다(useGoBack)
    await user.click(screen.getByRole('button', { name: TEXTS.post.detail.backToList }));

    expect(await screen.findByText('post list')).toBeInTheDocument();
    expect(document.title).toBe('Link Sphere');
  });

  // 알림 클릭처럼 상세에서 다른 상세로 가면 같은 컴포넌트가 남아 있어, 탭 제목이 바뀐 글을 따라가야 한다
  it('상세가 떠 있는 채로 다른 글로 가면 탭 제목도 그 글 제목으로 바뀐다', async () => {
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, ({ params }) =>
        HttpResponse.json({
          status: 200,
          message: 'ok',
          data: {
            ...mockPost,
            id: String(params['id']),
            title: `title of ${String(params['id'])}`,
          },
          timestamp: '',
        })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider>
        <Routes>
          <Route path="/post/:id" element={<PostDetailPage />} />
        </Routes>
        <Link to="/post/next-post">next</Link>
      </TooltipProvider>,
      { wrapperOptions: { initialEntries: ['/post/first-post'] } }
    );

    await screen.findByText('title of first-post');
    await user.click(screen.getByRole('link', { name: 'next' }));
    await screen.findByText('title of next-post');

    expect(document.title).toBe(TEXTS.post.detail.documentTitle('title of next-post'));
  });
});

describe('PostDetailPage - 썸네일', () => {
  const OG_IMAGE = 'https://example.com/og.png';

  // 상세 썸네일이 이 페이지의 LCP 요소다 - lazy면 레이아웃이 끝난 뒤에야 요청을 시작한다
  it('썸네일을 지연 로딩하지 않고 높은 우선순위로 요청한다', async () => {
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, ({ params }) =>
        HttpResponse.json({
          status: 200,
          message: 'ok',
          data: { ...mockPost, id: String(params['id']), ogImage: OG_IMAGE },
          timestamp: '',
        })
      )
    );
    // renderWithProviders에는 TooltipProvider가 없다 - 카드의 TooltipWrapper가 요구해 직접 감싼다
    renderWithProviders(
      <TooltipProvider>
        <Routes>
          <Route path="/post/:id" element={<PostDetailPage />} />
        </Routes>
      </TooltipProvider>,
      { wrapperOptions: { initialEntries: [`/post/${mockPost.id}`] } }
    );

    await screen.findByText(mockPost.title);
    const thumbnail = document.querySelector(`img[src="${OG_IMAGE}"]`);

    expect(thumbnail).toHaveAttribute('loading', 'eager');
    expect(thumbnail).toHaveAttribute('fetchpriority', 'high');
  });
});

// 알림 클릭처럼 상세에서 다른 상세로 가면 같은 컴포넌트가 남아 있어, 앞 글의 에러 화면이 다음 글에 남으면 안 된다
describe('PostDetailPage - 조회 실패 뒤 다른 글로 이동', () => {
  it('앞 글 조회가 실패했어도 다른 글로 가면 그 글을 보여준다', async () => {
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, ({ params }) => {
        if (params['id'] === 'failed-post') {
          return HttpResponse.json(
            { status: 500, message: 'server error', timestamp: '' },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: {
            ...mockPost,
            id: String(params['id']),
            title: `title of ${String(params['id'])}`,
          },
          timestamp: '',
        });
      })
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider>
        <Routes>
          <Route path="/post/:id" element={<PostDetailPage />} />
        </Routes>
        <Link to="/post/next-post">next</Link>
      </TooltipProvider>,
      { wrapperOptions: { initialEntries: ['/post/failed-post'] } }
    );

    await screen.findByText(TEXTS.messages.error.fetchPosts);
    await user.click(screen.getByRole('link', { name: 'next' }));

    expect(await screen.findByText('title of next-post')).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.messages.error.fetchPosts)).not.toBeInTheDocument();
  });

  // 운영 라우터(RouterProvider.tsx)처럼 이동을 transition으로 감싼다 - 감싸지 않으면 다음 글을 기다리는 동안 댓글
  // 영역이 숨겨졌다 다시 보이며 componentDidUpdate가 불리지 않아(react-dom 18.3.1 development.js:23322-23323) 에러
  // 경계가 resetKeys를 비교하지 못한다. 운영에서는 이전 화면이 남아 그 경로를 타지 않는다
  it('앞 글 댓글 조회가 실패했어도 다른 글로 가면 그 글의 댓글을 보여준다', async () => {
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, ({ params }) =>
        HttpResponse.json({
          status: 200,
          message: 'ok',
          data: {
            ...mockPost,
            id: String(params['id']),
            title: `title of ${String(params['id'])}`,
          },
          timestamp: '',
        })
      ),
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(':id')}`, ({ params }) => {
        if (params['id'] === 'first-post') {
          return HttpResponse.json(
            { status: 500, message: 'server error', timestamp: '' },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: [{ ...mockComment, content: `comment of ${String(params['id'])}` }],
          timestamp: '',
        });
      })
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider>
        <Routes>
          <Route path="/post/:id" element={<PostDetailPage />} />
        </Routes>
        <Link to="/post/next-post">next</Link>
      </TooltipProvider>,
      {
        wrapperOptions: {
          initialEntries: ['/post/first-post'],
          future: { v7_startTransition: true },
        },
      }
    );

    await screen.findByText(TEXTS.errors.unexpected.title);
    await user.click(screen.getByRole('link', { name: 'next' }));

    expect(await screen.findByText('comment of next-post')).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.errors.unexpected.title)).not.toBeInTheDocument();
  });
});
