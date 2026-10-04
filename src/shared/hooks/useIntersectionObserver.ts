import { useEffect, useRef, useLayoutEffect } from 'react';

interface UseIntersectionObserverProps {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
  onIntersect: () => void;
  enabled?: boolean;
}

export function useIntersectionObserver({
  threshold = 0.1,
  root = null,
  rootMargin = '0px',
  onIntersect,
  enabled = true,
}: UseIntersectionObserverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // onIntersect가 호출부에서 인라인 함수로 넘어오면 매 렌더 새 참조가 되어 아래 effect의
  // deps에 그대로 두면 렌더될 때마다 observer가 재생성된다. ref에 최신 값을 담아두고
  // deps에서는 빼, observer 인스턴스 자체는 threshold/root/rootMargin/enabled가 바뀔
  // 때만 재생성되게 한다.
  const onIntersectRef = useRef(onIntersect);

  // 렌더 중이 아니라 레이아웃 effect에서 갱신한다 - 렌더 중 ref 쓰기는 React 규칙 위반이고
  // (https://react.dev/reference/eslint-plugin-react-hooks/lints/refs), 공식 대안인
  // useEffectEvent는 React 19.2부터(https://react.dev/blog/2025/10/01/react-19-2)라 React 18인
  // 이 레포에선 쓸 수 없다. 레이아웃 effect는 일반 effect·이벤트보다 먼저 돌아
  // 읽는 쪽은 항상 최신 값을 본다
  useLayoutEffect(() => {
    onIntersectRef.current = onIntersect;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onIntersectRef.current();
          }
        });
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, enabled]);

  return ref;
}
