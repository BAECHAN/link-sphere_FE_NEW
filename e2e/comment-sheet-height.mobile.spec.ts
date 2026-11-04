import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { MAX_COMMENT_CONTENT_HANGUL_CHARS } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';

// 긴 댓글이면 모바일 댓글 시트가 화면보다 커지던 문제(2026-11-04, docs/COMMENT.md §5 "시트 높이")의 회귀 검사.
// 입력칸이 내용만큼 끝없이 커지고(field-sizing-content) 시트에 최대 높이가 없어, 한글 2,000자면 시트가 2,770px
// (화면 727px)가 돼 글 앞부분과 상단 바가 화면 위로 잘렸다. 시트 위치를 실제로 재서 화면 안에 있는지 본다.
const SHEET_MAX_RATIO = 0.7;

async function measureSheet(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('textarea')?.closest('.fixed');

    if (!sheet) {
      throw new Error('comment sheet not found');
    }

    const rect = sheet.getBoundingClientRect();

    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewport: window.innerHeight,
    };
  });
}

function expectInsideViewport(box: Awaited<ReturnType<typeof measureSheet>>) {
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.viewport);
  expect(box.height).toBeLessThanOrEqual(box.viewport * SHEET_MAX_RATIO + 1);
}

test.describe('모바일 댓글 시트 높이', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostDetail(page);
    await mockComments(page);
    await page.goto(`/post/${mockPost.id}`);
    await page.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }).click();
  });

  test('상한을 넘긴 긴 글에도 시트가 화면 안에 있고 글자 수·안내·등록 버튼이 보인다', async ({
    page,
  }) => {
    const textarea = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);

    await textarea.fill('가'.repeat(MAX_COMMENT_CONTENT_HANGUL_CHARS + 1));

    expectInsideViewport(await measureSheet(page));
    // 입력칸은 상한에서 멈추고 안에서 스크롤된다
    expect(await textarea.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(page.getByText(TEXTS.validation.commentContentTooLong)).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByText(`2,001 / 2,000${TEXTS.comment.form.contentCountSuffix}`, { exact: true })
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole('button', { name: new RegExp(TEXTS.comment.form.submitComment) })
    ).toBeInViewport({ ratio: 1 });
  });

  test('미리보기를 펼쳐도 시트는 화면 안에 있고 안에서 스크롤된다', async ({ page }) => {
    await page
      .getByPlaceholder(TEXTS.comment.form.commentPlaceholder)
      .fill('가'.repeat(MAX_COMMENT_CONTENT_HANGUL_CHARS));
    await page.getByRole('button', { name: TEXTS.comment.form.showPreview }).click();

    expectInsideViewport(await measureSheet(page));

    const submit = page.getByRole('button', { name: new RegExp(TEXTS.comment.form.submitComment) });

    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport({ ratio: 1 });
  });
});
