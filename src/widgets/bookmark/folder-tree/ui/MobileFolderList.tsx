import {
  Bookmark,
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  Loader2,
  Pin,
  Plus,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Divider } from '@/shared/ui/atoms/divider';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { DropdownMenuItem } from '@/shared/ui/atoms/dropdown-menu';
import { KebabMenu } from '@/shared/ui/elements/KebabMenu';
import { CharacterCount } from '@/shared/ui/elements/CharacterCount';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import {
  BookmarkFolder,
  BookmarkFolderKey,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.contract';
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
  const {
    folderList,
    folderListRef,
    uncategorizedCount,
    recentFolderList,
    isPending,
    isFolderListFailed,
    retryFolderList,
  } = useMobileFolderList();

  return (
    <div className={cn('space-y-6', className)}>
      {/* 고정 항목 */}
      <section className="rounded-lg border bg-card">
        <FixedRow
          icon={<FolderIcon className="h-5 w-5" />}
          label={TEXTS.bookmark.folder.all}
          onClick={() => onSelect('all')}
        />
        <Divider />
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
          <h2 className="text-subsection-title text-muted-foreground px-1 select-none">
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
        <h2 className="text-subsection-title text-muted-foreground px-1 select-none">
          {TEXTS.bookmark.folder.myFolders}
        </h2>
        {isPending ? (
          <DelayedFallback className="flex items-center justify-center py-12">
            <Spinner />
          </DelayedFallback>
        ) : (
          <>
            {/* 폴더 목록을 받지 못했을 때 — "내 폴더" 아래에 안내와 다시 시도를 두고, 목록 없이도 만들 수 있는
                새 폴더 카드는 그대로 둔다(2026-11-03 사용자 선택, docs/BOOKMARK.md "사이드바·모바일 폴더 목록을
                받지 못했을 때") */}
            {isFolderListFailed && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {TEXTS.bookmark.folder.listLoadFailed}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={retryFolderList}>
                  <RotateCw aria-hidden="true" />
                  {TEXTS.buttons.retry}
                </Button>
              </div>
            )}
            {/* 고정·해제로 옮겨 간 카드를 useFollowFocusOnReorder가 부드럽게 따라가도록 브라우저 스크롤 고정을 끈다 */}
            <div ref={folderListRef} className="grid grid-cols-2 gap-3 [overflow-anchor:none]">
              {folderList?.map((folder) => (
                <FolderCard key={folder.id} folder={folder} onSelect={onSelect} />
              ))}
              <CreateFolderCard />
            </div>
          </>
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
    isPinned,
    queuePinToggle,
    handleMenuCloseAutoFocus,
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
    handleDelete,
  } = useFolderActions({ folder });

  if (renaming) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        {/* 글자 수는 아이콘 줄 오른쪽 — 아래 줄에 두면 좁은 카드에서 넘침 이유가 숫자 옆으로 밀려 4줄로 접히고,
            2열 격자라 옆 카드까지 커진다(2026-11-04 사용자 선택, docs/BOOKMARK.md §5 "폴더 이름 글자 수") */}
        <div className="flex items-center justify-between gap-2">
          {isPinned ? (
            <Pin className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Bookmark className="h-5 w-5 text-muted-foreground" />
          )}
          <CharacterCount
            id={nameCountId}
            current={nameLength}
            max={BOOKMARK_FOLDER_NAME_MAX_LENGTH}
            suffix={TEXTS.bookmark.folder.nameCountSuffix}
          />
        </div>
        <Input
          autoFocus
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={handleRenameKeyDown}
          disabled={isUpdating}
          aria-invalid={nameError !== null}
          aria-describedby={nameCountId}
          className="h-8"
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 flex-1"
            // 누르는 순간 입력에서 포커스가 빠지면 blur 저장(submitRename)이 취소보다 먼저 나간다 —
            // 포커스 이동을 막는다(docs/BOOKMARK.md §5 "이름 바꾸기 취소·저장 버튼")
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelRename}
            disabled={isUpdating}
          >
            {TEXTS.buttons.cancel}
          </Button>
          <Button
            size="sm"
            onClick={submitRename}
            disabled={!name.trim() || nameError !== null || isUpdating}
            className="h-11 flex-1"
          >
            {isUpdating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              TEXTS.bookmark.folder.renameSubmit
            )}
          </Button>
        </div>
      </div>
    );
  }

  // scroll-mt — 고정·해제로 옮겨 간 카드를 화면이 따라갈 때 상단바 뒤에 숨지 않게 한다(CommentList.tsx와 같은 방식)
  return (
    <div className="relative rounded-lg border bg-card overflow-hidden scroll-mt-(--navbar-height)">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onSelect(folder.id)}
        className="h-auto w-full flex-col items-stretch justify-start gap-2 rounded-none p-3 text-left active:bg-accent"
      >
        {/* 고정한 폴더는 북마크 아이콘 자리에 핀을 둔다 — 이름 칸을 줄이지 않는다(docs/BOOKMARK.md §5) */}
        {isPinned ? (
          <Pin
            role="img"
            aria-label={TEXTS.ariaLabels.folderPinned}
            className="h-5 w-5 text-muted-foreground"
          />
        ) : (
          <Bookmark className="h-5 w-5 text-muted-foreground" />
        )}
        {/* 어절 단위로 줄바꿈하되 2줄 자리를 늘 비워 두고 넘치면 말줄임 — 카드 높이·개수 위치를 맞춘다
            (docs/BOOKMARK.md "폴더 이름 줄 수"). Button의 whitespace-nowrap을 푼다 */}
        <div className="font-medium whitespace-normal line-clamp-2 min-h-[2lh] pr-6">
          {folder.name}
        </div>
        <div className="text-xs text-muted-foreground">{folder.bookmarkCount}</div>
      </Button>
      {/* 손가락으로 누르는 크기(44px). 카드 모서리에 붙여 아이콘이 전보다 4px만 안쪽으로 온다 — 누르는 자리는 이름
          첫 줄 위 4px까지 덮는다(docs/BOOKMARK.md §5 "터치 기기 버튼 44px") */}
      <KebabMenu
        aria-label={TEXTS.ariaLabels.folderMenu}
        triggerClassName="absolute top-0 right-0 size-11"
        onCloseAutoFocus={handleMenuCloseAutoFocus}
      >
        <DropdownMenuItem onClick={queuePinToggle}>
          {isPinned ? TEXTS.bookmark.folder.unpin : TEXTS.bookmark.folder.pin}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={startRename}>{TEXTS.bookmark.folder.rename}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          {TEXTS.buttons.delete}
        </DropdownMenuItem>
      </KebabMenu>
    </div>
  );
}

function CreateFolderCard() {
  const {
    creating,
    startCreating,
    name,
    setName,
    nameError,
    nameLength,
    nameCountId,
    isPending,
    submit,
    handleCancel,
    handleKeyDown,
    handleBlur,
  } = useCreateFolderCard();

  if (creating) {
    return (
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
        {/* 글자 수는 아이콘 줄 오른쪽 — 위 이름 바꾸기 카드와 같은 자리(docs/BOOKMARK.md §5 "폴더 이름 글자 수") */}
        <div className="flex items-center justify-between gap-2">
          <Plus className="h-5 w-5 text-muted-foreground" />
          <CharacterCount
            id={nameCountId}
            current={nameLength}
            max={BOOKMARK_FOLDER_NAME_MAX_LENGTH}
            suffix={TEXTS.bookmark.folder.nameCountSuffix}
          />
        </div>
        <Input
          autoFocus
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={TEXTS.bookmark.folder.namePlaceholder}
          disabled={isPending}
          aria-invalid={nameError !== null}
          aria-describedby={nameCountId}
          className="h-8"
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        {/* 버튼을 가로로 나열한다 — 세로 스택은 카드 높이가 늘어 grid row 전체가
            커지고 옆 FolderCard까지 함께 늘어난다 */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 flex-1"
            // 입력이 빈 상태로 취소를 누르면 mousedown이 blur를 먼저 발생시켜 폼이
            // 언마운트되고 click이 유실된다(handleBlur가 !name && !isPending일 때
            // setCreating(false)를 호출). 포커스 이동 자체를 막아 이 경합을 없앤다.
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancel}
            disabled={isPending}
          >
            {TEXTS.buttons.cancel}
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!name.trim() || nameError !== null || isPending}
            className="h-11 flex-1"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              TEXTS.bookmark.folder.createSubmit
            )}
          </Button>
        </div>
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
      {/* 폴더 카드와 같은 2줄 자리 — 마지막 줄에 혼자 남아도 높이가 같다 */}
      <div className="font-medium min-h-[2lh]">{TEXTS.bookmark.folder.new}</div>
      <div className="text-xs">&nbsp;</div>
    </Button>
  );
}
