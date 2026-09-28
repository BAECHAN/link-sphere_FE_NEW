import type { VirtualItem } from '@tanstack/react-virtual';
import { VIRTUAL_SNAPSHOT_INDEX_KEY, virtualListSnapshotKey } from '@/shared/config/storage-keys';

const MAX_SNAPSHOTS = 8;

export interface VirtualSnapshot {
  offset: number;
  columnCount: number;
  count: number;
  items: VirtualItem[];
}

/**
 * 상세 페이지로 나갔다가 <ScrollRestoration/>으로 돌아왔을 때, 가상화된 리스트가 첫
 * 렌더부터 실측 높이로 정확한 문서 높이를 갖도록 저장해 두는 측정값 스냅샷.
 * TanStack Virtual의 `takeSnapshot()` + `scrollOffset`을 `location.key` 단위로
 * sessionStorage에 보관한다 — location.key는 ScrollRestoration이 스크롤 위치를
 * 저장하는 키와 동일한 단위라 항상 같은 히스토리 엔트리에 매칭된다.
 * 실패(프라이빗 모드, 쿼터 초과 등)는 조용히 무시한다 — 복원이 추정값으로
 * 대체될 뿐 화면이 깨지지는 않는다.
 */
export function saveVirtualSnapshot(
  listId: string,
  locationKey: string,
  snapshot: VirtualSnapshot
): void {
  const key = virtualListSnapshotKey(listId, locationKey);

  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
    trackAndPruneIndex(key);
  } catch {
    // 조용히 무시 - 위 설명 참고
  }
}

/**
 * 저장된 스냅샷을 읽는다. count가 저장 시점과 다르면(글 등록·삭제로 목록이 리셋됨)
 * 지금 데이터와 맞지 않으므로 버린다. columnCount는 컨테이너 실측 폭으로 다시 정해지는
 * 값이라 여기서 비교하지 않는다 - 호출부가 저장된 columnCount를 그대로 첫 렌더 열
 * 수로 쓰고, 실측 결과가 다르면 레이아웃 이펙트가 다시 보정한다.
 */
export function loadVirtualSnapshot(
  listId: string,
  locationKey: string,
  count: number
): VirtualSnapshot | null {
  try {
    const raw = sessionStorage.getItem(virtualListSnapshotKey(listId, locationKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as VirtualSnapshot;
    if (parsed.count !== count) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** 삽입 순서를 별도 인덱스에 기록해 오래된 스냅샷부터 지운다 (LRU) */
function trackAndPruneIndex(key: string): void {
  const raw = sessionStorage.getItem(VIRTUAL_SNAPSHOT_INDEX_KEY);
  const index: string[] = raw ? (JSON.parse(raw) as string[]) : [];

  const next = [...index.filter((entry) => entry !== key), key];

  while (next.length > MAX_SNAPSHOTS) {
    const oldest = next.shift();
    if (oldest) {
      sessionStorage.removeItem(oldest);
    }
  }

  sessionStorage.setItem(VIRTUAL_SNAPSHOT_INDEX_KEY, JSON.stringify(next));
}
