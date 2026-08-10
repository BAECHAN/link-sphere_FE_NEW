import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { getImageFileSizeError, normalizeSvgDimensions } from '@/shared/lib/image/resizeImage';

interface UseImageAttachmentsOptions {
  /** 총 허용 장수 */
  maxCount: number;
  /** 이미 차지하고 있는 슬롯 수 (수정 폼의 기존 이미지 등) - 매 렌더 현재값을 넘겨야 한다 */
  reservedCount?: number;
  /** 이미지가 추가될 때 호출되는 콜백 */
  onImageSet?: () => void;
}

/**
 * 댓글 이미지 첨부 훅 (붙여넣기·파일 선택·드래그앤드롭 공통)
 * 세 경로 모두 addFiles()를 거치므로 개수·크기 검증이 한 곳에만 있다.
 */
export function useImageAttachments({
  maxCount,
  reservedCount = 0,
  onImageSet,
}: UseImageAttachmentsOptions) {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isDraggingOverLocal, setIsDraggingOverLocal] = useState(false);
  const dragCounterRef = useRef(0);

  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const pageDragCounterRef = useRef(0);

  // 폼 영역에 정확히 올려야만 반응하던 것과 별개로, 뷰포트 어디든 파일 드래그가 들어오는
  // 순간부터 드롭존을 미리 보여주기 위한 전역 감지 - 열린 폼(이 훅의 인스턴스)마다 독립적으로
  // 같은 window 이벤트를 구독하므로 별도 공유 스토어 없이도 전부 동시에 반응한다.
  useEffect(function pageWideDragDetectionEffect() {
    function isFileDrag(e: DragEvent) {
      return !!e.dataTransfer?.types.includes('Files');
    }
    function handleWindowDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) {
        return;
      }
      pageDragCounterRef.current += 1;
      setIsPageDragActive(true);
    }
    function handleWindowDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) {
        return;
      }
      pageDragCounterRef.current -= 1;
      if (pageDragCounterRef.current <= 0) {
        pageDragCounterRef.current = 0;
        setIsPageDragActive(false);
      }
    }
    function handleWindowDragOver(e: DragEvent) {
      // 브라우저 기본 동작(드롭 시 새 탭에서 파일 열기)을 막아야 폼 바깥에 놓아도 페이지가
      // 안 날아간다.
      if (isFileDrag(e)) {
        e.preventDefault();
      }
    }
    function handleWindowDrop() {
      pageDragCounterRef.current = 0;
      setIsPageDragActive(false);
    }
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // latest-ref 패턴: 재렌더마다 최신 콜백 유지 → effect deps에 포함 불필요
  const onImageSetRef = useRef(onImageSet);
  onImageSetRef.current = onImageSet;

  useEffect(
    function imagesToPreviewUrlsEffect() {
      if (images.length === 0) {
        setImagePreviewUrls([]);
        return;
      }

      onImageSetRef.current?.();
      const urls = images.map((file) => URL.createObjectURL(file));
      setImagePreviewUrls(urls);

      return () => {
        urls.forEach((url) => URL.revokeObjectURL(url));
      };
    },
    [images]
  );

  const addFiles = useCallback(
    (files: File[] | FileList) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }

      // 부수효과(toast)는 setState updater 밖에서 실행한다 - StrictMode가 updater를
      // 개발 모드에서 순수성 검증을 위해 두 번 호출하므로, updater 안에 toast를 두면
      // 실제로 두 번 뜬다.
      const remainingSlots = maxCount - reservedCount - images.length;
      if (remainingSlots <= 0) {
        toast.error(TEXTS.validation.imageCountExceeded(maxCount));
        return;
      }

      void (async () => {
        const accepted: File[] = [];
        const errors = new Set<string>();
        for (const file of fileArray) {
          if (!file.type.startsWith('image/')) {
            errors.add(TEXTS.validation.imageFileOnly);
            continue;
          }
          const sizeError = getImageFileSizeError(file);
          if (sizeError) {
            errors.add(sizeError);
            continue;
          }
          accepted.push(await normalizeSvgDimensions(file));
        }
        errors.forEach((message) => toast.error(message));

        const toAdd = accepted.slice(0, remainingSlots);
        if (accepted.length > remainingSlots) {
          toast.error(TEXTS.validation.imageCountExceeded(maxCount));
        }
        if (toAdd.length === 0) {
          return;
        }

        setImages((prev) => [...prev, ...toAdd]);
      })();
    },
    [maxCount, reservedCount, images.length]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length === 0) {
        return;
      }

      e.preventDefault();
      addFiles(imageFiles);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOverLocal(false);

      // 이미지 타입 검증은 addFiles가 담당한다 - 여기서 걸러내면 이미지가 아닌 파일을
      // 드롭했을 때 아무 피드백 없이 조용히 무시된다.
      if (e.dataTransfer?.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  // dragenter/dragleave는 자식 요소를 넘나들 때마다 짝으로 발생하므로, 카운터로 세지 않으면
  // 자식 위를 지날 때마다 isDraggingOver가 깜빡인다.
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingOverLocal(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOverLocal(false);
    }
  }, []);

  const clearImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllImages = useCallback(() => setImages([]), []);

  return {
    images,
    setImages,
    imagePreviewUrls,
    isDraggingOver: isDraggingOverLocal || isPageDragActive,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
    clearAllImages,
  };
}
