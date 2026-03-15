import { useState, useEffect, useCallback, useRef } from 'react';

interface UseImagePasteOptions {
  onImageSet?: () => void;
}

/**
 * 클립보드에서 이미지를 붙여넣을 때 사용하는 훅 (다중 이미지 지원)
 * @param onImageSet - 이미지가 추가될 때 호출되는 콜백
 */
export function useImagePaste({ onImageSet }: UseImagePasteOptions = {}) {
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // latest-ref 패턴: 재렌더마다 최신 콜백 유지 → effect deps에 포함 불필요
  const onImageSetRef = useRef(onImageSet);
  onImageSetRef.current = onImageSet;

  useEffect(
    function imagesToPreviewUrlsEffect() {
      if (pastedImages.length === 0) {
        setImagePreviewUrls([]);
        return;
      }

      onImageSetRef.current?.();
      const urls = pastedImages.map((file) => URL.createObjectURL(file));
      setImagePreviewUrls(urls);

      return () => {
        urls.forEach((url) => URL.revokeObjectURL(url));
      };
    },
    [pastedImages]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      setPastedImages((prev) => [...prev, ...imageFiles]);
      e.preventDefault();
    }
  }, []);

  const clearImage = useCallback((index: number) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllImages = useCallback(() => setPastedImages([]), []);

  return {
    pastedImages,
    setPastedImages,
    imagePreviewUrls,
    handlePaste,
    clearImage,
    clearAllImages,
  };
}
