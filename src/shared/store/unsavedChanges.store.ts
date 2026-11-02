import { create } from 'zustand';

/** 이탈 확인창에 쓰는 문구 */
export interface LeaveConfirmTexts {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
}

interface UnsavedChangesState {
  dirtyKeys: Set<string>;
  // 요청을 보내고 응답을 기다리는 폼 → 그동안 이탈 확인창에 쓸 문구(usePendingSubmit)
  pendingSubmits: Map<string, LeaveConfirmTexts>;
  markDirty: (key: string) => void;
  markClean: (key: string) => void;
  markPending: (key: string, texts: LeaveConfirmTexts) => void;
  markSettled: (key: string) => void;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>()((set, get) => ({
  dirtyKeys: new Set(),
  pendingSubmits: new Map(),
  markDirty: (key) => {
    if (get().dirtyKeys.has(key)) {
      return;
    }
    set((state) => ({ dirtyKeys: new Set(state.dirtyKeys).add(key) }));
  },
  markClean: (key) => {
    if (!get().dirtyKeys.has(key)) {
      return;
    }
    set((state) => {
      const next = new Set(state.dirtyKeys);
      next.delete(key);
      return { dirtyKeys: next };
    });
  },
  markPending: (key, texts) => {
    if (get().pendingSubmits.get(key) === texts) {
      return;
    }
    set((state) => ({ pendingSubmits: new Map(state.pendingSubmits).set(key, texts) }));
  },
  markSettled: (key) => {
    if (!get().pendingSubmits.has(key)) {
      return;
    }
    set((state) => {
      const next = new Map(state.pendingSubmits);
      next.delete(key);
      return { pendingSubmits: next };
    });
  },
}));

/**
 * 저장하지 않은 입력이 하나라도 등록돼 있는지 즉시 읽는다.
 * 리액트 렌더를 구독하지 않는 시점(라우터 blocker 판정, beforeunload)에서만 사용한다.
 */
export function hasUnsavedChanges(): boolean {
  return useUnsavedChangesStore.getState().dirtyKeys.size > 0;
}

/**
 * 응답을 기다리는 폼이 있으면 그 폼이 등록한 이탈 확인창 문구를, 없으면 null을 즉시 읽는다.
 * 리액트 렌더를 구독하지 않는 시점(이탈 확인창을 띄울 때)에서만 사용한다.
 */
export function getPendingSubmitTexts(): LeaveConfirmTexts | null {
  const [texts] = useUnsavedChangesStore.getState().pendingSubmits.values();

  return texts ?? null;
}

/**
 * 특정 키를 즉시(동기) 해제한다.
 * 제출 직후 navigate처럼 effect 클린업을 기다릴 수 없는 시점에서 사용한다.
 */
export function clearUnsavedChanges(key: string): void {
  useUnsavedChangesStore.getState().markClean(key);
}

/**
 * 등록된 키를 모두 즉시(동기) 해제한다.
 * 쓰던 글을 버리고 화면을 옮겨야 할 때(다른 회원으로 바뀜, 직접 로그아웃 확인) 그 이동을 이탈 확인창이 막지 않게 한다.
 */
export function clearAllUnsavedChanges(): void {
  if (!hasUnsavedChanges()) {
    return;
  }

  useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
}
