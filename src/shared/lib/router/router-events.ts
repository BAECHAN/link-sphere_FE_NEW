import { NavigationType, type Location } from 'react-router-dom';

/**
 * 라우터가 위치를 바꾼 순간을, React가 그 위치를 커밋하기 전에 알려준다.
 *
 * `v7_startTransition: true` 때문에 목록 쿼리가 suspend하는 동안(정지 구간) React가 보는 위치는
 * 응답이 올 때까지 이전 그대로다. 그 사이의 "라우터가 이미 가 있는 위치"가 필요한 곳이 둘 있다.
 * - 뒤로/앞으로 가기(POP): 같은 history 항목으로 돌아가면 `location.key`까지 같아져, React
 *   쪽에서는 커밋된 위치가 한 번도 안 바뀐 것으로 보인다(`onPop`)
 * - 목록 "적용 중" 표시: 칩을 누른 뒤 새 목록이 오기 전인지 알려면 최신 위치와 커밋된 위치를
 *   비교해야 한다(`onNavigate`, `getLocation`)
 *
 * 그래서 라우터 자체의 구독(`router.subscribe`)을 쓴다. raw `popstate` 리스너는 docs/DECISIONS.md
 * 뒤로가기 정책의 금지 사항이라 쓰지 않는다.
 *
 * 라우터는 앱당 하나라 app 레이어(RouterProvider.tsx)에서 1회 주입한다. 선례: navigation.ts의
 * NavigationService(모듈 변수 + 1회 주입).
 */
type LocationListener = (location: Location) => void;

// @remix-run/router는 package.json에 선언된 의존성이 아니라 직접 import하지 않는다 - createBrowserRouter가
// 돌려주는 라우터 중 여기서 쓰는 부분만 구조 타입으로 받는다
interface RouterSource {
  state: { location: Location };
  subscribe: (
    subscriber: (state: { location: Location; historyAction: NavigationType }) => void
  ) => () => void;
}

const popListeners = new Set<LocationListener>();
const navigateListeners = new Set<LocationListener>();
let unsubscribeSource: (() => void) | null = null;
let latestLocation: Location | null = null;

function subscribeTo(listeners: Set<LocationListener>, listener: LocationListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export const RouterEvents = {
  setSource(router: RouterSource) {
    unsubscribeSource?.();
    latestLocation = router.state.location;

    unsubscribeSource = router.subscribe(({ location, historyAction }) => {
      // 구독 콜백은 로딩 상태·fetcher 변경에도 불린다 - 위치가 실제로 바뀐 경우만 본다
      if (location === latestLocation) {
        return;
      }

      latestLocation = location;
      navigateListeners.forEach((listener) => listener(location));

      if (historyAction !== NavigationType.Pop) {
        return;
      }

      popListeners.forEach((listener) => listener(location));
    });
  },
  /** 라우터가 지금 가 있는 위치. 주입 전(테스트의 MemoryRouter 등)이면 null */
  getLocation() {
    return latestLocation;
  },
  /** 반환값은 구독 해제 함수 - useEffect의 cleanup으로 그대로 돌려준다 */
  onPop(listener: LocationListener) {
    return subscribeTo(popListeners, listener);
  },
  /** push·replace·pop 모두. 반환값은 구독 해제 함수 */
  onNavigate(listener: LocationListener) {
    return subscribeTo(navigateListeners, listener);
  },
};

/** 테스트 격리용 - 주입한 라우터 구독과 리스너를 비운다. src/test/setup.ts의 afterEach에서 호출한다. */
export function resetRouterEvents() {
  unsubscribeSource?.();
  unsubscribeSource = null;
  latestLocation = null;
  popListeners.clear();
  navigateListeners.clear();
}
