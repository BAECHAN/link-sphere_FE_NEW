import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark, BookmarkX, Check, FolderPlus, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/atoms/dialog';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { useCreateFolderMutation, useFolderListQuery } from '@/entities/folder/api/folder.queries';
import { useBookmarkWithFolder } from '@/features/post/bookmark/hooks/useBookmarkWithFolder';

interface FolderSelectorProps {
  postId: string;
  isBookmarked: boolean;
  currentFolderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 북마크 폴더 선택 UI.
 * - 데스크탑: 중앙 모달
 * - 모바일: 하단 BottomSheet 슬라이드업
 * - 폴더 탭 = 즉시 저장 + 닫힘
 */
export function FolderSelector({
  postId,
  isBookmarked,
  currentFolderId,
  open,
  onOpenChange,
}: FolderSelectorProps) {
  const isMobile = useIsMobile();
  const { data: folders, isLoading } = useFolderListQuery({ enabled: open });
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 피드 전체 크래시 방지
  const folderList = Array.isArray(folders) ? folders : [];
  const { saveToFolder, removeBookmark } = useBookmarkWithFolder(
    postId,
    isBookmarked,
    currentFolderId
  );
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateFolderMutation();

  const [creatingMode, setCreatingMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [pendingFolderId, setPendingFolderId] = useState<string | null | undefined>(undefined);
  const submittingRef = useRef(false);

  // 셀렉터를 연 시점의 북마크 여부를 고정한다. 저장 중 낙관적 갱신으로 isBookmarked가
  // true로 바뀌어도, 닫힘 애니메이션 동안 '삭제하기' 버튼이 깜빡이지 않도록 방지한다.
  const [wasBookmarkedOnOpen, setWasBookmarkedOnOpen] = useState(isBookmarked);
  useEffect(
    function snapshotBookmarkStateOnOpen() {
      if (open) {
        setWasBookmarkedOnOpen(isBookmarked);
      }
      // open 이 true 로 전환되는 순간에만 스냅샷 — 저장 중 isBookmarked 변화는 의도적으로 무시
    },
    [open]
  );

  const close = () => {
    onOpenChange(false);
    setCreatingMode(false);
    setNewFolderName('');
    setPendingFolderId(undefined);
  };

  const handleSelect = async (folderId: string | null, folderName: string) => {
    setPendingFolderId(folderId);

    try {
      await saveToFolder(folderId);
      toast.success(TEXTS.messages.success.bookmarkSavedTo(folderName));
      close();
    } catch {
      toast.error(TEXTS.messages.error.bookmarkSaveFailed);
      setPendingFolderId(undefined);
    }
  };

  const handleRemove = async () => {
    try {
      await removeBookmark();
      toast.success(TEXTS.messages.success.bookmarkRemoved);
      close();
    } catch {
      toast.error(TEXTS.messages.error.bookmarkRemoveFailed);
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
      await handleSelect(created.id, created.name);
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailedFull);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // 모바일: 하단 시트
          isMobile
            ? 'bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 max-w-full w-full rounded-t-2xl rounded-b-none border-b-0 p-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom'
            : 'max-w-sm p-0',
          'gap-0 overflow-hidden'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-base">{TEXTS.bookmark.folder.selectorTitle}</DialogTitle>
            <DialogDescription className="text-xs">
              {TEXTS.bookmark.folder.selectorDescription}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={close}
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
                isSelected={isBookmarked && currentFolderId === null}
                isPending={pendingFolderId === null}
                onClick={() => handleSelect(null, TEXTS.bookmark.folder.uncategorized)}
              />

              {/* 폴더 목록 */}
              {folderList.map((folder) => (
                <FolderRow
                  key={folder.id}
                  icon={<Bookmark className="h-4 w-4" />}
                  name={folder.name}
                  count={folder.bookmarkCount}
                  isSelected={isBookmarked && currentFolderId === folder.id}
                  isPending={pendingFolderId === folder.id}
                  onClick={() => handleSelect(folder.id, folder.name)}
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

              {/* 북마크 제거 — 셀렉터를 연 시점에 이미 북마크된 경우만 노출.
                  신규 등록 저장 중 낙관적 갱신이 삭제 UI로 새어나오지 않도록 스냅샷 값을 사용 */}
              {wasBookmarkedOnOpen && (
                <li>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 border-t"
                  >
                    <BookmarkX className="h-4 w-4" />
                    {TEXTS.bookmark.folder.removeBookmark}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </DialogContent>
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
          'flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50',
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
