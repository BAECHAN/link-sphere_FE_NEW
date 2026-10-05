import { useEffect } from 'react';

/**
 * 마운트된 동안 `<meta name="robots" content="noindex">`를 head에 둔다.
 *
 * SPA는 없는 페이지도 200으로 응답해 검색엔진이 에러 화면을 색인하는 soft 404가 생긴다.
 * Google은 그 대안으로 에러 화면에 JavaScript로 noindex를 넣는 방법을 제시한다
 * (https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
 * 언마운트 시 제거해 정상 페이지로 이동한 뒤까지 남지 않게 한다.
 */
export function useNoIndex() {
  useEffect(function addNoIndexMeta() {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);
}
