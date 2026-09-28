import { ArrowLeft } from 'lucide-react';
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
import { BookmarkFolderSort } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useBookmarkPage, VALID_SORTS } from '@/pages/bookmark/hooks/useBookmarkPage';

const SORT_LABELS: Record<BookmarkFolderSort, string> = {
  latest: TEXTS.bookmark.folder.sort.latest,
  oldest: TEXTS.bookmark.folder.sort.oldest,
  title: TEXTS.bookmark.folder.sort.title,
  views: TEXTS.bookmark.folder.sort.views,
  viewed: TEXTS.bookmark.folder.sort.viewed,
};

export function BookmarkPage() {
  const {
    isMobile,
    isMobileListMode,
    activeFolderKey,
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
          <h1 className="text-screen-title flex-1 truncate select-none">{currentFolderName}</h1>
          <Select value={sort} onValueChange={(v) => setSort(v as BookmarkFolderSort)}>
            <SelectTrigger
              className="w-32 h-8 text-xs"
              aria-label={TEXTS.ariaLabels.bookmarkSortSelect}
            >
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
        <BookmarkPostList folderKey={activeFolderKey} sort={sort} search={search} />
      </div>
    );
  }

  // ============== 데스크탑 — 사이드바 + 게시글 ==============
  return (
    <div className="flex gap-6">
      <FolderTree
        selectedKey={activeFolderKey}
        onSelect={setFolderKey}
        sort={sort}
        search={search}
        className="w-60 shrink-0 sticky top-[calc(var(--navbar-height)+1rem)] h-[calc(100vh-var(--navbar-height)-2rem)] self-start"
      />
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-screen-title truncate select-none">{currentFolderName}</h1>
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
        <BookmarkPostList folderKey={activeFolderKey} sort={sort} search={search} />
      </main>
    </div>
  );
}
