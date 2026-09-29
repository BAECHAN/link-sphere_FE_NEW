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

test.describe('프로필 수정(계정 설정 화면 섹션) 실패 경로', () => {
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
  // 모킹 누락이 조용히 통과하는 함정이 있다(useUpdateAccount.ts 참고).
  async function openAccountSettingsAndFillNickname(page: Page) {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.accountSettings }).click();

    const nickname = page.getByLabel(TEXTS.labels.nickname);
    const availability = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/auth/account/nickname-availability' &&
        res.status() === 200
    );
    await nickname.fill(NEW_NICKNAME);
    await availability;

    const save = page.getByRole('button', { name: TEXTS.mypage.save });
    await expect(save).toBeEnabled();
    return { nickname, save };
  }

  test('저장을 누르면 응답을 기다리는 동안 입력칸·버튼이 비활성화되고, 409면 롤백 후에도 입력값이 남는다', async ({
    page,
  }) => {
    // 스펙 로컬 게이트 — 테스트가 명시적으로 풀 때까지 PATCH 응답을 보류해, "응답을
    // 기다리는 동안 pending 상태가 유지된다"는 순서를 결정론적으로 관찰한다. beforeEach가
    // 아니라 여기서 등록하는 이유는 mockAccountQuery(GET) 다음에 와야 route.fallback()으로
    // GET을 건드리지 않기 때문이다(LIFO — 나중 등록이 먼저 실행).
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

    const { nickname, save } = await openAccountSettingsAndFillNickname(page);
    await save.click();

    // useUpdateAccount.ts의 onSubmit은 이제 응답을 기다린다 - 그동안 입력칸·버튼이
    // 비활성화되고 라벨이 "저장 중..."으로 바뀌어 사용자가 접수됐다는 걸 알 수 있다.
    // 라벨이 바뀌면 접근성 이름도 바뀌므로 pending 버튼은 새 이름으로 다시 찾는다.
    await expect(nickname).toBeDisabled();
    const savingButton = page.getByRole('button', { name: TEXTS.common.saving });
    await expect(savingButton).toBeVisible();
    await expect(savingButton).toBeDisabled();

    release();

    // 롤백 후에도 방금 입력했던 닉네임은 화면에 그대로 남아 바로 재시도할 수 있다
    // (예전 "다시 열기" 토스트 액션이 하던 값 복원을, 화면을 안 떠나므로 이제 그냥
    // 지우지 않는 방식으로 대체한다).
    await expect(page.getByText(TEXTS.messages.error.nicknameDuplicate)).toBeVisible();
    await expect(nickname).toBeEnabled();
    await expect(nickname).toHaveValue(NEW_NICKNAME);
  });

  test('409 롤백 후 같은 화면에서 값을 고쳐 재시도하면 성공한다', async ({ page }) => {
    await mockAccountUpdateConflict(page);

    const { nickname, save } = await openAccountSettingsAndFillNickname(page);
    await save.click();

    await expect(page.getByText(TEXTS.messages.error.nicknameDuplicate)).toBeVisible();
    await expect(nickname).toHaveValue(NEW_NICKNAME);

    // 페이지를 안 떠났으므로 값을 고쳐 바로 재시도할 수 있다 - 이번엔 성공 응답으로 교체
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.account),
      async (route) => {
        if (route.request().method() !== 'PATCH') {
          return route.fallback();
        }
        const body = (await route.request().postDataJSON()) as { nickname: string };
        return route.fulfill({
          json: {
            status: 200,
            message: 'ok',
            data: { id: 'user-uuid-1', nickname: body.nickname, role: 'USER', email: 't@t.com' },
            timestamp: new Date().toISOString(),
          },
        });
      }
    );

    const retryNickname = `${NEW_NICKNAME}2`;
    const availability = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/auth/account/nickname-availability' &&
        res.status() === 200
    );
    await nickname.fill(retryNickname);
    await availability;
    await save.click();

    await expect(page.getByText(TEXTS.messages.success.accountUpdated)).toBeVisible();
  });
});
