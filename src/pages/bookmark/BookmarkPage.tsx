import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/atoms/select';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { BookmarkPostList } from '@/widgets/bookmark/bookmark-post-list/BookmarkPostList';
import { FolderTree } from '@/widgets/bookmark/folder-tree/FolderTree';
import { MobileFolderList } from '@/widgets/bookmark/folder-tree/MobileFolderList';
import { FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';
import { useFolderListQuery } from '@/entities/folder/api/folder.queries';

const SORT_LABELS: Record<FolderSort, string> = {
  latest: '최신 북마크순',
  oldest: '오래된순',
  title: '제목순',
  views: '조회수순',
};

const VALID_SORTS: FolderSort[] = ['latest', 'oldest', 'title', 'views'];

function parseFolderKey(raw: string | null): FolderKey | null {
  if (!raw) return null;
  if (raw === 'uncategorized' || raw === 'all') return raw;
  return raw; // UUID assumed
}

function parseSort(raw: string | null): FolderSort {
  if (raw && (VALID_SORTS as string[]).includes(raw)) return raw as FolderSort;
  return 'latest';
}

export function BookmarkPage() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const folderParam = searchParams.get('folder');
  const folderKey = parseFolderKey(folderParam);
  const sort = parseSort(searchParams.get('sort'));

  const { data: folders } = useFolderListQuery();

  // 모바일: folder 쿼리 없으면 폴더 목록 모드 / 데스크탑: 항상 'all' 디폴트
  const isMobileListMode = isMobile && !folderKey;
  const activeFolderKey: FolderKey = folderKey ?? 'all';

  const currentFolderName =
    activeFolderKey === 'all'
      ? '전체'
      : activeFolderKey === 'uncategorized'
        ? '미분류'
        : (folders?.find((f) => f.id === activeFolderKey)?.name ?? '폴더');

  const setFolderKey = (key: FolderKey) => {
    if (key === 'all' && !isMobile) searchParams.delete('folder');
    else searchParams.set('folder', key);
    setSearchParams(searchParams, { replace: false });
  };

  const setSort = (next: FolderSort) => {
    if (next === 'latest') searchParams.delete('sort');
    else searchParams.set('sort', next);
    setSearchParams(searchParams, { replace: true });
  };

  const goToFolderList = () => {
    searchParams.delete('folder');
    setSearchParams(searchParams, { replace: false });
  };

  // ============== 모바일 — 폴더 목록 모드 ==============
  if (isMobileListMode) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold mb-4">북마크</h1>
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
            aria-label="폴더 목록으로"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold flex-1 truncate">{currentFolderName}</h1>
          <Select value={sort} onValueChange={(v) => setSort(v as FolderSort)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="정렬" />
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
        <BookmarkPostList folderKey={activeFolderKey} sort={sort} />
      </div>
    );
  }

  // ============== 데스크탑 — 사이드바 + 게시글 ==============
  return (
    <div className="flex gap-6">
      <FolderTree
        selectedKey={activeFolderKey}
        onSelect={setFolderKey}
        className="w-60 shrink-0 sticky top-4 self-start"
      />
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold truncate">{currentFolderName}</h1>
          <Select value={sort} onValueChange={(v) => setSort(v as FolderSort)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="정렬" />
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
        <BookmarkPostList folderKey={activeFolderKey} sort={sort} />
      </main>
    </div>
  );
}
