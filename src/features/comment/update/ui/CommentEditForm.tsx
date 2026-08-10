import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X, Check, ImagePlus } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/const';
import { LinkMetadata } from '@/entities/comment/model/comment.schema';

interface CommentEditFormProps {
  editContent: string;
  editImagePreviewUrls: string[];
  isEditDraggingOver: boolean;
  isUpdating: boolean;
  canSubmit: boolean;
  isMobile: boolean;
  linkMetadata?: LinkMetadata | null;
  setEditContent: (content: string) => void;
  cancelEditing: () => void;
  addEditFiles: (files: FileList) => void;
  handleEditPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleEditDrop: (e: React.DragEvent<HTMLElement>) => void;
  handleEditDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleEditDragEnter: (e: React.DragEvent<HTMLElement>) => void;
  handleEditDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  clearEditImage: (index: number) => void;
  handleUpdate: () => void;
}

export function CommentEditForm({
  editContent,
  editImagePreviewUrls,
  isEditDraggingOver,
  isUpdating,
  canSubmit,
  isMobile,
  linkMetadata,
  setEditContent,
  cancelEditing,
  addEditFiles,
  handleEditPaste,
  handleEditDrop,
  handleEditDragOver,
  handleEditDragEnter,
  handleEditDragLeave,
  clearEditImage,
  handleUpdate,
}: CommentEditFormProps) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative rounded-md transition-colors',
          isEditDraggingOver && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        <div
          // 점선 박스보다 사방 72px 넓게 실제 드랍 판정 영역을 확장한다. 드래그 중에만
          // pointer-events를 켜서 평소엔 텍스트영역 클릭·포커스를 가리지 않는다. position이 없는
          // 형제(미리보기 박스·버튼 줄)는 z-index와 무관하게 항상 더 아래 페인트 레이어에 그려지므로,
          // DOM 순서상 이 레이어보다 나중에 오더라도 이벤트를 가로채지 못한다.
          className={cn(
            'absolute -inset-18 z-20',
            isEditDraggingOver ? 'pointer-events-auto' : 'pointer-events-none'
          )}
          onDrop={handleEditDrop}
          onDragOver={handleEditDragOver}
          onDragEnter={handleEditDragEnter}
          onDragLeave={handleEditDragLeave}
        />
        {isEditDraggingOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-primary bg-primary/10">
            <ImagePlus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">{TEXTS.comment.form.dropHere}</span>
          </div>
        )}
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[80px] text-sm"
          placeholder={TEXTS.comment.form.editPlaceholder}
          autoFocus
          onPaste={handleEditPaste}
        />
      </div>
      {editContent && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">{TEXTS.comment.form.preview}</p>
          <MarkdownContent content={editContent} isMobile={isMobile} />
          {linkMetadata && editContent.includes(linkMetadata.url) && (
            <a
              href={linkMetadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
              style={{ maxWidth: '400px' }}
            >
              {linkMetadata.ogImage && (
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={linkMetadata.ogImage}
                    alt={linkMetadata.title}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <div className="p-2 bg-muted/30">
                <p className="text-xs font-semibold truncate">{linkMetadata.title}</p>
                {linkMetadata.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {linkMetadata.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground truncate mt-1">{linkMetadata.url}</p>
              </div>
            </a>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <ImageAttachmentField
          previewUrls={editImagePreviewUrls}
          count={editImagePreviewUrls.length}
          maxCount={MAX_COMMENT_IMAGES}
          onAttach={addEditFiles}
          onRemove={clearEditImage}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelEditing}
            className="h-8 px-2 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            {TEXTS.comment.form.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleUpdate}
            disabled={!canSubmit}
            className="h-8 px-2 text-xs"
          >
            <Check className="mr-1 h-3 w-3" />
            {isUpdating ? TEXTS.comment.form.saving : TEXTS.comment.form.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
