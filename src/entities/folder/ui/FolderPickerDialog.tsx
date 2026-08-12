import { useEffect, useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { Bookmark, BookmarkX, Check, FolderPlus, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription } from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/modal/SheetDialogContent';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { useCreateFolderMutation, useFolderListQuery } from '@/entities/folder/api/folder.queries';
import { useRecentFolders } from '@/entities/folder/model/useRecentFolders';
import type { Folder } from '@/entities/folder/model/folder.schema';

// 미분류 행의 pending 식별자 — folderKey 관례('all' | 'uncategorized' | UUID)와 동일한 sentinel이라
// 실제 폴더 UUID와 충돌하지 않는다.
const UNCATEGORIZED_PENDING_KEY = 'uncategorized';

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 헤더 보조 문구 — 즉시 저장(FolderSelector)인지 지연 선택(BookmarkFolderPicker)인지가 달라 호출부가 정한다 */
  description: string;
  isBookmarked: boolean;
  selectedFolderIds: string[];
  onSelectUncategorized: () => void | Promise<void>;
  onSelectFolder: (folder: Folder) => void | Promise<void>;
  /** 목록 맨 아래 destructive 행. 넘기지 않으면 미노출 */
  dangerAction?: { label: string; onClick: () => void | Promise<void> };
  /** 탭해도 안 닫히는 지연 선택에서 하단 '확인' 버튼을 붙인다 */
  showConfirmButton?: boolean;
}

/**
 * 북마크 폴더 선택 UI — 보관함의 즉시 저장(FolderSelector)과 등록 폼의 지연 선택
 * (BookmarkFolderPicker)이 공유하는 프레젠테이션 컴포넌트. 저장 동작은 콜백으로 주입받는다.
 * - 데스크탑: 중앙 모달 / 모바일: 하단 BottomSheet
 * - 미분류 행이 이미 체크된 상태에서 재탭하면 no-op(오탭으로 북마크가 조용히 사라지는 것 방지) —
 *   두 호출부 모두 이 규칙을 그대로 따른다.
 */
export function FolderPickerDialog({
  open,
  onOpenChange,
  description,
  isBookmarked,
  selectedFolderIds,
  onSelectUncategorized,
  onSelectFolder,
  dangerAction,
  showConfirmButton,
}: FolderPickerDialogProps) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useFolderListQuery({ enabled: open });
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 화면 전체 크래시 방지
  const folderList = Array.isArray(data?.folders) ? data.folders : [];
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  // 상단 "최근 저장한 폴더" 구획 — 열 때마다(open) 새로 스냅샷, 열려있는 동안은 고정
  const { recentFolders } = useRecentFolders(folderList, isLoading, open);
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateFolderMutation();

  const [creatingMode, setCreatingMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // 다이얼로그가 닫히면 생성 입력 상태를 리셋한다 — 열려 있는 동안만 스스로 닫히는 즉시 저장
  // 경로(FolderSelector)와 달리, 지연 선택(BookmarkFolderPicker)은 확인 버튼으로 닫히므로
  // 여기서 공통으로 처리해야 다음에 열 때 입력창이 남아있지 않는다.
  useEffect(() => {
    if (!open) {
      setCreatingMode(false);
      setNewFolderName('');
    }
  }, [open]);

  const isUncategorizedSelected = isBookmarked && selectedFolderIds.length === 0;

  const handleSelectUncategorized = async () => {
    // 이미 미분류(✓)면 아무 것도 하지 않는다 — "미분류에서 제거"는 곧 북마크 해제인데,
    // 그건 하단 destructive 행과 중복이라 오탭으로 북마크가 사라지는 걸 막기 위함.
    if (isUncategorizedSelected) {
      return;
    }

    setPendingKey(UNCATEGORIZED_PENDING_KEY);
    try {
      await onSelectUncategorized();
    } finally {
      setPendingKey(null);
    }
  };

  const handleSelectFolder = async (folder: Folder) => {
    setPendingKey(folder.id);
    try {
      await onSelectFolder(folder);
    } finally {
      setPendingKey(null);
    }
  };

  const handleCreateAndSelect = async () => {
    if (submittingRef.current || isCreating) {
      return;
    }

    const name = newFolderName.trim();

    if (!name) {
      return;
    }

    submittingRef.current = true;

    try {
      const created = await createFolder({ name });
      setNewFolderName('');
      setCreatingMode(false);
      await handleSelectFolder(created);
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailedFull);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent isMobile={isMobile}>
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

        {/* 본문 */}
        <div className={cn('overflow-y-auto', isMobile ? 'max-h-[70vh]' : 'max-h-96')}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
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
              {recentFolders.length > 0 && (
                <>
                  <li className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground border-t">
                    {TEXTS.bookmark.folder.recentSection}
                  </li>
                  {recentFolders.map((folder) => (
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
                <li className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground border-t">
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

              {/* 새 폴더 만들기 */}
              {creatingMode ? (
                <li className="flex items-center gap-2 px-4 py-2.5 border-t">
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder={TEXTS.bookmark.folder.namePlaceholder}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      // IME(한글 등) 조합 중 엔터는 무시
                      if (e.nativeEvent.isComposing) {
                        return;
                      }

                      if (e.key === 'Enter') {
                        handleCreateAndSelect();
                      }

                      if (e.key === 'Escape') {
                        setCreatingMode(false);
                        setNewFolderName('');
                      }
                    }}
                    className="h-8 flex-1"
                    disabled={isCreating}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateAndSelect}
                    disabled={!newFolderName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      TEXTS.bookmark.folder.createSubmit
                    )}
                  </Button>
                </li>
              ) : (
                <li>
                  <button
                    type="button"
                    onClick={() => setCreatingMode(true)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent border-t"
                  >
                    <Plus className="h-4 w-4" />
                    {TEXTS.bookmark.folder.create}
                  </button>
                </li>
              )}

              {/* 하단 destructive 행 — 보관함은 '북마크 제거', 등록 폼은 '북마크 안 함'.
                  넘기지 않으면 렌더하지 않는다(보관함은 열 때 북마크가 아니었으면 미노출) */}
              {dangerAction && (
                <li>
                  <button
                    type="button"
                    onClick={dangerAction.onClick}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 border-t"
                  >
                    <BookmarkX className="h-4 w-4" />
                    {dangerAction.label}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

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
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          'flex w-full items-center gap-3 min-h-11 md:min-h-0 px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50',
          isSelected && 'font-medium'
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left truncate">{name}</span>
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isSelected ? (
          <Check className="h-4 w-4 text-primary" />
        ) : null}
      </button>
    </li>
  );
}
