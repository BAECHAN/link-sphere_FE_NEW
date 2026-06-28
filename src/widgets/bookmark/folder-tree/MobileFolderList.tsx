import { useRef, useState, KeyboardEvent } from 'react';
import {
  Bookmark,
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  Loader2,
  MoreVertical,
  Plus,
} from 'lucide-react';
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
import {
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useFolderListQuery,
  useUpdateFolderMutation,
} from '@/entities/folder/api/folder.queries';
import { Folder, FolderKey } from '@/entities/folder/model/folder.schema';

interface MobileFolderListProps {
  onSelect: (key: FolderKey) => void;
  className?: string;
}

/** 모바일 — 폴더 목록 페이지 (drill-down 패턴) */
export function MobileFolderList({ onSelect, className }: MobileFolderListProps) {
  const { data: folders, isLoading } = useFolderListQuery();

  return (
    <div className={cn('space-y-6', className)}>
      {/* 고정 항목 */}
      <section className="rounded-lg border bg-card">
        <FixedRow
          icon={<FolderIcon className="h-5 w-5" />}
          label="전체"
          count={folders?.reduce((sum, f) => sum + f.bookmarkCount, 0)}
          onClick={() => onSelect('all')}
        />
        <div className="border-t" />
        <FixedRow
          icon={<Inbox className="h-5 w-5" />}
          label="미분류"
          onClick={() => onSelect('uncategorized')}
        />
      </section>

      {/* 내 폴더 그리드 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">내 폴더</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {folders?.map((folder) => (
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
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3.5 active:bg-accent"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-left font-medium">{label}</span>
      {typeof count === 'number' && <span className="text-sm text-muted-foreground">{count}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

interface FolderCardProps {
  folder: Folder;
  onSelect: (key: FolderKey) => void;
}

function FolderCard({ folder, onSelect }: FolderCardProps) {
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
      toast.success('폴더 이름 변경됨');
      setRenaming(false);
    } catch {
      toast.error('이름 변경 실패');
      setName(folder.name);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDelete = () => {
    openConfirm({
      title: `"${folder.name}" 폴더 삭제`,
      message: '폴더 안의 북마크는 미분류로 이동합니다.',
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: async () => {
        try {
          await deleteFolder();
          toast.success('폴더가 삭제됐어요');
        } catch {
          toast.error('폴더 삭제 실패');
        }
      },
    });
  };

  if (renaming) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        <Bookmark className="h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') {
              setRenaming(false);
              setName(folder.name);
            }
          }}
          disabled={isUpdating}
          className="h-8"
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onSelect(folder.id)}
        className="flex flex-col gap-2 p-3 w-full text-left active:bg-accent"
      >
        <Bookmark className="h-5 w-5 text-muted-foreground" />
        <div className="font-medium truncate pr-6">{folder.name}</div>
        <div className="text-xs text-muted-foreground">{folder.bookmarkCount}</div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7"
            aria-label="폴더 메뉴"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenaming(true)}>이름 수정</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateFolderCard() {
  const [creating, setCreating] = useState(false);
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
      toast.success(`폴더 "${created.name}" 생성됨`);
      setCreating(false);
      setName('');
    } catch {
      toast.error('폴더 생성 실패');
    } finally {
      submittingRef.current = false;
    }
  };

  if (creating) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        <Plus className="h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (!name && !isPending) setCreating(false);
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setCreating(false);
              setName('');
            }
          }}
          placeholder="새 폴더 이름"
          disabled={isPending}
          className="h-8"
        />
        <Button size="sm" onClick={submit} disabled={!name.trim() || isPending} className="h-7">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '생성'}
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="rounded-lg border border-dashed bg-card p-3 flex flex-col gap-2 active:bg-accent text-muted-foreground"
    >
      <Plus className="h-5 w-5" />
      <div className="font-medium">새 폴더</div>
      <div className="text-xs">&nbsp;</div>
    </button>
  );
}
