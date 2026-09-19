import { useEffect, useRef } from 'react';

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
  onIntersectRef.current = onIntersect;

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
