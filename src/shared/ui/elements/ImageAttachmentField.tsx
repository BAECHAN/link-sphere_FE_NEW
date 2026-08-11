import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { Button } from '@/shared/ui/atoms/button';

interface ImageAttachmentFieldProps {
  previewUrls: string[];
  count: number;
  maxCount: number;
  onAttach: (files: FileList) => void;
  onRemove: (index: number) => void;
}

/**
 * 댓글 이미지 첨부 버튼 + 미리보기 그리드.
 * CommentForm/CommentEditForm에 중복돼 있던 미리보기 마크업을 공통 컴포넌트로 뺀 것 —
 * 마크업 자체는 그대로 옮겼다.
 */
export function ImageAttachmentField({
  previewUrls,
  count,
  maxCount,
  onAttach,
  onRemove,
}: ImageAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFull = count >= maxCount;

  return (
    <div className="min-w-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isFull}
        title={TEXTS.comment.form.attachImage}
        className="h-11 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ImagePlus className="h-4 w-4" />
        <span className="sm:hidden">
          {TEXTS.comment.form.attachImage} {count}/{maxCount}
        </span>
        <span className="hidden sm:inline">
          {TEXTS.comment.form.attachHint} {count}/{maxCount}
        </span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            onAttach(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {previewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {previewUrls.map((url, index) => (
            <div
              key={url}
              className="relative inline-block border border-border rounded-md overflow-visible"
            >
              <img
                src={url}
                alt={`Pasted preview ${index + 1}`}
                className="max-h-32 max-w-full object-contain rounded-md"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
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
    </div>
  );
}
