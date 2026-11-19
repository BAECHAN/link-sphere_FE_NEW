import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 창 폭이 768px 경계(MOBILE_MEDIA_QUERY)를 넘어도 쓰던 댓글이 남아야 한다. 예전에는 폭마다 다른 폼을 그려
// 경계에서 글과 첨부가 사라졌다(docs/COMMENT.md 시행착오). 휴대폰 회전과 창 크기 조절이 같은 경로다.
// useIsMobile은 폭만 보므로 데스크톱 프로젝트에서 창 폭만 바꿔 양쪽을 다 본다.
const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 700, height: 800 };
const DRAFT = '창 폭을 바꾸기 전에 쓰던 댓글';

// 1x1 투명 PNG - 브라우저가 실제 이미지로 읽어 미리보기를 만든다
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function commentInput(page: Page): Locator {
  return page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
}

function collapsedBar(page: Page): Locator {
  return page.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });
}

const LATE_MS = 300;

// 폭이 바뀐 것을 CSS는 바로 알고, React(useIsMobile)는 matchMedia의 change 알림을 받아야 안다. 그 알림을
// 일부러 늦춰 "CSS는 넓은 화면인데 React는 아직 좁은 화면으로 아는" 사이를 만든다
async function delayWidthChangeNotice(page: Page) {
  await page.addInitScript((lateMs) => {
    const original = MediaQueryList.prototype.addEventListener;

    MediaQueryList.prototype.addEventListener = function patched(
      this: MediaQueryList,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type !== 'change' || typeof listener !== 'function') {
        original.call(this, type, listener, options);
        return;
      }

      original.call(this, type, (event) => setTimeout(() => listener.call(this, event), lateMs));
    } as typeof original;
  }, LATE_MS);
}

test.describe('창 폭이 바뀌어도 쓰던 댓글이 남는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('넓은 화면에서 쓰던 글은 좁혀도 펼친 시트에 남고, 다시 넓혀도 남는다', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`/post/${mockPost.id}`);

    const input = commentInput(page);

    await input.click();
    await input.pressSequentially(DRAFT);

    // 같은 입력 요소가 자리만 옮겨야 포커스와 커서가 이어진다 - 새로 그린 요소면 여기서 끊긴다
    const typedNode = await input.elementHandle();

    await page.setViewportSize(NARROW);

    await expect(input).toBeVisible();
    await expect(input).toHaveValue(DRAFT);
    await expect(input).toBeFocused();
    await expect(collapsedBar(page)).toHaveCount(0);
    expect(await typedNode?.evaluate((node) => node.isConnected)).toBe(true);

    await page.setViewportSize(WIDE);

    await expect(input).toBeVisible();
    await expect(input).toHaveValue(DRAFT);
    await expect(input).toBeFocused();
    expect(await typedNode?.evaluate((node) => node.isConnected)).toBe(true);
  });

  test('쓰던 글이 없으면 좁힐 때 접힌 바만 보인다', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`/post/${mockPost.id}`);
    await expect(commentInput(page)).toBeVisible();

    await page.setViewportSize(NARROW);

    await expect(collapsedBar(page)).toBeVisible();
    await expect(commentInput(page)).toHaveCount(0);
  });

  test('좁은 화면 시트에서 쓰던 글은 넓혀도 남고, 다시 좁혀도 남는다', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto(`/post/${mockPost.id}`);
    await collapsedBar(page).click();

    const input = commentInput(page);

    await input.pressSequentially(DRAFT);

    const typedNode = await input.elementHandle();

    await page.setViewportSize(WIDE);

    await expect(input).toBeVisible();
    await expect(input).toHaveValue(DRAFT);
    await expect(input).toBeFocused();
    expect(await typedNode?.evaluate((node) => node.isConnected)).toBe(true);

    await page.setViewportSize(NARROW);

    await expect(input).toBeVisible();
    await expect(input).toHaveValue(DRAFT);
    await expect(collapsedBar(page)).toHaveCount(0);
  });

  // 시트를 CSS 폭 조건(md:hidden)으로도 숨기면, React가 넓어진 것을 알기 전까지 시트가 잠깐 숨어 브라우저가
  // 입력칸의 포커스를 뺀다. 그 순서를 일부러 만들어 본다(docs/COMMENT.md §10)
  test('React가 넓어진 것을 늦게 알아도 시트에서 쓰던 입력칸의 포커스가 남는다', async ({
    page,
  }) => {
    await delayWidthChangeNotice(page);
    await page.setViewportSize(NARROW);
    await page.goto(`/post/${mockPost.id}`);
    await collapsedBar(page).click();

    const input = commentInput(page);

    await input.pressSequentially(DRAFT);
    await page.setViewportSize(WIDE);
    // 알림이 도착해 넓은 화면 배치(화면 아래에 뜨지 않는 인라인 폼)로 바뀔 때까지 기다린다
    await expect(input.locator('xpath=ancestor::form/..')).not.toHaveClass(/fixed/);

    await expect(input).toHaveValue(DRAFT);
    await expect(input).toBeFocused();
  });

  test('첨부한 이미지도 폭이 바뀌어도 남는다', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`/post/${mockPost.id}`);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG_1X1 });

    const attached = page.getByRole('img', { name: TEXTS.ariaLabels.attachmentImageAt(1) });

    await expect(attached).toBeVisible();

    await page.setViewportSize(NARROW);

    await expect(attached).toBeVisible();
    await expect(collapsedBar(page)).toHaveCount(0);

    await page.setViewportSize(WIDE);

    await expect(attached).toBeVisible();
  });

  test('좁은 화면에서 취소한 글은 버려지고, 넓혔다 좁혀도 되살아나지 않는다', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto(`/post/${mockPost.id}`);
    await collapsedBar(page).click();
    await commentInput(page).pressSequentially(DRAFT);
    await page.getByRole('button', { name: TEXTS.comment.form.cancel }).click();

    await expect(collapsedBar(page)).toBeVisible();

    await page.setViewportSize(WIDE);

    await expect(commentInput(page)).toBeVisible();
    await expect(commentInput(page)).toHaveValue('');

    await page.setViewportSize(NARROW);

    await expect(collapsedBar(page)).toBeVisible();
    await expect(commentInput(page)).toHaveCount(0);
  });
});
