import { useRef, useState, KeyboardEvent } from 'react';
import { Bookmark, Folder as FolderIcon, Inbox, Loader2, MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import {
  prefetchFolderPosts,
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useFolderListQuery,
  useUpdateFolderMutation,
} from '@/entities/folder/api/folder.queries';
import { Folder, FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';

interface FolderTreeProps {
  selectedKey: FolderKey;
  onSelect: (key: FolderKey) => void;
  sort?: FolderSort;
  search?: string;
  className?: string;
}

/** 데스크탑 — 좌측 사이드바 트리 */
export function FolderTree({ selectedKey, onSelect, sort, search, className }: FolderTreeProps) {
  const { data: folders, isLoading } = useFolderListQuery();

  return (
    <aside className={cn('flex flex-col gap-1 py-2', className)}>
      <FixedItem
        icon={<FolderIcon className="h-4 w-4" />}
        label={TEXTS.bookmark.folder.all}
        selected={selectedKey === 'all'}
        onClick={() => onSelect('all')}
        onPrefetch={() => prefetchFolderPosts('all', sort, search)}
      />
      <FixedItem
        icon={<Inbox className="h-4 w-4" />}
        label={TEXTS.bookmark.folder.uncategorized}
        selected={selectedKey === 'uncategorized'}
        onClick={() => onSelect('uncategorized')}
        onPrefetch={() => prefetchFolderPosts('uncategorized', sort, search)}
      />

      <div className="my-1 border-t" />

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
            onPrefetch={() => prefetchFolderPosts(folder.id, sort, search)}
          />
        ))
      )}

      <CreateFolderInput />
    </aside>
  );
}

/** 모바일 — 상단 가로 칩 (선택 + 새 폴더만, ⋮ rename/delete 는 데스크탑 전용) */
export function FolderChips({ selectedKey, onSelect, className }: FolderTreeProps) {
  const { data: folders } = useFolderListQuery();
  const [creating, setCreating] = useState(false);

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto py-2 px-1', className)}>
      <Chip selected={selectedKey === 'all'} onClick={() => onSelect('all')}>
        {TEXTS.bookmark.folder.all}
      </Chip>
      <Chip selected={selectedKey === 'uncategorized'} onClick={() => onSelect('uncategorized')}>
        {TEXTS.bookmark.folder.uncategorized}
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
        <InlineCreateFolderInput onClose={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
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
  selected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
}

function FixedItem({ icon, label, selected, onClick, onPrefetch }: FixedItemProps) {
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
    </button>
  );
}

interface FolderItemProps {
  folder: Folder;
  selected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
}

function FolderItem({ folder, selected, onClick, onPrefetch }: FolderItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const { mutateAsync: updateFolder, isPending: isUpdating } = useUpdateFolderMutation(folder.id);
  const { mutateAsync: deleteFolder } = useDeleteFolderMutation(folder.id);
  const { openConfirm } = useAlert();
  const submittingRef = useRef(false);

  const submitRename = async () => {
    if (submittingRef.current || isUpdating) return;
    const next = name.trim();
    if (!next || next === folder.name) {
      setRenaming(false);
      setName(folder.name);
      return;
    }
    submittingRef.current = true;
    try {
      await updateFolder({ name: next });
      toast.success(TEXTS.messages.success.folderRenamed);
      setRenaming(false);
    } catch {
      toast.error(TEXTS.messages.error.folderRenameFailed);
      setName(folder.name);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDelete = () => {
    openConfirm({
      title: TEXTS.bookmark.folder.deleteConfirmTitle(folder.name),
      message: TEXTS.bookmark.folder.deleteConfirmMessage,
      confirmText: TEXTS.buttons.delete,
      cancelText: TEXTS.buttons.cancel,
      onConfirm: async () => {
        try {
          await deleteFolder();
          toast.success(TEXTS.messages.success.folderDeleted);
        } catch {
          toast.error(TEXTS.messages.error.folderDeleteFailed);
        }
      },
    });
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') {
              setRenaming(false);
              setName(folder.name);
            }
          }}
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
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            {TEXTS.bookmark.folder.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            {TEXTS.buttons.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateFolderInput() {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return <InlineCreateFolderInput onClose={() => setCreating(false)} />;
  }
  return (
    <button
      type="button"
      onClick={() => setCreating(true)}
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
  const [name, setName] = useState('');
  const { mutateAsync: createFolder, isPending } = useCreateFolderMutation();
  const submittingRef = useRef(false);

  const submit = async () => {
    if (submittingRef.current || isPending) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    submittingRef.current = true;
    try {
      const created = await createFolder({ name: trimmed });
      toast.success(TEXTS.messages.success.folderCreated(created.name));
      onClose();
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailed);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME(한글 등) 조합 중 엔터는 무시 — 조합 완료 + Enter 가 동시 발생해 submit 중복 호출되는 것을 방지
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 shrink-0">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name && onClose()}
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
