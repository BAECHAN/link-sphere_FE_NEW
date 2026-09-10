import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockAddBookmarkFolder } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

test.describe('로그인 상태 — 게시글을 북마크 폴더에 저장', () => {
  test.beforeEach(async ({ page }) => {
    // 캐치올을 가장 먼저 등록한다 — auth.fixture.ts가 아니라 여기서 mockAuthRefresh를
    // 등록하는 이유도 같다(LIFO 등록 순서를 이 파일이 직접 통제).
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await mockAddBookmarkFolder(page);
  });

  test('북마크 버튼 클릭 → 폴더 선택 → 저장 후 모달이 닫힌다', async ({ page }) => {
    await page.goto('/post');

    // has-session 플래그가 있어 AppShellLayout이 /auth/refresh 완료까지 스피너를
    // 띄운다(AppShellLayout.tsx:19-21) — refresh가 성공하면 accessToken이 zustand
    // 메모리에 세팅되고(auth.store.ts) 목록이 렌더된다.
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    // 북마크 버튼(아직 미북마크 상태라 name은 '북마크 저장', BookmarkPostButton.tsx:45)
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();

    // 폴더 행 탭 = 즉시 저장(PostCardBookmarkFolderModal.tsx) — 저장 성공 후 모달이 닫힌다
    await folderModal.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(folderModal).not.toBeVisible();
  });
});
