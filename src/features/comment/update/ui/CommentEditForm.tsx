import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X, Check } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { LinkMetadata } from '@/entities/comment/model/comment.schema';

interface CommentEditFormProps {
  editContent: string;
  editImagePreviewUrls: string[];
  isUpdating: boolean;
  canSubmit: boolean;
  isMobile: boolean;
  linkMetadata?: LinkMetadata | null;
  setEditContent: (content: string) => void;
  cancelEditing: () => void;
  handleEditPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  clearEditImage: (index: number) => void;
  handleUpdate: () => void;
}

export function CommentEditForm({
  editContent,
  editImagePreviewUrls,
  isUpdating,
  canSubmit,
  isMobile,
  linkMetadata,
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
          {linkMetadata && (
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
      {editImagePreviewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {editImagePreviewUrls.map((url, index) => (
            <div
              key={url}
              className="relative inline-block border border-border rounded-md overflow-visible"
            >
              <img
                src={url}
                alt={`Pasted preview ${index + 1}`}
                className="max-h-32 object-contain rounded-md"
              />
              <button
                type="button"
                onClick={() => clearEditImage(index)}
                title={TEXTS.comment.form.removeImage}
                className={cn(
                  'absolute -top-2 -right-2 h-5 w-5 rounded-full',
                  'bg-black border border-black shadow-sm',
                  'text-white hover:bg-zinc-700 hover:scale-110',
                  'flex items-center justify-center transition-all duration-150 cursor-pointer'
                )}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
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
