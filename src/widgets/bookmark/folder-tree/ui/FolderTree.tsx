import { Bookmark, Folder as FolderIcon, Inbox, Loader2, MoreVertical, Plus } from 'lucide-react';
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
import { Folder, FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';
import {
  useCreateFolderInput,
  useFolderChips,
  useFolderItem,
  useFolderTree,
  useInlineCreateFolderInput,
} from '@/widgets/bookmark/folder-tree/hooks/useFolderTree';

interface FolderTreeProps {
  selectedKey: FolderKey;
  onSelect: (key: FolderKey) => void;
  sort?: FolderSort;
  search?: string;
  className?: string;
}

/** 데스크탑 — 좌측 사이드바 트리 */
export function FolderTree({ selectedKey, onSelect, sort, search, className }: FolderTreeProps) {
  const { folders, uncategorizedCount, recentFolders, isLoading, prefetchFolder } = useFolderTree(
    sort,
    search
  );

  return (
    <aside className={cn('flex flex-col gap-1 py-2', className)}>
      <FixedItem
        icon={<FolderIcon className="h-4 w-4" />}
        label={TEXTS.bookmark.folder.all}
        selected={selectedKey === 'all'}
        onClick={() => onSelect('all')}
        onPrefetch={() => prefetchFolder('all')}
      />
      <FixedItem
        icon={<Inbox className="h-4 w-4" />}
        label={TEXTS.bookmark.folder.uncategorized}
        count={uncategorizedCount}
        selected={selectedKey === 'uncategorized'}
        onClick={() => onSelect('uncategorized')}
        onPrefetch={() => prefetchFolder('uncategorized')}
      />

      <div className="my-1 border-t" />

      {/* 최근 저장한 폴더 — split menu 상단 구획. 아래 본 목록에서 빼지 않고 그대로 중복 표시한다 */}
      {recentFolders.length > 0 && (
        <>
          <div className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
            {TEXTS.bookmark.folder.recentSection}
          </div>
          {recentFolders.map((folder) => (
            <FolderItem
              key={`recent-${folder.id}`}
              folder={folder}
              selected={selectedKey === folder.id}
              onClick={() => onSelect(folder.id)}
              onDeleted={() => onSelect('all')}
              onPrefetch={() => prefetchFolder(folder.id)}
            />
          ))}
          <div className="my-1 border-t" />
        </>
      )}

      {/* 내 폴더 — 위 "최근 저장한 폴더"와 겹치더라도 그대로 중복 표시한다 */}
      {(folders?.length ?? 0) > 0 && (
        <div className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
          {TEXTS.bookmark.folder.myFolders}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      ) : (
        folders?.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            selected={selectedKey === folder.id}
            onClick={() => onSelect(folder.id)}
            onDeleted={() => onSelect('all')}
            onPrefetch={() => prefetchFolder(folder.id)}
          />
        ))
      )}

      <CreateFolderInput />
    </aside>
  );
}

/** 모바일 — 상단 가로 칩 (선택 + 새 폴더만, ⋮ rename/delete 는 데스크탑 전용) */
export function FolderChips({ selectedKey, onSelect, className }: FolderTreeProps) {
  const { folders, uncategorizedCount, creating, startCreating, stopCreating } = useFolderChips();

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto py-2 px-1', className)}>
      <Chip selected={selectedKey === 'all'} onClick={() => onSelect('all')}>
        {TEXTS.bookmark.folder.all}
      </Chip>
      <Chip selected={selectedKey === 'uncategorized'} onClick={() => onSelect('uncategorized')}>
        {TEXTS.bookmark.folder.uncategorized}
        {uncategorizedCount > 0 && (
          <span className="ml-1.5 text-xs opacity-70">{uncategorizedCount}</span>
        )}
      </Chip>
      {folders?.map((folder) => (
        <Chip
          key={folder.id}
          selected={selectedKey === folder.id}
          onClick={() => onSelect(folder.id)}
        >
          {folder.name}
          {folder.bookmarkCount > 0 && (
            <span className="ml-1.5 text-xs opacity-70">{folder.bookmarkCount}</span>
          )}
        </Chip>
      ))}
      {creating ? (
        <InlineCreateFolderInput onClose={stopCreating} />
      ) : (
        <button
          type="button"
          onClick={startCreating}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border border-dashed text-muted-foreground hover:bg-accent shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {TEXTS.bookmark.folder.new}
        </button>
      )}
    </div>
  );
}

// ==================== sub-components ====================

interface FixedItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
}

function FixedItem({ icon, label, count, selected, onClick, onPrefetch }: FixedItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent',
        selected && 'bg-accent font-medium'
      )}
    >
      <span className={selected ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {typeof count === 'number' && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  );
}

interface FolderItemProps {
  folder: Folder;
  selected: boolean;
  onClick: () => void;
  onDeleted: () => void;
  onPrefetch?: () => void;
}

function FolderItem({ folder, selected, onClick, onDeleted, onPrefetch }: FolderItemProps) {
  const {
    renaming,
    startRename,
    name,
    setName,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
    handleDelete,
  } = useFolderItem(folder, selected, onDeleted);

  if (renaming) {
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={handleRenameKeyDown}
          disabled={isUpdating}
          className="h-7 flex-1"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 pl-3 pr-1 py-1 rounded-md text-sm hover:bg-accent',
        selected && 'bg-accent font-medium'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        className="flex items-center gap-3 flex-1 py-1"
      >
        <Bookmark className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-xs text-muted-foreground">{folder.bookmarkCount}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
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

function CreateFolderInput() {
  const { creating, startCreating, stopCreating } = useCreateFolderInput();

  if (creating) {
    return <InlineCreateFolderInput onClose={stopCreating} />;
  }
  return (
    <button
      type="button"
      onClick={startCreating}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent"
    >
      <Plus className="h-4 w-4" />
      {TEXTS.bookmark.folder.create}
    </button>
  );
}

interface InlineCreateFolderInputProps {
  onClose: () => void;
}

function InlineCreateFolderInput({ onClose }: InlineCreateFolderInputProps) {
  const { name, setName, isPending, submit, handleKeyDown, handleBlur } =
    useInlineCreateFolderInput(onClose);

  return (
    <div className="flex items-center gap-1 px-2 py-1 shrink-0">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={TEXTS.bookmark.folder.namePlaceholder}
        disabled={isPending}
        className="h-7 flex-1"
      />
      <Button size="sm" onClick={submit} disabled={!name.trim() || isPending}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          TEXTS.bookmark.folder.createSubmit
        )}
      </Button>
    </div>
  );
}

interface ChipProps {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

function Chip({ children, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm shrink-0 border',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-accent border-input'
      )}
    >
      {children}
    </button>
  );
}
