import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import {
  mockAccountQuery,
  mockNicknameAvailability,
  mockAccountUpdateConflict,
} from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { ENDPOINTS } from './mocks/endpoints';
import { TEXTS } from '@/shared/config/texts';

const NEW_NICKNAME = '새로운닉';

test.describe('프로필 수정 실패 경로', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockNicknameAvailability(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  // 닉네임 변경 → 저장까지의 공통 준비 단계. 500ms 디바운스가 끝나고 중복 검사 응답이
  // 온 것 자체가 hasDebounceSettled === true의 증거다(waitForTimeout 대신 waitForResponse를
  // 쓰는 이유) — 캐치올이 이 요청을 막으면 fail-open으로 저장 버튼이 그대로 활성화돼버려
  // 모킹 누락이 조용히 통과하는 함정이 있다(useUpdateAccount.ts:122-131).
  async function openMyPageAndFillNickname(page: Page) {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.profileEdit }).click();

    const modal = page.getByRole('dialog', { name: TEXTS.mypage.title });
    const availability = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/auth/account/nickname-availability' &&
        res.status() === 200
    );
    await modal.getByLabel(TEXTS.labels.nickname).fill(NEW_NICKNAME);
    await availability;

    const save = modal.getByRole('button', { name: TEXTS.mypage.save });
    await expect(save).toBeEnabled();
    return { modal, save };
  }

  test('저장을 누르면 응답 전에 모달이 닫히고 Navbar가 낙관적으로 먼저 바뀐 뒤, 409면 롤백된다', async ({
    page,
  }) => {
    // 스펙 로컬 게이트 — 테스트가 명시적으로 풀 때까지 PATCH 응답을 보류해, "모달이 응답
    // 전에 닫힌다"는 순서를 결정론적으로 관찰한다. beforeEach가 아니라 여기서 등록하는
    // 이유는 mockAccountQuery(GET) 다음에 와야 route.fallback()으로 GET을 건드리지
    // 않기 때문이다(LIFO — 나중 등록이 먼저 실행).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.account),
      async (route) => {
        if (route.request().method() !== 'PATCH') {
          return route.fallback();
        }
        await gate;
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            code: 'DUPLICATE_NICKNAME',
            message: '이미 사용 중인 닉네임입니다.',
            timestamp: new Date().toISOString(),
          },
        });
      }
    );

    const { modal, save } = await openMyPageAndFillNickname(page);
    await save.click();

    // useUpdateAccount.ts:162 — updateAccount() 호출 전에 onSuccess?.()를 먼저 부른다.
    // 즉 응답이 오기 전에 모달이 닫힌다.
    await expect(modal).toBeHidden();

    const accountMenuButton = page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu });
    // UserAvatar 폴백은 닉네임 첫 글자다(mockAccount.image가 undefined라 항상 폴백 렌더).
    await expect(accountMenuButton).toContainText(NEW_NICKNAME[0]);

    release();

    await expect(accountMenuButton).toContainText('T'); // mockAccount.nickname === 'testuser'
    await expect(page.getByText(TEXTS.messages.error.nicknameDuplicate)).toBeVisible();
  });

  test('실패 토스트의 "다시 열기"가 모달을 재오픈하고 입력값을 복원한다', async ({ page }) => {
    await mockAccountUpdateConflict(page);

    const { save } = await openMyPageAndFillNickname(page);
    await save.click();

    const reopen = page.getByRole('button', { name: TEXTS.mypage.reopen });
    await expect(reopen).toBeVisible();
    await reopen.click();

    const modal = page.getByRole('dialog', { name: TEXTS.mypage.title });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel(TEXTS.labels.nickname)).toHaveValue(NEW_NICKNAME);
  });
});
