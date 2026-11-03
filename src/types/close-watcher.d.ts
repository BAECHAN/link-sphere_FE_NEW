/**
 * CloseWatcher 타입 선언 — 설치본 TypeScript 5.7의 lib.dom.d.ts에 아직 없다.
 * useBackClosableOverlay.ts가 쓰는 멤버만 선언한다(https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher).
 * Safari·iOS 등 미지원 브라우저가 있어 optional로 두고, 쓰기 전에 기능 감지를 하게 한다.
 */

interface CloseWatcher {
  onclose: ((this: CloseWatcher, event: Event) => void) | null;
  destroy(): void;
}

interface Window {
  CloseWatcher?: new () => CloseWatcher;
}
