import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
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
    // Navbar가 로그인 상태에서 항상 GET /auth/account를 자동 호출한다(account.mock.ts
    // 참고) — 빠뜨리면 화면에 에러 토스트가 뜨는데 아래 assertion들은 이걸 못 잡는다.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await mockAddBookmarkFolder(page);
  });

  test('북마크 버튼 클릭 → 폴더 선택 → 저장 후 모달이 닫힌다', async ({ page }) => {
    // 계정 조회(GET /auth/account)가 실제로 모킹 응답을 받았는지 확인한다. 캐치올에
    // 막히면(abort) 이 요청은 'response' 이벤트 없이 'requestfailed'로 끝나서 아래
    // waitForResponse가 타임아웃으로 실패한다 — 토스트가 뜬 뒤에야 사라지는 타이밍에
    // 기대는 .not.toBeVisible() 방식은 스냅샷 시점이 토스트보다 빨라 조용히 통과해버리는
    // 걸 실측해서(2026-09-10) 네트워크 응답 자체를 기다리는 방식으로 바꿨다.
    const accountResponse = page.waitForResponse((res) => res.url().includes('/auth/account'));

    await page.goto('/post');

    // has-session 플래그가 있어 AppShellLayout이 /auth/refresh 완료까지 스피너를
    // 띄운다(AppShellLayout.tsx:19-21) — refresh가 성공하면 accessToken이 zustand
    // 메모리에 세팅되고(auth.store.ts) 목록이 렌더된다.
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await accountResponse;

    // 북마크 버튼(아직 미북마크 상태라 name은 '북마크 저장', BookmarkPostButton.tsx:45)
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();

    // 폴더 행 탭 = 즉시 저장(PostCardBookmarkFolderModal.tsx) — 저장 성공 후 모달이 닫힌다
    await folderModal.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(folderModal).not.toBeVisible();
  });
});
