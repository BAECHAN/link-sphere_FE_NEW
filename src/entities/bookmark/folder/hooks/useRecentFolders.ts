import { useEffect, useRef, useState } from 'react';
import { Folder } from '@/entities/bookmark/folder/model/folder.schema';
import { FolderUtil } from '@/entities/bookmark/folder/utils/folder.util';

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
 * - `sessionKey`(선택): PostCardBookmarkFolderModal처럼 모달이 열고 닫힐 때마다 새 스냅샷을 찍고 싶으면
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
      setRecentFolderIds(FolderUtil.pickRecentFolders(folders).map((folder) => folder.id));
    },
    [folders, isFetching, sessionKey]
  );

  const recentFolders = recentFolderIds
    .map((id) => folders.find((folder) => folder.id === id))
    .filter((folder): folder is Folder => folder !== undefined);

  return { recentFolders };
}
