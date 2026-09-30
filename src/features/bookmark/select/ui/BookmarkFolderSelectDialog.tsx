import { Bookmark, BookmarkX, Check, FolderPlus, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription } from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/dialog/SheetDialogContent';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { Skeleton } from '@/shared/ui/atoms/skeleton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import {
  useBookmarkFolderSelect,
  UNCATEGORIZED_PENDING_KEY,
} from '@/features/bookmark/select/hooks/useBookmarkFolderSelect';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';

interface BookmarkFolderSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 헤더 보조 문구 — 즉시 저장(PostCardBookmarkFolderDialog)인지 지연 선택(PostCreateBookmarkFolderField)인지가 달라 호출부가 정한다 */
  description: string;
  isBookmarked: boolean;
  selectedFolderIds: string[];
  onSelectUncategorized: () => void | Promise<void>;
  onSelectFolder: (folder: BookmarkFolder) => void | Promise<void>;
  /** 목록 맨 아래 destructive 행. 넘기지 않으면 미노출 */
  dangerAction?: { label: string; onClick: () => void | Promise<void> };
  /** 탭해도 안 닫히는 지연 선택에서 하단 '확인' 버튼을 붙인다 */
  showConfirmButton?: boolean;
}

/**
 * 북마크 폴더 선택 UI — 카드 북마크 버튼의 즉시 저장(PostCardBookmarkFolderDialog)과 등록 폼의 지연 선택
 * (PostCreateBookmarkFolderField)이 공유하는 프레젠테이션 컴포넌트. 저장 동작은 콜백으로 주입받는다.
 * 로직 전부는 useBookmarkFolderSelect가 소유하고, 여기는 JSX만 남긴다.
 * - 데스크탑: 중앙 모달 / 모바일: 하단 BottomSheet
 * - 폴더 목록만 스크롤되고 새 폴더 만들기(헤더 아래)·하단 destructive 행은 항상 보인다
 *   (2026-09-11 — 폴더가 많아지면 이 두 행이 스크롤에 묻혀 안 보이던 문제 수정)
 */
export function BookmarkFolderSelectDialog({
  open,
  onOpenChange,
  description,
  isBookmarked,
  selectedFolderIds,
  onSelectUncategorized,
  onSelectFolder,
  dangerAction,
  showConfirmButton,
}: BookmarkFolderSelectDialogProps) {
  const isMobile = useIsMobile();
  const {
    isLoading,
    folderList,
    uncategorizedCount,
    recentFolderList,
    isUncategorizedSelected,
    pendingKey,
    isAnyPending,
    creatingMode,
    setCreatingMode,
    newFolderName,
    setNewFolderName,
    isCreating,
    handleSelectUncategorized,
    handleSelectFolder,
    handleCreateAndSelect,
    handleCancelCreate,
  } = useBookmarkFolderSelect({
    open,
    isBookmarked,
    selectedFolderIds,
    onSelectUncategorized,
    onSelectFolder,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent
        isMobile={isMobile}
        onEscapeKeyDown={(e) => {
          // Radix는 document capture 단계에서 ESC를 먼저 가로채므로(react-use-escape-keydown),
          // 아래 Input의 onKeyDown에서 stopPropagation 해도 모달이 먼저 닫힌다. 생성 폼이
          // 열려 있을 때는 여기서 dismiss를 막고 폼만 접는다. dialog.tsx가 IME 조합 중
          // ESC는 이 콜백 자체를 호출하지 않으므로 조합 방어와 충돌하지 않는다.
          if (!creatingMode) {
            return;
          }

          e.preventDefault();
          handleCancelCreate();
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-base">{TEXTS.bookmark.folder.selectorTitle}</DialogTitle>
            <DialogDescription className="text-xs">{description}</DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label={TEXTS.ariaLabels.close}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <FolderListLoading isMobile={isMobile} dangerActionLabel={dangerAction?.label} />
        ) : (
          <>
            {/* 새 폴더 만들기 — 헤더 바로 아래 고정, 스크롤 밖(2026-09-11). 헤더의 border-b가
                위쪽 경계를 이미 그리므로 이 블록은 아래쪽에만 border-b를 둔다 */}
            <ul className="py-1 border-b">
              {creatingMode ? (
                <li className="flex items-center gap-2 px-4 py-2.5">
                  <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    autoFocus
                    enterKeyHint="done"
                    placeholder={TEXTS.bookmark.folder.namePlaceholder}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      // IME(한글 등) 조합 중 엔터는 무시. ESC는 Dialog의 onEscapeKeyDown이
                      // 소유한다(위 참고) — 여기서 또 처리하면 같은 일을 두 번 하게 된다
                      if (e.nativeEvent.isComposing) {
                        return;
                      }

                      if (e.key === 'Enter') {
                        handleCreateAndSelect();
                      }
                    }}
                    className="h-8 flex-1"
                    disabled={isCreating}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelCreate}
                    disabled={isCreating}
                  >
                    {TEXTS.buttons.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateAndSelect}
                    disabled={!newFolderName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      TEXTS.bookmark.folder.createSubmit
                    )}
                  </Button>
                </li>
              ) : (
                <li>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreatingMode(true)}
                    className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-sm text-muted-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    {TEXTS.bookmark.folder.create}
                  </Button>
                </li>
              )}
            </ul>

            {/* 본문 — 폴더 목록만 스크롤 */}
            <div className={cn('overflow-y-auto', isMobile ? 'max-h-[70vh]' : 'max-h-96')}>
              <ul className="py-1">
                {/* 미분류 */}
                <FolderRow
                  icon={<Bookmark className="h-4 w-4" />}
                  name={TEXTS.bookmark.folder.uncategorized}
                  count={uncategorizedCount}
                  isSelected={isUncategorizedSelected}
                  isPending={pendingKey === UNCATEGORIZED_PENDING_KEY}
                  onClick={handleSelectUncategorized}
                />

                {/* 최근 저장한 폴더 — split menu 상단 구획. 아래 본 목록에서 빼지 않고 그대로 중복 표시한다 */}
                {recentFolderList.length > 0 && (
                  <>
                    <li className="px-4 pt-3 pb-1 text-group-label text-muted-foreground border-t">
                      {TEXTS.bookmark.folder.recentSection}
                    </li>
                    {recentFolderList.map((folder) => (
                      <FolderRow
                        key={`recent-${folder.id}`}
                        icon={<Bookmark className="h-4 w-4" />}
                        name={folder.name}
                        count={folder.bookmarkCount}
                        isSelected={selectedFolderIds.includes(folder.id)}
                        isPending={pendingKey === folder.id}
                        onClick={() => handleSelectFolder(folder)}
                      />
                    ))}
                  </>
                )}

                {/* 내 폴더 — 위 "최근 저장한 폴더"와 겹치더라도 그대로 중복 표시한다.
                    헤더가 최근 구획과의 경계선 역할도 겸한다 */}
                {folderList.length > 0 && (
                  <li className="px-4 pt-3 pb-1 text-group-label text-muted-foreground border-t">
                    {TEXTS.bookmark.folder.myFolders}
                  </li>
                )}

                {/* 폴더 목록 — 소속된 모든 폴더에 ✓ 표시 (다중 폴더 소속 가능) */}
                {folderList.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    icon={<Bookmark className="h-4 w-4" />}
                    name={folder.name}
                    count={folder.bookmarkCount}
                    isSelected={selectedFolderIds.includes(folder.id)}
                    isPending={pendingKey === folder.id}
                    onClick={() => handleSelectFolder(folder)}
                  />
                ))}
              </ul>
            </div>

            {/* 하단 destructive 행 — 스크롤 밖 고정. 카드 북마크 모달은 '북마크 제거', 등록 폼은
                '북마크 안 함'. 넘기지 않으면 렌더하지 않는다(카드 북마크 모달은 열 때 북마크가
                아니었으면 미노출) */}
            {dangerAction && (
              <ul className="py-1">
                <li>
                  <Button
                    type="button"
                    variant="none"
                    onClick={dangerAction.onClick}
                    disabled={isAnyPending}
                    className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 border-t"
                  >
                    <BookmarkX className="h-4 w-4" />
                    {dangerAction.label}
                  </Button>
                </li>
              </ul>
            )}
          </>
        )}

        {/* 확인 — 지연 선택(등록 폼)에서만. 탭해도 즉시 닫히지 않으므로 여기서 닫아야 선택이 확정된다 */}
        {showConfirmButton && (
          <div className="border-t p-3">
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              {TEXTS.buttons.confirm}
            </Button>
          </div>
        )}
      </SheetDialogContent>
    </Dialog>
  );
}

/** 골격 행 텍스트 폭 — 같은 폭이 반복되면 가짜 화면처럼 보여 길이를 섞는다 */
const SKELETON_ROW_WIDTHS = ['w-3/5', 'w-2/5', 'w-2/3'];

interface FolderListLoadingProps {
  isMobile: boolean;
  dangerActionLabel?: string;
}

/**
 * 폴더 목록을 기다리는 동안의 화면 — 목록이 도착하면 모달이 작게 떴다가 늘어나던 문제로
 * (2026-09-30) 실제 목록과 같은 자리를 먼저 잡는다. 데이터 없이 그릴 수 있는 "새 폴더
 * 만들기"·"미분류"·하단 destructive 행은 그대로 보여주고, 폴더 자리에만 골격을 둔다
 * (선례: widgets/post/post-list/ui/PostCardSkeleton.tsx). 각 행의 높이는 FolderRow와 같게
 * 고정해 두고 골격만 DelayedFallback으로 500ms 뒤 보여준다 — 응답이 빠를 때 골격이
 * 번쩍였다 사라지지 않게 하면서도 자리는 처음부터 잡혀 있다.
 */
function FolderListLoading({ isMobile, dangerActionLabel }: FolderListLoadingProps) {
  return (
    <>
      <ul className="py-1 border-b">
        <li>
          <Button
            type="button"
            variant="ghost"
            disabled
            className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-sm text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            {TEXTS.bookmark.folder.create}
          </Button>
        </li>
      </ul>

      <div className={cn('overflow-y-auto', isMobile ? 'max-h-[70vh]' : 'max-h-96')}>
        <ul className="py-1" aria-busy="true">
          {/* 목록이 오기 전엔 눌러도 저장할 수 없으므로 "새 폴더 만들기"처럼 비활성으로 보인다 —
              평소 행과 똑같이 그리면 느린 네트워크에서 눌렀을 때 아무 반응이 없어 고장처럼 읽힌다 */}
          <li>
            <Button
              type="button"
              variant="ghost"
              disabled
              className="h-11 w-full justify-start gap-3 rounded-none px-4 text-sm md:h-10"
            >
              {/* FolderRow와 같이 아이콘을 span으로 감싼다 — Button은 svg가 직접 자식이면 좌우
                  여백을 줄여(has-[>svg]:px-3) 도착 후 행과 아이콘 위치가 어긋난다 */}
              <span className="text-muted-foreground">
                <Bookmark className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">{TEXTS.bookmark.folder.uncategorized}</span>
              <DelayedFallback>
                <Skeleton className="h-3 w-4" />
              </DelayedFallback>
              <span className="h-4 w-4 shrink-0" />
            </Button>
          </li>

          {/* "내 폴더" 그룹 제목 자리 — 실제 제목과 같은 여백·줄 높이(16px) */}
          <li className="px-4 pt-3 pb-1 border-t">
            <div className="h-4">
              <DelayedFallback>
                <Skeleton className="h-3 w-12" />
              </DelayedFallback>
            </div>
          </li>

          {SKELETON_ROW_WIDTHS.map((widthClassName) => (
            <li key={widthClassName} className="flex h-11 items-center px-4 md:h-10">
              <DelayedFallback className="flex w-full items-center gap-3">
                <Skeleton className="h-4 w-4 shrink-0" />
                <Skeleton className={cn('h-3.5', widthClassName)} />
                <span className="flex-1" />
                <Skeleton className="h-3 w-4" />
                <span className="h-4 w-4 shrink-0" />
              </DelayedFallback>
            </li>
          ))}
        </ul>
        {/* 스크린리더용 로딩 알림 — 이전 스피너(role="status")와 같은 안내를 유지한다 */}
        <Spinner className="sr-only" />
      </div>

      {dangerActionLabel && (
        <ul className="py-1">
          <li>
            <Button
              type="button"
              variant="none"
              disabled
              className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-sm text-destructive border-t"
            >
              <BookmarkX className="h-4 w-4" />
              {dangerActionLabel}
            </Button>
          </li>
        </ul>
      )}
    </>
  );
}

interface FolderRowProps {
  icon: React.ReactNode;
  name: string;
  count?: number;
  isSelected: boolean;
  isPending: boolean;
  onClick: () => void;
}

function FolderRow({ icon, name, count, isSelected, isPending, onClick }: FolderRowProps) {
  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          'h-auto min-h-11 w-full justify-start gap-3 rounded-none px-4 py-2.5 text-sm md:min-h-0',
          isSelected && 'font-medium'
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left truncate">{name}</span>
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
        {/* 미선택·비저장 상태에도 자리를 비워둔다 — 체크가 나타날 때 개수 숫자가 밀리지 않도록 */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isSelected ? (
            <Check className="h-4 w-4 text-primary" />
          ) : null}
        </span>
      </Button>
    </li>
  );
}
