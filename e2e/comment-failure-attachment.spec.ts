import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 1x1 투명 PNG - 브라우저가 실제 이미지로 읽어 미리보기를 만든다
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// 넣으려던 파일이 검증에 걸려 들어가지 않았으면 고친 게 없으니 실패 안내가 남아야 한다(#491 6번)
test('댓글 등록 실패 뒤 첨부가 검증에 걸리면 안내를 남기고, 실제로 들어가면 지운다', async ({
  page,
}) => {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(mockPost) })
  );
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
    (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 500, json: {} });
      }

      return route.fulfill({ json: wrapResponse([]) });
    }
  );

  await page.goto(`/post/${mockPost.id}`);
  await page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder).fill('실패할 댓글');
  await page.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();

  const failure = page.getByText(TEXTS.messages.error.commentSubmit.createFailed);
  await expect(failure).toBeVisible();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({ name: 'scan.bmp', mimeType: 'image/bmp', buffer: PNG_1X1 });
  await expect(page.getByText(TEXTS.validation.imageFileOnly)).toBeVisible();
  await expect(failure).toBeVisible();

  await fileInput.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(failure).toHaveCount(0);
});
