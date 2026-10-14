import { NavigationType, type Location } from 'react-router-dom';

/**
 * 라우터가 뒤로/앞으로 가기(POP)로 위치를 바꾼 순간을, React가 그 위치를 커밋하기 전에 알려준다.
 *
 * `v7_startTransition: true` 때문에 목록 쿼리가 suspend하는 동안(정지 구간) 뒤로가기를 하면 같은
 * history 항목으로 돌아가 `location.key`까지 같아진다 - 그러면 React 쪽에서는 커밋된 위치가 한
 * 번도 안 바뀐 것으로 보여 `useLocation`·`useNavigationType`으로는 알 수 없다. 그래서 라우터 자체의
 * 구독(`router.subscribe`)을 쓴다. raw `popstate` 리스너는 docs/DECISIONS.md 뒤로가기 정책의 금지
 * 사항이라 쓰지 않는다.
 *
 * 라우터는 앱당 하나라 app 레이어(RouterProvider.tsx)에서 1회 주입한다. 선례: navigation.ts의
 * NavigationService(모듈 변수 + 1회 주입).
 */
type PopListener = (location: Location) => void;

// @remix-run/router는 package.json에 선언된 의존성이 아니라 직접 import하지 않는다 - createBrowserRouter가
// 돌려주는 라우터 중 여기서 쓰는 부분만 구조 타입으로 받는다
interface RouterSource {
  state: { location: Location };
  subscribe: (
    subscriber: (state: { location: Location; historyAction: NavigationType }) => void
  ) => () => void;
}

const listeners = new Set<PopListener>();
let unsubscribeSource: (() => void) | null = null;

export const RouterEvents = {
  setSource(router: RouterSource) {
    unsubscribeSource?.();

    let lastLocation = router.state.location;

    unsubscribeSource = router.subscribe(({ location, historyAction }) => {
      // 구독 콜백은 로딩 상태·fetcher 변경에도 불린다 - 위치가 실제로 바뀐 경우만 본다
      if (location === lastLocation) {
        return;
      }

      lastLocation = location;

      if (historyAction !== NavigationType.Pop) {
        return;
      }

      listeners.forEach((listener) => listener(location));
    });
  },
  /** 반환값은 구독 해제 함수 - useEffect의 cleanup으로 그대로 돌려준다 */
  onPop(listener: PopListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};

/** 테스트 격리용 - 주입한 라우터 구독과 리스너를 비운다. src/test/setup.ts의 afterEach에서 호출한다. */
export function resetRouterEvents() {
  unsubscribeSource?.();
  unsubscribeSource = null;
  listeners.clear();
}
