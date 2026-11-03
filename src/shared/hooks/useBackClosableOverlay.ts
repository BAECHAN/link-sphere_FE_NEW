import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { RouterEvents } from '@/shared/lib/router/router-events';

// 뒤로가기가 닫기 요청으로 오는 기기인지는 화면 폭이 아니라 주 입력 장치로 가른다(usePullToRefresh.ts와 같은 근거)
const TOUCH_POINTER_QUERY = '(pointer: coarse)';

interface OpenOverlayState {
  openKey: string | null;
}

// 열린 오버레이 키는 하나다 - 오버레이를 겹쳐 쌓지 않는다는 전제(docs/DECISIONS.md 2026-08-07)는 히스토리
// 경로와 같다. 카드 밖에 두는 이유: 피드 카드는 가상 목록 행 키(열 수·첫 카드 id) 때문에 화면 회전·목록
// 밀림에서 다시 마운트된다. 카드 안 useState면 그때 모달이 닫히지만, 히스토리 경로는 엔트리에 있어 유지된다.
const useOpenOverlayStore = create<OpenOverlayState>()(() => ({ openKey: null }));

let stopClosingOnNavigate: (() => void) | null = null;

function closeAnyOverlay() {
  stopClosingOnNavigate?.();
  stopClosingOnNavigate = null;
  useOpenOverlayStore.setState({ openKey: null });
}

function openOverlay(key: string) {
  stopClosingOnNavigate?.();
  // 다른 이유로 페이지가 바뀌면(세션 만료로 뜬 로그인 창 등) 닫는다. 카드가 사라진 뒤에도 남는 구독이라,
  // 그 화면으로 돌아왔을 때 모달만 다시 뜨지 않는다
  stopClosingOnNavigate = RouterEvents.onNavigate(closeAnyOverlay);
  useOpenOverlayStore.setState({ openKey: key });
}

function closeOverlay(key: string) {
  if (useOpenOverlayStore.getState().openKey !== key) {
    return;
  }

  closeAnyOverlay();
}

function canCloseWithCloseWatcher() {
  return (
    typeof window.CloseWatcher === 'function' && window.matchMedia(TOUCH_POINTER_QUERY).matches
  );
}

function useCloseWatcherOverlay(key: string) {
  const isOpen = useOpenOverlayStore((state) => state.openKey === key);

  // watcher는 오버레이를 그리는 쪽과 수명을 같이한다 - 그리는 쪽이 사라졌는데 watcher가 남으면 보이지 않는
  // 모달이 다음 뒤로가기를 삼킨다. 다시 마운트되면 열린 키를 보고 새로 만든다.
  // Esc는 Radix와 새 폴더 입력이 keydown을 preventDefault하므로 닫기 요청이 되지 않는다(HTML 표준 close
  // request 단계) - Esc 처리는 지금처럼 Dialog가 맡는다
  useEffect(
    function closeOnCloseRequest() {
      const CloseWatcher = window.CloseWatcher;

      if (!isOpen || !CloseWatcher) {
        return;
      }

      const watcher = new CloseWatcher();
      watcher.onclose = () => closeOverlay(key);

      return () => {
        watcher.destroy();
      };
    },
    [isOpen, key]
  );

  return {
    isOpen,
    open: () => openOverlay(key),
    close: () => closeOverlay(key),
  };
}

/**
 * 뒤로가기로 닫히는 오버레이의 열림 상태. 반환형은 useHistoryOverlay와 같다.
 * - 뒤로가기가 닫기 요청으로 오는 기기(CloseWatcher 지원 + 터치가 주 입력, 사실상 Android)는 히스토리를
 *   쓰지 않는다. 열 때 location이 안 바뀌어 페이지 전체가 다시 렌더되지 않고, 뒤로가기는 CloseWatcher로
 *   받아 모달만 닫는다.
 * - 그 밖의 기기(데스크톱·iOS)는 useHistoryOverlay 그대로다. 데스크톱 브라우저 뒤로가기는 HTML 표준상
 *   닫기 요청이 아니라(https://html.spec.whatwg.org/multipage/interaction.html#close-requests-and-close-watchers)
 *   히스토리 엔트리가 있어야 모달만 닫힌다.
 * 근거와 실측은 docs/DECISIONS.md 2026-11-03 항목.
 *
 * @param key 오버레이마다 고유한 키. 히스토리 경로에서는 location.state 키로 쓴다.
 */
export function useBackClosableOverlay(key: string) {
  // 마운트 때 한 번만 정한다 - 수명 중에 경로가 바뀌면 열린 상태가 다른 쪽에 남는다
  const [closesWithCloseWatcher] = useState(canCloseWithCloseWatcher);
  const historyOverlay = useHistoryOverlay(key);
  const closeWatcherOverlay = useCloseWatcherOverlay(key);

  return closesWithCloseWatcher ? closeWatcherOverlay : historyOverlay;
}

/**
 * useBackClosableOverlay의 열기만 쓰는 쪽. CloseWatcher를 만들지 않고, CloseWatcher 경로에서는 열림 상태도
 * 구독하지 않는다(히스토리 경로는 useHistoryOverlay가 location을 구독해 전처럼 다시 렌더된다).
 * 여는 버튼이 여럿이고(피드 카드마다 북마크 버튼) 오버레이는 한 곳(호스트)이 그릴 때 쓴다 - 버튼마다
 * useBackClosableOverlay를 쓰면 같은 키의 watcher가 버튼 수만큼 생기고, 열 때 모든 버튼이 다시 렌더된다.
 *
 * @param key 오버레이를 그리는 쪽이 useBackClosableOverlay에 넘기는 키와 같아야 한다.
 */
export function useBackClosableOverlayOpen(key: string) {
  const [closesWithCloseWatcher] = useState(canCloseWithCloseWatcher);
  const { open: openWithHistory } = useHistoryOverlay(key);

  return closesWithCloseWatcher ? () => openOverlay(key) : openWithHistory;
}

/** 테스트 격리용 - 열린 키와 이동 구독을 비운다. useBackClosableOverlay.test.tsx의 afterEach에서 호출한다. */
export function resetBackClosableOverlay() {
  closeAnyOverlay();
}
