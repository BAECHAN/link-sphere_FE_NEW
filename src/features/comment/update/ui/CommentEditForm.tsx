import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X, Check } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';

interface CommentEditFormProps {
  editContent: string;
  editImagePreviewUrl: string | null;
  isUpdating: boolean;
  canSubmit: boolean;
  isMobile: boolean;
  setEditContent: (content: string) => void;
  cancelEditing: () => void;
  handleEditPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  clearEditImage: () => void;
  handleUpdate: () => void;
}

export function CommentEditForm({
  editContent,
  editImagePreviewUrl,
  isUpdating,
  canSubmit,
  isMobile,
  setEditContent,
  cancelEditing,
  handleEditPaste,
  clearEditImage,
  handleUpdate,
}: CommentEditFormProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="min-h-[80px] text-sm"
        placeholder={TEXTS.comment.form.editPlaceholder}
        autoFocus
        onPaste={handleEditPaste}
      />
      {editContent && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">{TEXTS.comment.form.preview}</p>
          <MarkdownContent content={editContent} isMobile={isMobile} />
        </div>
      )}
      {editImagePreviewUrl && (
        <div className="relative inline-block border border-border rounded-md overflow-hidden group">
          <img src={editImagePreviewUrl} alt="Pasted preview" className="max-h-32 object-contain" />
          <Button
            type="button"
            variant="ghost"
            onClick={clearEditImage}
            title={TEXTS.comment.form.removeImage}
            className={cn(
              'absolute top-1 right-1 h-auto w-auto p-1',
              'bg-black/50 text-white rounded-full',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-black/70'
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex justify-end gap-2">
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
  );
}
