import type { Page } from '@playwright/test';
import type { Comment } from '@/entities/comment/model/comment.schema';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { wrapResponse } from './wrap-response';

/**
 * GET /post/:id/comment (댓글 목록) — 상세 페이지의 CommentList가 마운트마다 호출한다.
 * 기본은 mockComment 1개. 댓글 자체가 검증 대상이 아닌 스펙(like.spec.ts 등)은 빈
 * 배열을 넘겨 등록한다 — 댓글의 좋아요 버튼도 접근명이 '좋아요'(comment.item.like)라
 * 게시글 좋아요 버튼과 겹쳐 strict mode violation이 난다(실측 확인).
 */
export async function mockComments(page: Page, comments: Comment[] = [mockComment]): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(comments) })
  );
}
