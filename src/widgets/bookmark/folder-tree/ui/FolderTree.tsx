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
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import {
  BookmarkFolder,
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  useCreateFolderInput,
  useFolderChips,
  useFolderItem,
  useFolderTree,
  useInlineCreateFolderInput,
} from '@/widgets/bookmark/folder-tree/hooks/useFolderTree';

interface FolderTreeProps {
  selectedKey: BookmarkFolderKey;
  onSelect: (key: BookmarkFolderKey) => void;
  sort?: BookmarkFolderSort;
  search?: string;
  className?: string;
}

/** 데스크탑 — 좌측 사이드바 트리 */
export function FolderTree({ selectedKey, onSelect, sort, search, className }: FolderTreeProps) {
  const { folderList, uncategorizedCount, recentFolderList, isLoading, prefetchFolder } =
    useFolderTree(sort, search);

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
      {recentFolderList.length > 0 && (
        <>
          <div className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
            {TEXTS.bookmark.folder.recentSection}
          </div>
          {recentFolderList.map((folder) => (
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
      {(folderList?.length ?? 0) > 0 && (
        <div className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
          {TEXTS.bookmark.folder.myFolders}
        </div>
      )}

      {isLoading ? (
        <DelayedFallback className="flex items-center justify-center py-4">
          <Spinner />
        </DelayedFallback>
      ) : (
        folderList?.map((folder) => (
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
  const { folderList, uncategorizedCount, creating, startCreating, stopCreating } =
    useFolderChips();

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
      {folderList?.map((folder) => (
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
        <Button
          type="button"
          variant="ghost"
          onClick={startCreating}
          className="h-auto shrink-0 gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {TEXTS.bookmark.folder.new}
        </Button>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        'h-auto justify-start gap-3 px-3 py-2 text-sm',
        selected && 'bg-accent font-medium'
      )}
    >
      <span className={selected ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {typeof count === 'number' && <span className="text-xs text-muted-foreground">{count}</span>}
    </Button>
  );
}

interface FolderItemProps {
  folder: BookmarkFolder;
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
    // 래퍼에 여백(pl-3/pr-1/py-1/gap-2)을 두지 않는다 — hover:bg-accent가 이 div 전체에
    // 걸리는데, 안쪽 버튼들 사이 여백만큼은 실제 클릭 영역(button)이 아니라 커서가
    // default로 풀리는 구멍이 생겨 마우스를 세로로 훑을 때 pointer가 깜빡였다(2026-09-11,
    // 좌표 스윕으로 실측). 대신 버튼들이 그 여백을 흡수해 행 전체를 채운다. ⋮ 메뉴는
    // 카운트와 자리를 공유하지 않고 자기 폭(size-9)만큼 별도로 차지한다 — 겹쳐서
    // hover 시 카운트를 숨기는 방식도 검토했으나 겹침 처리보다 이 편이 단순하다.
    <div
      className={cn(
        'group flex items-center rounded-md text-sm hover:bg-accent',
        selected && 'bg-accent font-medium'
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        className="h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2"
      >
        <Bookmark className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-xs text-muted-foreground">{folder.bookmarkCount}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
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
    <Button
      type="button"
      variant="ghost"
      onClick={startCreating}
      className="h-auto justify-start gap-2 px-3 py-2 text-sm text-muted-foreground"
    >
      <Plus className="h-4 w-4" />
      {TEXTS.bookmark.folder.create}
    </Button>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        'h-auto shrink-0 rounded-full border px-3 py-1.5 text-sm',
        selected
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          : 'bg-background border-input'
      )}
    >
      {children}
    </Button>
  );
}
