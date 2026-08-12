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
 * - 고정하는 건 "어떤 폴더가 몇 번째로 뜨는가"라는 구성/순서뿐이다. 스냅샷은 폴더 id 목록만
 *   찍고, 매 렌더마다 최신 `folders`에서 그 id들을 다시 찾아 반환한다 — 그래야 스냅샷 이후
 *   `bookmarkCount`가 바뀌어도(게시글 삭제/북마크 토글 등) 상단 구획 숫자가 최신으로 보인다.
 *   스냅샷 이후 폴더 자체가 삭제된 경우는 조회 결과가 없으니 자연히 걸러진다.
 * - 스냅샷은 `isFetching`이 꺼지는 순간(= 서버 응답이 최신인 상태) 딱 1회만 찍고, 그 뒤로는
 *   `folders`가 바뀌어도(재검증·다른 탭에서 저장 등) 구성/순서를 다시 계산하지 않는다 — 원칙4.
 *   `isLoading`(캐시 자체가 없을 때만 true)이 아니라 `isFetching`을 봐야 한다: 재방문 시엔
 *   stale 캐시가 있어 `isLoading`은 곧장 false가 되므로, 그 순간 옛 캐시로 스냅샷이 굳어버리면
 *   뒤이은 refetch 결과가 영영 반영되지 않는다(방금 저장한 폴더가 상단에 안 뜨는 버그).
 *   컴포넌트 마운트 시점에 곧바로 계산해서도 안 된다: 로딩 중엔 `folders`가 빈 배열이라, 그
 *   순간 값을 굳혀버리면 데이터가 도착해도 영원히 빈 채로 고정된다.
 * - `sessionKey`(선택): FolderSelector처럼 모달이 열고 닫힐 때마다 새 스냅샷을 찍고 싶으면
 *   그 open 상태를 넘긴다. FolderTree/MobileFolderList처럼 페이지 방문 동안 쭉 떠 있는
 *   화면은 넘기지 않으면 마운트 수명 전체가 하나의 세션이 된다.
 * - 상단 구획에 뜬 폴더도 아래 본 목록에서 빼지 않는다(중복 표시) — 호출부에서 그대로 렌더한다.
 */
export function useRecentFolders(folders: Folder[], isFetching: boolean, sessionKey?: unknown) {
  const [recentFolderIds, setRecentFolderIds] = useState<string[]>([]);
  const snapshottedForSessionRef = useRef<unknown>(Symbol('not-snapshotted'));

  useEffect(
    function snapshotRecentFolderIdsOnceSettled() {
      if (isFetching || snapshottedForSessionRef.current === sessionKey) {
        return;
      }
      snapshottedForSessionRef.current = sessionKey;
      setRecentFolderIds(pickRecentFolders(folders).map((folder) => folder.id));
    },
    [folders, isFetching, sessionKey]
  );

  const recentFolders = recentFolderIds
    .map((id) => folders.find((folder) => folder.id === id))
    .filter((folder): folder is Folder => folder !== undefined);

  return { recentFolders };
}
