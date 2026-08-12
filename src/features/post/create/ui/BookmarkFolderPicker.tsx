import { useRef, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Bookmark, Check, ChevronRight, FolderPlus, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription } from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/modal/SheetDialogContent';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { cn } from '@/shared/lib/tailwind/utils';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';
import { useCreateFolderMutation, useFolderListQuery } from '@/entities/folder/api/folder.queries';
import type { CreatePost } from '@/entities/post/model/post.schema';

/**
 * 링크 등록 폼의 북마크 폴더 선택 필드.
 *
 * features/post/bookmark/ui/FolderSelector 와 행 구성·모바일 바텀시트 전환은 동일하지만,
 * 여기는 "지연 선택"이다 — 탭해도 즉시 저장하지 않고 폼의 bookmark/folderIds 값만 바꾸고,
 * 실제 북마크 생성은 등록 제출(POST /post) 한 번에 서버가 처리한다.
 */
export function BookmarkFolderPicker() {
  const isMobile = useIsMobile();
  const { control } = useFormContext<CreatePost>();
  const { field: bookmarkField } = useController<CreatePost, 'bookmark'>({
    name: 'bookmark',
    control,
  });
  const { field: folderIdsField } = useController<CreatePost, 'folderIds'>({
    name: 'folderIds',
    control,
  });

  const bookmark = bookmarkField.value;
  const folderIds = folderIdsField.value;

  const [open, setOpen] = useState(false);
  const { data, isLoading } = useFolderListQuery({ enabled: open });
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 폼 전체 크래시 방지
  const folderList = Array.isArray(data?.folders) ? data.folders : [];
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateFolderMutation();

  const [creatingMode, setCreatingMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const submittingRef = useRef(false);

  const close = () => {
    setOpen(false);
    setCreatingMode(false);
    setNewFolderName('');
  };

  const applySelection = (nextBookmark: boolean, nextFolderIds: string[]) => {
    bookmarkField.onChange(nextBookmark);
    folderIdsField.onChange(nextFolderIds);
  };

  const isUncategorizedSelected = bookmark && folderIds.length === 0;

  const handleSelectUncategorized = () => {
    // 이미 미분류(✓)면 해제 — 폴더 목록엔 '북마크 제거' 행이 없으므로 재탭이 곧 해제 동작이다.
    applySelection(!isUncategorizedSelected, []);
  };

  const handleToggleFolder = (folderId: string) => {
    if (folderIds.includes(folderId)) {
      const next = folderIds.filter((id) => id !== folderId);
      // 마지막 폴더에서 빠져도 미분류로 남는다(북마크 자체는 유지) — FolderSelector와 동일 규칙.
      applySelection(true, next);
    } else {
      applySelection(true, [...folderIds, folderId]);
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
      applySelection(true, [...folderIds, created.id]);
      setCreatingMode(false);
      setNewFolderName('');
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailedFull);
    } finally {
      submittingRef.current = false;
    }
  };

  const selectedFolderNames = folderList
    .filter((folder) => folderIds.includes(folder.id))
    .map((folder) => folder.name);

  const triggerText =
    selectedFolderNames.length > 0
      ? selectedFolderNames.join(', ')
      : bookmark
        ? TEXTS.bookmark.folder.uncategorized
        : TEXTS.post.form.create.bookmarkNone;

  return (
    <FormField name="folderIds" label={TEXTS.post.form.create.bookmarkLabel}>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full min-h-11 md:min-h-0 justify-between font-normal"
        >
          <span
            className={cn(
              'truncate',
              !bookmark && folderIds.length === 0 && 'text-muted-foreground'
            )}
          >
            {triggerText}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>

        <SheetDialogContent isMobile={isMobile}>
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <DialogTitle className="text-base">{TEXTS.bookmark.folder.selectorTitle}</DialogTitle>
              <DialogDescription className="text-xs">
                {TEXTS.post.form.create.bookmarkSelect}
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
                  onClick={handleSelectUncategorized}
                />

                {/* 내 폴더 */}
                {folderList.length > 0 && (
                  <li className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground border-t">
                    {TEXTS.bookmark.folder.myFolders}
                  </li>
                )}

                {/* 폴더 목록 — 소속시킬 모든 폴더에 ✓ 표시 (다중 폴더 소속 가능) */}
                {folderList.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    icon={<Bookmark className="h-4 w-4" />}
                    name={folder.name}
                    count={folder.bookmarkCount}
                    isSelected={folderIds.includes(folder.id)}
                    onClick={() => handleToggleFolder(folder.id)}
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
              </ul>
            )}
          </div>

          {/* 확인 — 지연 선택이라 즉시 닫히지 않고, 여기서 닫아야 선택이 최종 확정된다 */}
          <div className="border-t p-3">
            <Button type="button" className="w-full" onClick={close}>
              {TEXTS.buttons.confirm}
            </Button>
          </div>
        </SheetDialogContent>
      </Dialog>
    </FormField>
  );
}

interface FolderRowProps {
  icon: React.ReactNode;
  name: string;
  count?: number;
  isSelected: boolean;
  onClick: () => void;
}

function FolderRow({ icon, name, count, isSelected, onClick }: FolderRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 min-h-11 md:min-h-0 px-4 py-2.5 text-sm hover:bg-accent',
          isSelected && 'font-medium'
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left truncate">{name}</span>
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </button>
    </li>
  );
}
