import { useEffect, useRef, useState } from 'react';
import { Folder } from '@/entities/folder/model/folder.schema';

// 상단 "최근 저장한 폴더" 구획에 노출할 개수 — split menu 문헌 기준 고정 개수.
// 흔들리면(2→3→2) 아래 본 목록의 시작 위치도 흔들려 공간기억이 깨진다.
const RECENT_FOLDER_COUNT = 3;

// 상단 구획 노출 최소 폴더 수 — 이보다 적으면 전체가 한 화면에 보여 상단 구획이
// 이득 없이 중복만 늘린다 (split menu가 유효한 건 본 목록 스캔 비용이 실재할 때뿐).
const MIN_FOLDER_COUNT_TO_SHOW_RECENT = 6;

// folderApi.fetchFolderList는 apiClient.get<FolderListResponse>()로 캐싱만 할 뿐 folderSchema로
// 파싱하지 않는다 — 그래서 lastUsedAt은 (Folder 타입상 Date로 보여도) 실제로는 BE가 보낸 원시
// ISO 문자열 그대로 들어온다. Date 인스턴스라고 가정하고 .getTime()을 바로 부르면 프로덕션에서
// 크래시난다. new Date(...)로 감싸면 문자열·Date 어느 쪽이 와도 안전하다.
function toTimestamp(lastUsedAt: Folder['lastUsedAt']): number {
  return new Date(lastUsedAt as string | Date).getTime();
}

function pickRecentFolders(folders: Folder[]): Folder[] {
  const usedFolders = folders.filter(
    (folder) => folder.lastUsedAt !== null && folder.lastUsedAt !== undefined
  );

  if (
    folders.length < MIN_FOLDER_COUNT_TO_SHOW_RECENT ||
    usedFolders.length < RECENT_FOLDER_COUNT
  ) {
    return [];
  }

  return [...usedFolders]
    .sort((a, b) => toTimestamp(b.lastUsedAt) - toTimestamp(a.lastUsedAt))
    .slice(0, RECENT_FOLDER_COUNT);
}

/**
 * "최근 저장한 폴더" 상단 구획 — Sears & Shneiderman split menu 방식.
 * 자주 쓰는 소수를 상단 별도 구획에 두고, 아래 본 목록 순서는 절대 안 바꾼다.
 *
 * - 데이터가 로드된 시점(`isLoading`이 꺼지는 순간)에 딱 1회 스냅샷을 찍고 그 뒤로는
 *   `folders`가 바뀌어도(재검증·다른 탭에서 저장 등) 다시 계산하지 않는다 — 원칙4.
 *   컴포넌트 마운트 시점에 곧바로 계산하면 안 된다: 세 화면 모두 쿼리가 로딩 중일 때
 *   `folders`가 빈 배열이라, 그 순간 값을 굳혀버리면 데이터가 도착해도 영원히 빈 채로 고정된다.
 * - `sessionKey`(선택): FolderSelector처럼 모달이 열고 닫힐 때마다 새 스냅샷을 찍고 싶으면
 *   그 open 상태를 넘긴다. FolderTree/MobileFolderList처럼 페이지 방문 동안 쭉 떠 있는
 *   화면은 넘기지 않으면 마운트 수명 전체가 하나의 세션이 된다.
 * - 상단 구획에 뜬 폴더도 아래 본 목록에서 빼지 않는다(중복 표시) — 호출부에서 그대로 렌더한다.
 */
export function useRecentFolders(folders: Folder[], isLoading: boolean, sessionKey?: unknown) {
  const [recentFolders, setRecentFolders] = useState<Folder[]>([]);
  const snapshottedForSessionRef = useRef<unknown>(Symbol('not-snapshotted'));

  useEffect(
    function snapshotRecentFoldersOnceLoaded() {
      if (isLoading || snapshottedForSessionRef.current === sessionKey) {
        return;
      }
      snapshottedForSessionRef.current = sessionKey;
      setRecentFolders(pickRecentFolders(folders));
    },
    [folders, isLoading, sessionKey]
  );

  return { recentFolders };
}
