import { useEffect, type RefObject } from 'react';

type KeyCombo = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

type UseKeydownOptions = {
  /**
   * 입력 필드에 포커스가 있을 때 단축키를 무시할지 여부
   * 기본값: true (입력 필드에 포커스가 있으면 단축키 무시)
   */
  ignoreInputFocus?: boolean;
  /**
   * 특정 요소나 그 하위 요소에 포커스가 있을 때만 단축키가 동작하도록 제한합니다.
   * RefObject를 전달하면 해당 요소 내부에 포커스가 있을 때만 콜백이 실행됩니다.
   */
  targetRef?: RefObject<HTMLElement | null>;
};

/**
 * 입력 필드 요소인지 확인하는 함수
 */
function isInputElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea';
  const isContentEditable = element.getAttribute('contenteditable') === 'true';

  return isInput || isContentEditable;
}

/**
 * 입력 필드에 포커스가 있는지 확인하는 함수
 * event.target과 document.activeElement 모두 확인
 */
function isInputFocused(event: KeyboardEvent): boolean {
  // event.target이 입력 필드인지 확인
  if (isInputElement(event.target)) {
    return true;
  }

  // document.activeElement가 입력 필드인지 확인
  const activeElement = document.activeElement;
  if (activeElement && isInputElement(activeElement)) {
    return true;
  }

  return false;
}

/**
 * 키보드 단축키를 처리하는 커스텀 훅
 * @param keyCombo - 감지할 키 조합 설정
 * Windows: Ctrl + key (예: { key: 'b', ctrlKey: true })
 * Mac: Command(⌘) + key로 자동 변환
 * @param callback - 키 입력시 실행할 콜백 함수
 * @param options - 옵션 설정
 */
export function useKeydown(
  keyCombo: KeyCombo,
  callback: (event?: KeyboardEvent) => void,
  options: UseKeydownOptions = {}
) {
  const { ignoreInputFocus = true, targetRef } = options;

  useEffect(() => {
    // macOS 확인 (데스크톱 환경만 고려)
    const isMac = /Mac/i.test(navigator.userAgent);

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. targetRef가 제공된 경우, 포커스가 해당 요소 내부에 있는지 확인
      if (targetRef?.current && !targetRef.current.contains(document.activeElement)) {
        return;
      }

      // 2. 입력 필드에 포커스가 있고 ignoreInputFocus가 true이면 단축키 무시
      if (ignoreInputFocus && isInputFocused(event)) {
        return;
      }

      const isKeyMatch = event.key.toLowerCase() === keyCombo.key.toLowerCase();

      // Mac에서는 ctrlKey 대신 metaKey(Command) 사용
      const isCtrlMatch = keyCombo.ctrlKey
        ? isMac
          ? event.metaKey
          : event.ctrlKey
        : !(isMac ? event.metaKey : event.ctrlKey);

      const isAltMatch = keyCombo.altKey ? event.altKey : !event.altKey;
      const isShiftMatch = keyCombo.shiftKey ? event.shiftKey : !event.shiftKey;

      if (isKeyMatch && isCtrlMatch && isAltMatch && isShiftMatch) {
        event.preventDefault();
        callback(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [callback, keyCombo, ignoreInputFocus, targetRef]);
}
