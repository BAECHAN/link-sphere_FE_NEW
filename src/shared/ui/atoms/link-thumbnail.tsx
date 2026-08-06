import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

interface LinkThumbnailProps {
  src?: string | null;
  alt: string;
  /** 이미지 요소에 추가할 클래스 (호버 확대 등 호출부별 연출) */
  className?: string;
}

/**
 * 외부 링크의 og:image 썸네일.
 * 원본 사이트가 이미지를 내리거나 차단하면 브라우저 기본 깨진 아이콘 대신 영역을 통째로 감춘다.
 */
export function LinkThumbnail({ src, alt, className }: LinkThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  // src가 바뀌면(게시글 URL 수정 등) 이전 URL의 에러 상태를 들고 있지 않는다
  useEffect(
    function resetErrorOnSrcChange() {
      setHasError(false);
    },
    [src]
  );

  if (!src || hasError) {
    return null;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      <img
        src={src}
        alt={alt}
        className={cn('object-cover w-full h-full', className)}
        // 우리 도메인이 Referer로 노출되면 핫링크 차단으로 403을 주는 CDN이 있다(네이버
        // blogthumb 등). Referer를 아예 보내지 않으면 정상 응답한다.
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
