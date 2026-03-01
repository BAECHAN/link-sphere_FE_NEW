import { useState, useEffect, useCallback, useRef } from 'react';

interface UseImagePasteOptions {
  onImageSet?: () => void;
}

/**
 * 클립보드에서 이미지를 붙여넣을 때 사용하는 훅
 * @param onImageSet - 이미지가 설정될 때 호출되는 콜백
 */
export function useImagePaste({ onImageSet }: UseImagePasteOptions = {}) {
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // latest-ref 패턴: 재렌더마다 최신 콜백 유지 → effect deps에 포함 불필요
  const onImageSetRef = useRef(onImageSet);
  onImageSetRef.current = onImageSet;

  useEffect(
    function imageToPreviewUrlEffect() {
      if (pastedImage) {
        onImageSetRef.current?.();
        const url = URL.createObjectURL(pastedImage);
        setImagePreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setImagePreviewUrl(null);
      }
    },
    [pastedImage]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, []);

  const clearImage = useCallback(() => setPastedImage(null), []);

  return { pastedImage, setPastedImage, imagePreviewUrl, handlePaste, clearImage };
}
