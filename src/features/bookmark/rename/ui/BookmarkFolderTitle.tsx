import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { Input } from '@/shared/ui/atoms/input';
import { EditButton } from '@/shared/ui/elements/EditButton';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useRenameBookmarkFolder } from '@/features/bookmark/rename/hooks/useRenameBookmarkFolder';

interface BookmarkFolderTitleProps {
  /** 이름을 바꿀 폴더. 전체·미분류·아직 못 불러온 폴더면 없다 — 연필을 그리지 않는다 */
  folder?: BookmarkFolder;
  title: string;
  className?: string;
  titleClassName?: string;
}

/** 폴더 화면 제목 — 연필을 누르면 사이드바·카드와 같은 방식으로 그 자리에서 이름을 바꾼다 */
export function BookmarkFolderTitle({
  folder,
  title,
  className,
  titleClassName,
}: BookmarkFolderTitleProps) {
  if (!folder) {
    return <h1 className={cn('text-screen-title min-w-0 select-none', titleClassName)}>{title}</h1>;
  }

  return <RenameableTitle folder={folder} className={className} titleClassName={titleClassName} />;
}

interface RenameableTitleProps {
  folder: BookmarkFolder;
  className?: string;
  titleClassName?: string;
}

function RenameableTitle({ folder, className, titleClassName }: RenameableTitleProps) {
  const {
    renaming,
    startRename,
    name,
    setName,
    nameError,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
  } = useRenameBookmarkFolder({ folder });

  if (renaming) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        <Input
          autoFocus
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={handleRenameKeyDown}
          disabled={isUpdating}
          aria-label={TEXTS.bookmark.folder.rename}
          aria-invalid={nameError !== null}
          // 모바일은 카드와 같은 기본 입력 — 칸이 좁아 제목 크기로는 긴 이름 앞이 잘린다(docs/BOOKMARK.md §5).
          // 데스크톱은 제목 크기 그대로 둔다(cn이 Input의 md:text-sm을 이 토큰으로 바꾼다)
          className="md:h-auto md:text-screen-title"
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <h1 className={cn('text-screen-title min-w-0 select-none', titleClassName)}>{folder.name}</h1>
      <EditButton label={TEXTS.bookmark.folder.rename} onClick={startRename} />
    </div>
  );
}
