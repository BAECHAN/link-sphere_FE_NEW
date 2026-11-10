import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { BackClosableOverlayKey } from '@/shared/config/back-closable-overlay';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

interface BackClosableOverlayCase {
  /** 테스트 이름에 쓰는 오버레이 이름 */
  name: string;
  /** 오버레이를 열 화면까지 간다. 그 화면에 필요한 목도 여기서 건다 */
  goToScreen: (page: Page) => Promise<void>;
  /** 오버레이를 여는 조작 */
  open: (page: Page) => Promise<void>;
  /** 열렸을 때 보이는 요소 */
  overlay: (page: Page) => Locator;
  /** 뒤로가기가 아니라 화면에서 닫는 조작(X·취소 등) */
  closeOnScreen: (page: Page) => Promise<void>;
}

// 폴더 선택 창(dialog.tsx)은 열린 직후의 클릭을 삼킨다 - 클릭 자체가 사라져 관측 가능한 이벤트로 기다릴 수 없다
async function closeFolderDialogWithX(page: Page) {
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
  await page.getByRole('dialog').getByRole('button', { name: TEXTS.ariaLabels.close }).click();
}

/**
 * 뒤로가기로 닫히는 오버레이마다 "어디서 무엇을 눌러 열고, 무엇이 보이고, 화면에서 어떻게 닫는가"를 적은 표.
 * 등록부(src/shared/config/back-closable-overlay.ts)에 키를 더하고 여기 사례를 적지 않으면 type-check가 실패한다 -
 * 아래 공통 검사(실제 뒤로가기)를 거치지 않은 오버레이가 들어오지 못한다(docs/BACK-NAVIGATION.md).
 */
const BACK_CLOSABLE_OVERLAY_CASES = {
  bookmarkFolderDialogOpen: {
    name: '카드 북마크 버튼의 폴더 선택 창',
    goToScreen: async (page) => {
      await mockPostList(page);
      await mockBookmarkFolderList(page);
      await page.goto('/post');
      await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    },
    open: (page) =>
      page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click(),
    overlay: (page) => page.getByRole('dialog'),
    closeOnScreen: closeFolderDialogWithX,
  },
  postCreateBookmarkFolderOpen: {
    name: '글 등록 폼의 폴더 선택 창',
    goToScreen: async (page) => {
      await mockPostList(page);
      await mockBookmarkFolderList(page);
      await page.goto('/post/submit');
      await expect(
        page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone })
      ).toBeVisible();
    },
    open: (page) => page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone }).click(),
    overlay: (page) => page.getByRole('dialog'),
    closeOnScreen: closeFolderDialogWithX,
  },
} satisfies Record<BackClosableOverlayKey, BackClosableOverlayCase>;

interface HistoryEntry {
  /** 히스토리에서 몇 번째 칸인지(라우터가 칸마다 싣는 번호) */
  index: number;
  isOverlayEntry: boolean;
}

// 브라우저의 지금 히스토리 칸을 읽는다 - 주소는 오버레이를 열어도 그대로라, 칸이 늘었는지는 여기서만 보인다
function readHistoryEntry(page: Page, key: BackClosableOverlayKey): Promise<HistoryEntry> {
  return page.evaluate((overlayKey) => {
    const state = window.history.state as {
      idx?: number;
      usr?: Record<string, unknown> | null;
    } | null;

    if (typeof state?.idx !== 'number') {
      throw new Error('history.state.idx가 없다 - 라우터가 히스토리 칸에 싣는 모양이 바뀌었다');
    }

    return { index: state.idx, isOverlayEntry: Boolean(state.usr?.[overlayKey]) };
  }, key);
}

/**
 * 등록부의 모든 오버레이에 같은 검사를 건다. 프로젝트(데스크톱·Pixel 5)마다 스펙 파일이 하나씩 이 함수를 부른다 -
 * Playwright 프로젝트가 파일 이름(*.mobile.spec.ts)으로 갈려서다.
 */
export function describeBackClosableOverlays() {
  const cases = Object.entries(BACK_CLOSABLE_OVERLAY_CASES) as [
    BackClosableOverlayKey,
    BackClosableOverlayCase,
  ][];

  for (const [key, overlayCase] of cases) {
    test.describe(`뒤로가기로 닫히는 오버레이 — ${overlayCase.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await installCatchAll(page);
        await mockAuthRefresh(page);
        await mockAccountQuery(page);
        await mockCategoryOptions(page);
        await overlayCase.goToScreen(page);
      });

      test('열면 주소는 그대로이고 히스토리 칸이 하나 늘어난다', async ({ page }) => {
        const url = page.url();
        const before = await readHistoryEntry(page, key);

        await overlayCase.open(page);

        await expect(overlayCase.overlay(page)).toBeVisible();
        expect(await readHistoryEntry(page, key)).toEqual({
          index: before.index + 1,
          isOverlayEntry: true,
        });
        expect(page.url()).toBe(url);
      });

      test('연 채 뒤로가기를 누르면 페이지는 그대로이고 오버레이만 닫힌다', async ({ page }) => {
        const url = page.url();
        const before = await readHistoryEntry(page, key);
        await overlayCase.open(page);
        await expect(overlayCase.overlay(page)).toBeVisible();

        await page.goBack();

        await expect(overlayCase.overlay(page)).toBeHidden();
        expect(page.url()).toBe(url);
        expect(await readHistoryEntry(page, key)).toEqual(before);
      });

      test('화면에서 닫아도 늘어난 칸이 빠진다', async ({ page }) => {
        // 칸이 남으면 다음 뒤로가기 한 번이 이미 닫힌 오버레이에 쓰이고, 두 칸이 빠지면 페이지를 떠난다
        const url = page.url();
        const before = await readHistoryEntry(page, key);
        await overlayCase.open(page);
        await expect(overlayCase.overlay(page)).toBeVisible();

        await overlayCase.closeOnScreen(page);

        await expect(overlayCase.overlay(page)).toBeHidden();
        await expect.poll(() => readHistoryEntry(page, key)).toEqual(before);
        expect(page.url()).toBe(url);
      });

      test('닫은 뒤 앞으로 가기로 다시 열린 오버레이도 화면에서 닫힌다', async ({ page }) => {
        // 같은 칸으로 돌아온 것이라, 닫기를 "이 칸에는 이미 뒤로를 보냈다"로 막으면 여기서 닫히지 않는다
        const url = page.url();
        const before = await readHistoryEntry(page, key);
        await overlayCase.open(page);
        await overlayCase.closeOnScreen(page);
        await expect.poll(() => readHistoryEntry(page, key)).toEqual(before);

        await page.goForward();
        await expect(overlayCase.overlay(page)).toBeVisible();
        await overlayCase.closeOnScreen(page);

        await expect(overlayCase.overlay(page)).toBeHidden();
        await expect.poll(() => readHistoryEntry(page, key)).toEqual(before);
        expect(page.url()).toBe(url);
      });
    });
  }
}
