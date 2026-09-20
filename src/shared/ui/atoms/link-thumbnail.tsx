import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hasImageFailed, recordImageFailure } from '@/shared/lib/image/failedImageCache';
import { cn } from '@/shared/lib/tailwind/utils';

interface LinkThumbnailProps {
  src?: string | null;
  alt: string;
  /** 이미지 요소에 추가할 클래스 (호버 확대 등 호출부별 연출) */
  className?: string;
}

/**
 * 외부 링크의 og:image 썸네일.
 * 원본 사이트가 이미지를 내리거나 차단하면 브라우저 기본 깨진 아이콘 대신 자리는 그대로
 * 두고 안내 아이콘만 보여준다 — 실패 시 영역 자체를 없애면(과거 동작) 아래 콘텐츠가
 * 밀려 올라와 레이아웃 시프트가 생기고, 그 순간 마우스가 고정돼 있어도 커서 아래 있던
 * 요소가 바뀌어 pointer/default가 반복 전환되는 문제가 있었다(2026-09-11, Playwright로
 * 마우스 고정 좌표를 이미지 성공/실패 조건만 바꿔 재현 — 41개 지점 중 30개에서 전환 확인).
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

  if (!src) {
    return null;
  }

  // 크롤링된 og:image가 http인 사이트가 있다 - https 페이지에서 그대로 쓰면 Mixed
  // Content 경고가 뜬다. 브라우저가 어차피 https로 자동 업그레이드해 로딩하므로 직접
  // 치환해도 동작은 동일하고 경고만 없어진다.
  const httpsSrc = src.replace(/^http:\/\//, 'https://');

  // 이번 세션에 이미 2회 실패한 URL은 <img>를 아예 만들지 않는다 - 만들면 실패 응답은
  // 캐시되지 않아 재마운트마다 진짜 요청이 나간다(failedImageCache.ts 상단 주석 참고)
  const showFallback = hasError || hasImageFailed(httpsSrc);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-7 w-7 text-muted-foreground" />
        </div>
      ) : (
        <img
          src={httpsSrc}
          alt={alt}
          className={cn('object-cover w-full h-full', className)}
          loading="lazy"
          decoding="async"
          // 우리 도메인이 Referer로 노출되면 핫링크 차단으로 403을 주는 CDN이 있다(네이버
          // blogthumb 등). Referer를 아예 보내지 않으면 정상 응답한다.
          referrerPolicy="no-referrer"
          onError={() => {
            recordImageFailure(httpsSrc);
            // 캐시는 반응형이 아니다 - 지금 떠 있는 이 인스턴스를 폴백으로 바꾸려면
            // state 갱신이 함께 필요하다(이 줄을 지우면 실패해도 화면이 안 바뀐다)
            setHasError(true);
          }}
        />
      )}
    </div>
  );
}
