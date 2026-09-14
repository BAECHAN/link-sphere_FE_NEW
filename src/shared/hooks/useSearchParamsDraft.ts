import { useCallback, useEffect } from 'react';
import { NavigateOptions, useLocation, useSearchParams } from 'react-router-dom';

/**
 * 아직 커밋되지 않은 URL 쓰기 의도. react-router의 `useSearchParams()`는 라우터가 실제로
 * `location.search`를 갱신하기 전까지 같은 URLSearchParams 인스턴스를 memo해서 돌려주므로
 * (`v7_startTransition: true`로 목록 쿼리가 suspend하는 동안 특히 그렇다), 그 정지 구간 안에서
 * 연속으로 조작하면 "다음 조작이 무엇을 기준으로 계산해야 하는가"를 어딘가는 들고 있어야 한다.
 *
 * URL은 라우터당 하나뿐인 공유 자원이라 pending 의도도 하나만 있으면 된다 - 그래서 훅
 * 인스턴스(useRef)가 아니라 모듈 스코프에 둔다. 선례: shared/lib/router/navigation.ts의
 * NavigationService(모듈 let + 1회 주입, "라우터는 앱당 하나"라는 같은 전제).
 */
let pendingIntent: { locationKey: string; params: URLSearchParams } | null = null;
let lastSeenLocationKey: string | null = null;

/** 테스트 격리용 - 모듈 스코프 상태를 비운다. src/test/setup.ts의 afterEach에서 호출한다. */
export function resetPendingSearchParams() {
  pendingIntent = null;
  lastSeenLocationKey = null;
}

/**
 * URL 쿼리 파라미터를 mutation 없이 읽고 쓰는 훅.
 *
 * `useSearchParams()`가 돌려주는 인스턴스를 `.set()`/`.delete()`로 직접 고치는 대신, 매
 * 쓰기마다 사본(draft)을 만들어 그 위에 적용한다. 정지 구간(위 pendingIntent 설명 참고)
 * 안에서 연속으로 쓰면, 두 번째 쓰기는 커밋된 URL이 아니라 **첫 번째 쓰기가 남긴 draft** 위에
 * 이어붙는다 - mutation이 우연히 보장하던 "연속 조작 누적"을 명시적으로 재현한다.
 *
 * 신선도 판정은 `location.key`로 한다(react-router가 push/replace/pop마다 새로 발급).
 * `useSearchParams()` 인스턴스 identity로는 훅 호출부마다 별도 memo라 서로 다른 컴포넌트가
 * pending을 공유할 수 없고, URL 문자열 비교로는 "A→B→A(뒤로가기)"에서 옛 pending이
 * 되살아나는 구멍이 남는다.
 *
 * 읽기(`searchParams`)에는 pending을 섞지 않는다 - 이 값을 쿼리 키나 effect 의존성으로 쓰는
 * 코드가 지금처럼 "커밋된 URL"만 기준으로 돌아야 낙관적 UI 미러와 이중 반영되지 않는다.
 */
export function useSearchParamsDraft() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { key: locationKey } = useLocation();

  // pending 정리는 반드시 effect에서 한다 - 렌더 함수 안에서 하면 안 된다. 정지 구간 동안
  // React는 "새 location으로 렌더 → suspend → 버림"을 반복하는데, 렌더 중에 쓴 모듈 값은
  // 그 렌더가 버려져도 되돌아오지 않는다. effect는 커밋된 렌더에서만 돌아 안전하다.
  useEffect(() => {
    if (lastSeenLocationKey === locationKey) {
      return;
    }

    lastSeenLocationKey = locationKey;
    pendingIntent = null;
  }, [locationKey]);

  const updateSearchParams = useCallback(
    (updater: (draft: URLSearchParams) => void, navigateOptions?: NavigateOptions) => {
      const isFresh = pendingIntent?.locationKey === locationKey;
      const draft = new URLSearchParams(isFresh ? pendingIntent!.params : searchParams);

      updater(draft);

      pendingIntent = { locationKey, params: draft };
      setSearchParams(draft, navigateOptions);
    },
    [locationKey, searchParams, setSearchParams]
  );

  const clearSearchParams = useCallback(
    (navigateOptions?: NavigateOptions) => {
      const empty = new URLSearchParams();

      pendingIntent = { locationKey, params: empty };
      setSearchParams(empty, navigateOptions);
    },
    [locationKey, setSearchParams]
  );

  return { searchParams, updateSearchParams, clearSearchParams };
}
