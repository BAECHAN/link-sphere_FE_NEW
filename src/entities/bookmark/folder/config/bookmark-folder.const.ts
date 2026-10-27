// 상단 "최근 저장한 폴더" 구획에 노출할 개수 — split menu 문헌 기준 고정 개수.
// 흔들리면(2→3→2) 아래 본 목록의 시작 위치도 흔들려 공간기억이 깨진다.
export const RECENT_BOOKMARK_FOLDER_COUNT = 3;

// 폴더 이름 최대 길이(코드포인트, BE BookmarkFolderService.MAX_FOLDER_NAME_LENGTH와 같은 값·같은 셈법).
// 이름은 말줄임 없이 어절 단위로 줄바꿈해 보여 주는데, 15자면 가장 좁은 자리(360px 폰의 폴더 카드,
// 108px)에서도 보통 2줄에 들어간다 — 실측과 대안 비교는 docs/BOOKMARK.md "폴더 이름 길이" 참고.
export const BOOKMARK_FOLDER_NAME_MAX_LENGTH = 15;
