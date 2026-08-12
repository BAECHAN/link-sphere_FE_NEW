import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useCreateFolderMutation, useFolderListQuery } from '@/entities/folder/api/folder.queries';
import { useRecentFolders } from '@/entities/folder/model/useRecentFolders';
import { useBookmarkFolders } from '@/features/post/bookmark/hooks/useBookmarkFolders';

interface FolderSelectorProps {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 북마크 폴더 선택 UI.
 * - 데스크탑: 중앙 모달
 * - 모바일: 하단 BottomSheet 슬라이드업
 * - 폴더 탭 = 즉시 저장/제거 + 닫힘. 소속된 모든 폴더에 ✓ 표시 (다중 폴더 소속 가능)
 */
export function FolderSelector({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: FolderSelectorProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data, isLoading } = useFolderListQuery({ enabled: open });
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 피드 전체 크래시 방지
  const folderList = Array.isArray(data?.folders) ? data.folders : [];
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  // 상단 "최근 저장한 폴더" 구획 — 열 때마다(open) 새로 스냅샷, 열려있는 동안은 고정
  const { recentFolders } = useRecentFolders(folderList, isLoading, open);
  const { selectUncategorized, selectFolder, removeBookmark } = useBookmarkFolders(
    postId,
    isBookmarked,
    bookmarkFolderIds
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

  // 저장 결과를 바로 확인할 수 있게 저장된 폴더로 데려간다. 액션과 닫기 버튼이 자리를 다투므로
  // FCM 알림 토스트와 동일하게 액션이 있을 때는 닫기 버튼을 끈다.
  const viewSavedOptions = (folderKey: string) => ({
    action: {
      label: TEXTS.bookmark.folder.viewAction,
      onClick: () => navigate(`${ROUTES_PATHS.BOOKMARK}?folder=${folderKey}`),
    },
    closeButton: false,
  });

  const isUncategorizedSelected = isBookmarked && bookmarkFolderIds.length === 0;

  const handleSelectUncategorized = async () => {
    // 이미 미분류(✓)면 아무 것도 하지 않는다 — "미분류에서 제거"는 곧 북마크 해제인데,
    // 그건 아래 '북마크 제거' 행과 중복이라 오탭으로 북마크가 사라지는 걸 막기 위함.
    if (isUncategorizedSelected) {
      return;
    }

    // 이미 1개 이상의 폴더에 소속돼 있었다면 이번 탭은 "전체 해제" — 폴더 하나가 아니라
    // 여러 폴더에서 한꺼번에 빠졌다는 걸 알려야 하므로 일반 저장 문구와 구분한다.
    const wasInFolders = isBookmarked && bookmarkFolderIds.length > 0;

    setPendingFolderId(null);
    try {
      await selectUncategorized();
      toast.success(
        wasInFolders
          ? TEXTS.messages.success.bookmarkClearedAllFolders
          : TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized),
        viewSavedOptions('uncategorized')
      );
      close();
    } catch {
      toast.error(TEXTS.messages.error.bookmarkSaveFailed);
      setPendingFolderId(undefined);
    }
  };

  const handleSelectFolder = async (folderId: string, folderName: string) => {
    const wasSelected = bookmarkFolderIds.includes(folderId);
    // 이게 마지막 폴더였다면 제거 후 결과가 미분류이므로, "미분류에 저장되었습니다."
    // 토스트를 재사용하되 왜 미분류가 됐는지 헷갈리지 않도록 description으로 이유를 덧붙인다.
    const isLastFolder = wasSelected && bookmarkFolderIds.length === 1;

    setPendingFolderId(folderId);
    try {
      await selectFolder(folderId);
      if (isLastFolder) {
        toast.success(TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized), {
          description: TEXTS.messages.success.bookmarkAutoUncategorizedDescription,
          ...viewSavedOptions('uncategorized'),
        });
      } else if (wasSelected) {
        toast.success(TEXTS.messages.success.bookmarkRemovedFromFolder(folderName));
      } else {
        toast.success(
          TEXTS.messages.success.bookmarkSavedTo(folderName),
          viewSavedOptions(folderId)
        );
      }
      close();
    } catch {
      toast.error(
        wasSelected
          ? TEXTS.messages.error.bookmarkRemoveFromFolderFailed
          : TEXTS.messages.error.bookmarkSaveFailed
      );
      setPendingFolderId(undefined);
    }
  };

  const handleRemove = async () => {
    try {
      await removeBookmark();
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
      await handleSelectFolder(created.id, created.name);
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
                count={uncategorizedCount}
                isSelected={isUncategorizedSelected}
                isPending={pendingFolderId === null}
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
                      isSelected={bookmarkFolderIds.includes(folder.id)}
                      isPending={pendingFolderId === folder.id}
                      onClick={() => handleSelectFolder(folder.id, folder.name)}
                    />
                  ))}
                  {/* 최근 구획과 아래 본 목록 사이 구분선 — 없으면 같은 폴더가 위아래에
                      바로 붙어 보여서(중복 표시가 의도인데) 목록이 깨진 것처럼 보인다 */}
                  <li className="border-t" />
                </>
              )}

              {/* 폴더 목록 — 소속된 모든 폴더에 ✓ 표시 (다중 폴더 소속 가능) */}
              {folderList.map((folder) => (
                <FolderRow
                  key={folder.id}
                  icon={<Bookmark className="h-4 w-4" />}
                  name={folder.name}
                  count={folder.bookmarkCount}
                  isSelected={bookmarkFolderIds.includes(folder.id)}
                  isPending={pendingFolderId === folder.id}
                  onClick={() => handleSelectFolder(folder.id, folder.name)}
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
