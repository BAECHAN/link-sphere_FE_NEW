import { useMemo } from 'react';

// Ref는 객체 형태 { current: T } 이거나 함수 형태 (node) => void 일 수 있음
type PossibleRef<T> = React.Ref<T> | undefined;

/**
 * 여러 개의 ref를 하나로 합쳐주는 커스텀 훅
 */
export function useMergedRef<T>(...refs: PossibleRef<T>[]) {
  return useMemo(() => {
    // 모든 ref가 비어있다면 null 반환
    if (refs.every((ref) => ref === null)) {
      return null;
    }

    // React 요소의 ref 속성에 전달될 'Callback Ref' 함수
    return (node: T) => {
      refs.forEach((ref) => {
        if (typeof ref === 'function') {
          // 1. 함수형 ref인 경우 (예: (el) => { ... })
          ref(node);
        } else if (ref !== null) {
          // 2. 객체형 ref인 경우 (예: useRef로 만든 것)
          // ref.current는 읽기 전용 속성이 아니므로 직접 할당 가능
          (ref as React.MutableRefObject<T | null>).current = node;
        }
      });
    };
    // refs 배열이 변경될 때만 새로운 함수를 생성 (성능 최적화)
  }, [refs]);
}
