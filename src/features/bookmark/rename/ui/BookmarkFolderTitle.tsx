import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { CharacterCount } from '@/shared/ui/elements/CharacterCount';
import { EditButton } from '@/shared/ui/elements/EditButton';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.contract';
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
    nameLength,
    nameCountId,
    isUpdating,
    submitRename,
    cancelRename,
    handleRenameKeyDown,
  } = useRenameBookmarkFolder({ folder });

  if (renaming) {
    return (
      // data-renaming — 모바일 헤더가 이 표시를 보고 편집하는 동안 ←·정렬(↕)을 숨겨 입력 칸을 넓힌다(BookmarkPage.tsx)
      <div data-renaming className={cn('flex min-w-0 flex-col gap-1', className)}>
        {/* 취소·저장은 입력과 같은 줄에 둬 헤더 높이를 바꾸지 않는다. 모바일은 칸이 좁아 ✕·✓ 아이콘만, 데스크톱은
            글자로 보인다(2026-11-04 사용자 선택, docs/BOOKMARK.md §5). 터치에서는 44px, 마우스 데스크톱은 36px다
            (md:pointer-fine:h-9, docs/BOOKMARK.md §5 "터치 기기 버튼 44px") */}
        <div className="flex min-w-0 items-center gap-1 md:gap-2">
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
            aria-describedby={nameCountId}
            // 모바일은 카드와 같은 기본 입력 — 칸이 좁아 제목 크기로는 긴 이름 앞이 잘린다(docs/BOOKMARK.md §5).
            // 데스크톱은 제목 크기 그대로 둔다(cn이 Input의 md:text-sm을 이 토큰으로 바꾼다).
            // pr-3 — 지우기 버튼을 안 쓰니 그 자리(pr-8)를 비워 두지 않는다. 비워 두면 ✕ ✓ 옆에서 14자 이름이 넘친다
            className="min-w-0 flex-1 pr-3 md:h-auto md:text-screen-title"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-11 shrink-0 px-0 text-muted-foreground md:w-auto md:px-3 md:text-foreground md:pointer-fine:h-9"
            aria-label={TEXTS.buttons.cancel}
            // 누르는 순간 입력에서 포커스가 빠지면 blur 저장(submitRename)이 취소보다 먼저 나간다 —
            // 포커스 이동을 막는다(docs/BOOKMARK.md §5 "이름 바꾸기 취소·저장 버튼")
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelRename}
            disabled={isUpdating}
          >
            <X className="h-4 w-4 md:hidden" />
            <span className="max-md:hidden">{TEXTS.buttons.cancel}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="size-11 shrink-0 px-0 md:w-auto md:px-3 md:pointer-fine:h-9"
            aria-label={TEXTS.bookmark.folder.renameSubmit}
            onClick={submitRename}
            disabled={!name.trim() || nameError !== null || isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 md:hidden" />
                <span className="max-md:hidden">{TEXTS.bookmark.folder.renameSubmit}</span>
              </>
            )}
          </Button>
        </div>
        {/* 글자 수는 입력 아래 줄 오른쪽 — 같은 줄은 14자 이름이 가려져 자리가 없다. 편집하는 동안 헤더가 한 줄
            커진다(2026-11-04 사용자 선택, docs/BOOKMARK.md §5 "폴더 이름 글자 수"). 넘친 이유는 왼쪽에 둔다 */}
        <div className="flex items-start gap-2">
          {nameError && <p className="min-w-0 flex-1 text-xs text-destructive">{nameError}</p>}
          <CharacterCount
            id={nameCountId}
            current={nameLength}
            max={BOOKMARK_FOLDER_NAME_MAX_LENGTH}
            suffix={TEXTS.bookmark.folder.nameCountSuffix}
            className="ml-auto shrink-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <h1 className={cn('text-screen-title min-w-0 select-none', titleClassName)}>{folder.name}</h1>
      {/* 터치에서는 44px, 마우스 데스크톱은 원래 32px(docs/BOOKMARK.md §5 "터치 기기 버튼 44px") */}
      <EditButton
        label={TEXTS.bookmark.folder.rename}
        onClick={startRename}
        className="size-11 md:pointer-fine:size-8"
      />
    </div>
  );
}
