import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';

interface ImageAttachmentButtonProps {
  count: number;
  maxCount: number;
  onAttach: (files: FileList) => void;
}

/**
 * 이미지 첨부 버튼 + 숨은 파일 입력. 첨부한 이미지의 썸네일은 ImageAttachmentPreviews가 그린다 - 둘을 나눠 둬야
 * 버튼은 폼의 도구 줄(취소·등록 버튼 옆)에, 썸네일은 그 위 줄에 따로 놓을 수 있다.
 */
export function ImageAttachmentButton({ count, maxCount, onAttach }: ImageAttachmentButtonProps) {
  const uiTexts = useUiTexts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFull = count >= maxCount;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isFull}
        title={uiTexts.imageAttachmentField.attach}
        className="h-11 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ImagePlus className="h-4 w-4" />
        <span className="sm:hidden">
          {uiTexts.imageAttachmentField.attach} {count}/{maxCount}
        </span>
        <span className="hidden sm:inline">
          {uiTexts.imageAttachmentField.hint} {count}/{maxCount}
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
    </>
  );
}
