import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { TEXTS } from '@/shared/config/texts';

// touch-targets.mobile.spec.ts와 짝이다 — 터치 기기에서 넓힌 타깃이 마우스 데스크톱에서는
// 원래 밀도로 돌아가는지(md:pointer-fine:min-h-0) 본다.
test.describe('데스크톱 마우스 — 터치 타깃을 넓히지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostDetail(page);
    await mockComments(page, [mockComment]);
  });

  test('댓글의 행동 버튼은 44px로 넓어지지 않는다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);

    // 이 스펙의 전제 - 주 입력이 마우스여야 md:pointer-fine:이 적용된다
    expect(await page.evaluate(() => window.matchMedia('(pointer: fine)').matches)).toBe(true);

    const replyButton = page.getByRole('button', { name: TEXTS.comment.item.reply });
    await expect(replyButton).toBeVisible();

    const actionButtons = replyButton.locator('..').getByRole('button');
    await expect(actionButtons).toHaveCount(4);

    for (const button of await actionButtons.all()) {
      await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeLessThan(44);
    }
  });
});
