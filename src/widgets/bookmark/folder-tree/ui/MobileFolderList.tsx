import {
  Bookmark,
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  Loader2,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import {
  BookmarkFolder,
  BookmarkFolderKey,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useFolderActions } from '@/widgets/bookmark/folder-tree/hooks/useFolderActions';
import {
  useCreateFolderCard,
  useMobileFolderList,
} from '@/widgets/bookmark/folder-tree/hooks/useMobileFolderList';

interface MobileFolderListProps {
  onSelect: (key: BookmarkFolderKey) => void;
  className?: string;
}

/** 모바일 — 폴더 목록 페이지 (drill-down 패턴) */
export function MobileFolderList({ onSelect, className }: MobileFolderListProps) {
  const { folderList, uncategorizedCount, recentFolderList, isLoading } = useMobileFolderList();

  return (
    <div className={cn('space-y-6', className)}>
      {/* 고정 항목 */}
      <section className="rounded-lg border bg-card">
        <FixedRow
          icon={<FolderIcon className="h-5 w-5" />}
          label={TEXTS.bookmark.folder.all}
          onClick={() => onSelect('all')}
        />
        <div className="border-t" />
        <FixedRow
          icon={<Inbox className="h-5 w-5" />}
          label={TEXTS.bookmark.folder.uncategorized}
          count={uncategorizedCount}
          onClick={() => onSelect('uncategorized')}
        />
      </section>

      {/* 최근 저장한 폴더 — split menu 상단 구획. 아래 본 그리드에서 빼지 않고 그대로 중복 표시한다 */}
      {recentFolderList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">
            {TEXTS.bookmark.folder.recentSection}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {recentFolderList.map((folder) => (
              <FolderCard key={`recent-${folder.id}`} folder={folder} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}

      {/* 내 폴더 그리드 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">
          {TEXTS.bookmark.folder.myFolders}
        </h2>
        {isLoading ? (
          <DelayedFallback className="flex items-center justify-center py-10">
            <Spinner />
          </DelayedFallback>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {folderList?.map((folder) => (
              <FolderCard key={folder.id} folder={folder} onSelect={onSelect} />
            ))}
            <CreateFolderCard />
          </div>
        )}
      </section>
    </div>
  );
}

// ==================== sub-components ====================

interface FixedRowProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}

function FixedRow({ icon, label, count, onClick }: FixedRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3.5 active:bg-accent"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-left font-medium">{label}</span>
      {typeof count === 'number' && <span className="text-sm text-muted-foreground">{count}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}

interface FolderCardProps {
  folder: BookmarkFolder;
  onSelect: (key: BookmarkFolderKey) => void;
}

function FolderCard({ folder, onSelect }: FolderCardProps) {
  const {
    renaming,
    startRename,
    name,
    setName,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
    handleDelete,
  } = useFolderActions({ folder });

  if (renaming) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        <Bookmark className="h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={handleRenameKeyDown}
          disabled={isUpdating}
          className="h-8"
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border bg-card overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onSelect(folder.id)}
        className="h-auto w-full flex-col items-stretch justify-start gap-2 rounded-none p-3 text-left active:bg-accent"
      >
        <Bookmark className="h-5 w-5 text-muted-foreground" />
        <div className="font-medium truncate pr-6">{folder.name}</div>
        <div className="text-xs text-muted-foreground">{folder.bookmarkCount}</div>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7"
            aria-label={TEXTS.ariaLabels.folderMenu}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={startRename}>{TEXTS.bookmark.folder.rename}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            {TEXTS.buttons.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateFolderCard() {
  const { creating, startCreating, name, setName, isPending, submit, handleKeyDown, handleBlur } =
    useCreateFolderCard();

  if (creating) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        <Plus className="h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={TEXTS.bookmark.folder.namePlaceholder}
          disabled={isPending}
          className="h-8"
        />
        <Button size="sm" onClick={submit} disabled={!name.trim() || isPending} className="h-7">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            TEXTS.bookmark.folder.createSubmit
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={startCreating}
      className="h-auto flex-col items-stretch justify-start gap-2 rounded-lg border border-dashed bg-card p-3 active:bg-accent text-muted-foreground"
    >
      <Plus className="h-5 w-5" />
      <div className="font-medium">{TEXTS.bookmark.folder.new}</div>
      <div className="text-xs">&nbsp;</div>
    </Button>
  );
}
