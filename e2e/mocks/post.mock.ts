import type { Page } from '@playwright/test';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { POST_PAGE_SIZE } from '@/entities/post/config/post.const';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * GET /post (목록) — src/mocks/handlers/post.handlers.ts와 같은 고정값을 재사용한다.
 * pathname만 보므로(URL.pathname은 쿼리스트링을 포함하지 않는다) `?q=...` 같은
 * 검색어가 붙어도 그대로 매칭된다.
 */
export async function mockPostList(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => route.fulfill({ json: wrapResponse(mockPostListResponse) })
  );
}

/** n번째 목 게시글의 제목. mockPostListPaged와 그걸 쓰는 스펙이 같은 함수로 카드를 찾는다. */
export function pagedPostTitle(index: number): string {
  return `E2E Post ${String(index).padStart(3, '0')}`;
}

/** n번째 목 게시글의 id. 상세 진입 후 URL 단언에 쓴다. */
export function pagedPostId(index: number): string {
  return `e2e-post-${String(index).padStart(3, '0')}`;
}

/**
 * id·title만 유일하게 바꾸고 나머지는 mockPost를 그대로 쓴다 — 카드 높이를 결정하는
 * 필드(description·tags·categories·ogImage)를 고정해 행 높이를 결정적으로 만든다.
 */
function pagedPost(index: number): Post {
  return { ...mockPost, id: pagedPostId(index), title: pagedPostTitle(index) };
}

/**
 * GET /post (목록) — page 쿼리를 실제로 읽어 페이지마다 다른 content를 돌려준다.
 * 가상 스크롤 검증은 "화면 밖에 글이 수백 개 있다"는 상황 자체가 대상이라, 항상 같은
 * 1개짜리 응답을 주는 mockPostList로는 만들 수 없다.
 *
 * ⚠️ predicate가 mockPostList와 완전히 같다 — 같은 스펙에서 둘을 함께 등록하면 LIFO로
 * 나중에 등록한 쪽만 살아남는다(위 installCatchAll 관례와 동일한 이유). 스펙마다 둘 중
 * 하나만 쓴다.
 *
 * last는 `start + size >= total`로 정확히 계산한다 — post.queries.ts의 getNextPageParam이
 * 오직 이 값만 보고 다음 페이지 유무를 판단하므로, 틀리면 마지막 페이지 이후에도 요청이
 * 계속 나가거나(항상 false) 스크롤이 조기에 멈춘다(항상 true).
 */
export async function mockPostListPaged(
  page: Page,
  { total, size = POST_PAGE_SIZE }: { total: number; size?: number }
): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => {
      const params = new URL(route.request().url()).searchParams;
      const pageParam = Number(params.get('page') ?? 0);
      const start = pageParam * size;
      const length = Math.max(0, Math.min(size, total - start));

      const body: PostListResponse = {
        page: pageParam,
        size,
        content: Array.from({ length }, (_, offset) => pagedPost(start + offset)),
        totalElements: total,
        totalPages: Math.ceil(total / size),
        last: start + size >= total,
      };

      return route.fulfill({ json: wrapResponse(body) });
    }
  );
}

/** GET /post/:id (상세) — 댓글 목록 엔드포인트(/post/:id/comment)와 겹치지 않게 세그먼트 하나만 허용한다. */
export async function mockPostDetail(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(mockPost) })
  );
}

/**
 * DELETE /post/:id — 204 no body(client.ts가 빈 객체로 처리).
 * ⚠️ mockPostDetail과 pathname 정규식이 완전히 같다 — 반드시 mockPostDetail 다음에
 * 등록하고(LIFO로 이게 먼저 실행됨), DELETE가 아니면 route.fallback()으로 넘겨야
 * 상세 GET이 계속 살아있다. 반대로 두면 상세 GET이 204 빈 응답을 받아 흰 화면이 뜬다.
 */
export async function mockDeletePost(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) =>
      route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.fallback()
  );
}
