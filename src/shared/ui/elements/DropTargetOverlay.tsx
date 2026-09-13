import { ImagePlus } from 'lucide-react';
import { TEXTS } from '@/shared/config/texts';

type DragEventHandler = (e: React.DragEvent<HTMLElement>) => void;

export interface DropTargetOverlayProps {
  onDrop: DragEventHandler;
  onDragOver: DragEventHandler;
  onDragEnter: DragEventHandler;
  onDragLeave: DragEventHandler;
}

/**
 * 이미지 드래그오버 시 보여주는 히트박스 + 시각 오버레이 한 쌍
 *
 * `useImageAttachments`의 `isDraggingOver`가 true일 때만 부모(`position: relative`)
 * 안에 마운트해서 쓴다. 히트박스는 점선 박스보다 상하로 넓게 잡아 실제 드랍 판정
 * 영역을 확장한다(좌우는 페이지 패딩만큼만 - 그 이상 넓히면 모바일에서 가로 스크롤이
 * 생긴다). 드래그 중에만 마운트하므로 평소엔 텍스트영역 클릭·포커스를 가리지 않는다.
 *
 * @example
 * ```tsx
 * {isDraggingOver && (
 *   <DropTargetOverlay
 *     onDrop={handleDrop}
 *     onDragOver={handleDragOver}
 *     onDragEnter={handleDragEnter}
 *     onDragLeave={handleDragLeave}
 *   />
 * )}
 * ```
 */
export function DropTargetOverlay({
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
}: DropTargetOverlayProps) {
  return (
    <>
      <div
        className="absolute -inset-x-4 -inset-y-18 z-hitbox"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      />
      <div className="pointer-events-none absolute inset-0 z-raised flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-primary bg-primary/10">
        <ImagePlus className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium text-primary">{TEXTS.comment.form.dropHere}</span>
      </div>
    </>
  );
}
