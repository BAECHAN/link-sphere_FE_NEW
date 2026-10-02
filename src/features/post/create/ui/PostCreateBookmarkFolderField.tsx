import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { usePostCreateBookmarkFolderField } from '@/features/post/create/hooks/usePostCreateBookmarkFolderField';

/**
 * 폴더 선택 창에 넘기는 값. 창 자체(features/bookmark/select의 BookmarkFolderSelectDialog)는
 * 같은 레이어라 직접 import하지 않고 위층(PostSubmitPage)이 renderFolderSelect로 넘긴다 —
 * 위층이 이 값을 창에 그대로 넘기므로 모양이 어긋나면 TypeScript가 거기서 잡는다
 * (docs/FE-ARCHITECTURE.md §26).
 */
export interface PostCreateFolderSelectRenderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  isBookmarked: boolean;
  selectedFolderIds: string[];
  onSelectUncategorized: () => void | Promise<void>;
  onSelectFolder: (folder: BookmarkFolder) => void | Promise<void>;
  dangerAction?: { label: string; onClick: () => void | Promise<void> };
  showConfirmButton?: boolean;
}

interface PostCreateBookmarkFolderFieldProps {
  renderFolderSelect: (props: PostCreateFolderSelectRenderProps) => ReactNode;
}

/**
 * 링크 등록 폼(CreatePostForm)의 북마크 폴더 선택 필드.
 *
 * features/bookmark/select/ui/BookmarkFolderSelectDialog 를 features/bookmark/toggle/ui/PostCardBookmarkFolderDialog
 * 와 공유한다(위층이 renderFolderSelect로 넘긴다). 행 구성·모바일 바텀시트 전환은 동일하지만, 여기는 "지연 선택"이다 — 탭해도
 * 즉시 저장하지 않고 폼의 bookmark/folderIds 값만 바꾸고, 실제 북마크 생성은 등록
 * 제출(POST /post) 한 번에 서버가 처리한다.
 */
export function PostCreateBookmarkFolderField({
  renderFolderSelect,
}: PostCreateBookmarkFolderFieldProps) {
  const {
    bookmark,
    folderIds,
    open,
    setOpen,
    triggerText,
    handlePrefetch,
    handleSelectUncategorized,
    handleSelectFolder,
    handleClearBookmark,
  } = usePostCreateBookmarkFolderField();

  return (
    <FormField name="folderIds" label={TEXTS.post.form.create.bookmarkLabel}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        className="w-full min-h-11 md:min-h-0 justify-between font-normal"
      >
        <span
          className={cn('truncate', !bookmark && folderIds.length === 0 && 'text-muted-foreground')}
        >
          {triggerText}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      {renderFolderSelect({
        open,
        onOpenChange: setOpen,
        description: TEXTS.post.form.create.bookmarkSelect,
        isBookmarked: bookmark,
        selectedFolderIds: folderIds,
        onSelectUncategorized: handleSelectUncategorized,
        onSelectFolder: handleSelectFolder,
        dangerAction: { label: TEXTS.post.form.create.bookmarkNone, onClick: handleClearBookmark },
        showConfirmButton: true,
      })}
    </FormField>
  );
}
