const MAX_TRACKED_FAILED_IMAGES = 500;
const FAILURES_BEFORE_BLOCK = 2;

/**
 * 이번 세션에서 로드에 실패한 og:image URL의 실패 횟수.
 *
 * 피드는 가상 스크롤이라 뷰포트를 벗어난 카드가 언마운트되고, 되돌아오면 <img>가 새로
 * 생성된다. 성공 응답은 `cache-control: immutable`로 브라우저 캐시를 타지만 실패 응답
 * (429/415/404)은 캐시되지 않아 재마운트마다 실제 요청이 나간다 - 프로덕션에서 피드를
 * 6회 왕복시키자 실패 URL 2개가 9번 재요청돼 콘솔 에러가 2→9건 누적했다(직접 측정,
 * Playwright, 2026-09-20). GitHub OG 서버는 IP당 100회 한도(`x-ratelimit-limit`)라
 * 이 재요청이 한도를 계속 소진한다.
 *
 * <img>의 onError는 상태 코드를 주지 않아 429(일시)와 415/404(영구)를 구분할 수 없다.
 * 그래서 TTL로 재시도 시점을 추측하는 대신 세션 한정으로만 기억하고, 일시적 실패에
 * 회복 기회를 한 번 남기기 위해 2회째부터 차단한다. 새로고침·새 탭이면 모듈이 다시
 * 평가돼 비워지고, 그때 og 서버가 회복됐다면 정상적으로 다시 받는다.
 * localStorage/sessionStorage에 남기지 않는 이유도 같다(일시적 실패가 영구 사망으로 굳는다).
 *
 * 무한 스크롤은 상한이 없는 구조라 오래된 것부터 버린다 - 선례: shared/lib/virtual/
 * virtual-snapshot.ts의 MAX_SNAPSHOTS.
 */
const imageFailureCounts = new Map<string, number>();

export function hasImageFailed(src: string): boolean {
  return (imageFailureCounts.get(src) ?? 0) >= FAILURES_BEFORE_BLOCK;
}

export function recordImageFailure(src: string): void {
  imageFailureCounts.set(src, (imageFailureCounts.get(src) ?? 0) + 1);

  if (imageFailureCounts.size <= MAX_TRACKED_FAILED_IMAGES) {
    return;
  }

  // Map은 삽입 순서를 보존한다 - 첫 항목이 가장 오래 전에 실패한 URL이다
  const oldest = imageFailureCounts.keys().next().value;

  if (oldest === undefined) {
    return;
  }

  imageFailureCounts.delete(oldest);
}

/** 테스트 격리용 - 모듈 스코프 상태를 비운다. src/test/setup.ts의 afterEach에서 호출한다. */
export function resetFailedImages(): void {
  imageFailureCounts.clear();
}
