// 상단 "최근 저장한 폴더" 구획에 노출할 개수 — split menu 문헌 기준 고정 개수.
// 흔들리면(2→3→2) 아래 본 목록의 시작 위치도 흔들려 공간기억이 깨진다.
export const RECENT_FOLDER_COUNT = 3;

// 상단 구획 노출 최소 폴더 수 — 이보다 적으면 전체가 한 화면에 보여 상단 구획이
// 이득 없이 중복만 늘린다 (split menu가 유효한 건 본 목록 스캔 비용이 실재할 때뿐).
export const MIN_FOLDER_COUNT_TO_SHOW_RECENT = 6;
