import { X } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';

interface ImageAttachmentPreviewsProps {
  previewUrls: string[];
  onRemove: (index: number) => void;
}

/**
 * 첨부한 이미지 썸네일 목록과 하나씩 빼는 버튼. 첨부가 없으면 아무것도 그리지 않는다.
 * 첨부 버튼은 ImageAttachmentButton이 따로 맡는다.
 */
export function ImageAttachmentPreviews({ previewUrls, onRemove }: ImageAttachmentPreviewsProps) {
  const uiTexts = useUiTexts();

  if (previewUrls.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {previewUrls.map((url, index) => (
        <div
          key={url}
          className="relative inline-block border border-border rounded-md overflow-visible"
        >
          <img
            src={url}
            alt={uiTexts.imageAttachmentField.imageAt(index + 1)}
            className="max-h-32 max-w-full object-contain rounded-md"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            title={uiTexts.imageAttachmentField.removeAt(index + 1)}
            className={cn(
              'absolute -top-2 -right-2 h-5 w-5 rounded-full',
              'bg-scrim border border-scrim shadow-sm',
              'text-scrim-foreground hover:bg-scrim/70 hover:scale-110',
              'flex items-center justify-center transition-all duration-150'
            )}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
