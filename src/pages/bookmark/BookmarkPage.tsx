import { ArrowLeft, ArrowUpDown } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/atoms/select';
import { TEXTS } from '@/shared/config/texts';
import { BookmarkPostList } from '@/widgets/bookmark/bookmark-post-list/ui/BookmarkPostList';
import { BookmarkSearch } from '@/widgets/bookmark/bookmark-search/ui/BookmarkSearch';
import { FolderTree } from '@/widgets/bookmark/folder-tree/ui/FolderTree';
import { MobileFolderList } from '@/widgets/bookmark/folder-tree/ui/MobileFolderList';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { POST_CARD_GRID } from '@/widgets/post/post-card/config/post-card-grid.const';
import { BookmarkFolderTitle } from '@/features/bookmark/rename/ui/BookmarkFolderTitle';
import { BookmarkFolderSort } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import type { Post } from '@/entities/post/model/post.schema';
import { useBookmarkPage, VALID_SORTS } from '@/pages/bookmark/hooks/useBookmarkPage';

const SORT_LABELS: Record<BookmarkFolderSort, string> = {
  latest: TEXTS.bookmark.folder.sort.latest,
  oldest: TEXTS.bookmark.folder.sort.oldest,
  title: TEXTS.bookmark.folder.sort.title,
  views: TEXTS.bookmark.folder.sort.views,
  viewed: TEXTS.bookmark.folder.sort.viewed,
};

// 모듈 최상단에 둬 렌더마다 같은 함수가 넘어가게 한다 (docs/FE-ARCHITECTURE.md §26)
function renderBookmarkPost(post: Post) {
  return <PostCard post={post} backSource="bookmark" />;
}

export function BookmarkPage() {
  const {
    isMobile,
    isMobileListMode,
    activeFolderKey,
    currentFolder,
    currentFolderName,
    sort,
    search,
    setFolderKey,
    setSort,
    goToFolderList,
  } = useBookmarkPage();

  // ============== 모바일 — 폴더 목록 모드 ==============
  if (isMobileListMode) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-screen-title mb-4">{TEXTS.bookmark.folder.pageTitle}</h1>
        <MobileFolderList onSelect={setFolderKey} />
      </div>
    );
  }

  // ============== 모바일 — 게시글 모드 ==============
  if (isMobile) {
    return (
      <div className="px-4 py-3">
        <header className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-2"
            onClick={goToFolderList}
            aria-label={TEXTS.ariaLabels.backToFolderList}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {/* 폴더가 바뀌면 이름 입력 상태를 새로 시작한다 */}
          <BookmarkFolderTitle
            key={activeFolderKey}
            folder={currentFolder}
            title={currentFolderName}
            className="flex-1"
            titleClassName="flex-1"
          />
          <Select value={sort} onValueChange={(v) => setSort(v as BookmarkFolderSort)}>
            {/* 제목과 같은 줄에 두려고 글자 대신 ↕ 아이콘만 둔다. 기본(최신 북마크순)이 아니면 점을 찍고,
                지금 정렬은 이름(aria-label)으로 알린다(docs/BOOKMARK.md §5 "모바일 정렬 아이콘") */}
            <SelectTrigger
              hideIcon
              className="relative size-8 shrink-0 justify-center border-transparent bg-transparent px-0 shadow-none dark:bg-transparent"
              aria-label={TEXTS.ariaLabels.bookmarkSortSelectCurrent(SORT_LABELS[sort])}
            >
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              {sort !== 'latest' && (
                <span
                  aria-hidden="true"
                  className="absolute top-[5px] right-[5px] size-[7px] rounded-full bg-primary"
                />
              )}
            </SelectTrigger>
            <SelectContent align="end">
              {VALID_SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <BookmarkSearch className="mb-4" />
        <BookmarkPostList
          renderPost={renderBookmarkPost}
          grid={POST_CARD_GRID}
          folderKey={activeFolderKey}
          sort={sort}
          search={search}
        />
      </div>
    );
  }

  // ============== 데스크탑 — 사이드바 + 게시글 ==============
  // 바깥 줄을 AppLayout main의 아래 여백(md:pb-16)까지 늘리고, 그 여백은 게시글 칸이 갖는다.
  // sticky 사이드바는 바깥 줄 안에서만 붙어 있어, 줄이 여백 위에서 끝나면 맨 아래까지 내렸을 때
  // 48px 밀려 상단바 뒤로 들어갔다(docs/BOOKMARK.md §10). AppLayout 여백을 바꾸면 같이 바꾼다.
  return (
    <div className="flex gap-6 -mb-16">
      <FolderTree
        selectedKey={activeFolderKey}
        onSelect={setFolderKey}
        sort={sort}
        search={search}
        className="w-60 shrink-0 sticky top-[calc(var(--navbar-height)+1rem)] h-[calc(100vh-var(--navbar-height)-2rem)] self-start"
      />
      <main className="flex-1 min-w-0 pb-16">
        <header className="flex items-center justify-between gap-4 mb-4">
          <BookmarkFolderTitle
            key={activeFolderKey}
            folder={currentFolder}
            title={currentFolderName}
            className="flex-1"
          />
          <Select value={sort} onValueChange={(v) => setSort(v as BookmarkFolderSort)}>
            <SelectTrigger className="w-36" aria-label={TEXTS.ariaLabels.bookmarkSortSelect}>
              <SelectValue placeholder={TEXTS.bookmark.folder.sortPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {VALID_SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <BookmarkSearch className="mb-4" />
        <BookmarkPostList
          renderPost={renderBookmarkPost}
          grid={POST_CARD_GRID}
          folderKey={activeFolderKey}
          sort={sort}
          search={search}
        />
      </main>
    </div>
  );
}
