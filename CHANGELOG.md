# Changelog

이 프로젝트(Link-Sphere FE)의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
버전 표기는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 사용합니다.

## [Unreleased]

### Added

- **모바일 하단 탭바** — 모바일 화면에 항상 보이는 하단 탭바 추가(홈 · 링크 등록 ·
  북마크). 탭 1번 터치로 이동하며 현재 위치를 하이라이트. (검토했던 좌우 스와이프 전환
  방식은 앱 특성상 부적합하다고 판단해 철회)

### Fixed

- **북마크 폴더 선택 팝업에 닫기(X) 버튼이 2개 보이던 문제 수정** — 다이얼로그 기본
  닫기 버튼과 커스텀 헤더의 닫기 버튼이 우상단에 겹쳐 X가 두 개로 보였음. 공용
  `Dialog`에 기본 닫기 버튼을 끌 수 있는 옵션을 추가하고, 폴더 선택 팝업은 커스텀 헤더
  버튼만 사용하도록 수정.
- **북마크 화면에서 북마크 취소가 즉시 반영되지 않던 문제 수정** — 카드 상세에서
  북마크를 취소하면 API는 성공했으나 폴더 목록·전체 건수·폴더별 건수가 갱신되지 않았음.
  북마크 토글 시 folder 계열 캐시(목록·건수)를 낙관적으로 반영하도록 수정해, 취소한
  카드가 즉시 사라지고 건수도 함께 감소.

## [0.2.0] - 2026-07-11

### Added

- **북마크 페이지 내 검색** — 북마크 페이지에 전용 검색창 추가. 이제 전체 피드가
  아니라 현재 선택된 폴더(전체 · 미분류 · 사용자 폴더) 범위 내에서만 제목·설명·태그로
  검색됨. 검색어는 URL 쿼리 `q`로 동기화. (상단 네비바 전역 검색은 기존대로 전체 피드)

### Notes

- BE API 의존: `GET /bookmark/folders/{folderKey}/posts` 의 `search` 파라미터 필요
  (BE `v0.2.0`)

## [0.1.1] - 2026-06-28

### Changed

- 옵티미스틱 토글(좋아요·북마크) 실패 시, 기존엔 일반 에러 토스트가 떴으나
  앞으로는 토스트 없이 UI를 즉시 롤백 (옵티미스틱 UI 표준 동작)

### Fixed

- 에러 토스트가 두 번 뜨던 문제 수정. fetch 클라이언트(transport)·React Query
  전역 핸들러·개별 hook 세 레이어가 같은 에러에 각자 토스트를 띄우던 구조를,
  전역 핸들러를 "기본 토스트"의 단일 소유자로 통일하고 자체 토스트를 띄우는
  mutation에는 `manualErrorHandling`을 부여해 중복 제거 (로그인 실패 · 401/403 ·
  폴더/북마크 플로우)
- 프로필 이미지 업로드 시 일부 인앱 브라우저(예: 네이버 인앱)에서
  multipart 전송이 실패해 `imageUrl` 없는 비정상 200 응답이 와도
  "성공"으로 처리돼 `image=undefined`로 저장되던 문제 수정.
  업로드 응답을 Zod로 검증해 비정상 응답은 업로드 실패로 처리하고
  실패 토스트를 노출 (잘못된 빈 값 저장 방지)

## [0.1.0] - 2026-06-28

### Added

- **북마크 폴더 페이지** (`/bookmark`) — 폴더별로 북마크를 분류·탐색
  - 좌측 폴더 트리(데스크탑) / 상단 폴더 칩(모바일): 전체 · 미분류 · 사용자 폴더
  - 폴더 CRUD를 페이지 내에서 처리 (생성 / 이름 수정 / 삭제)
  - 정렬 4종 전환(최신 / 오래된 / 제목 / 조회수), URL 쿼리로 `folder`·`sort` 동기화
  - 무한 스크롤 게시글 목록 (기존 PostCard 재사용)
- **북마크 폴더 선택 UX** — YouTube Music 보관함 스타일 (탭 = 즉시 저장)
  - 데스크탑: Popover / 모바일: Bottom Sheet (`FolderSelector`)
  - 현재 폴더 ✓ 표시, "미분류" · "북마크 제거" · "+ 새 폴더 만들기" 항목
  - 북마크 버튼 클릭 시 단순 toggle 대신 폴더 선택 UI 오픈으로 변경
- 사이드바에 "북마크" 네비게이션 항목 추가
- `entities/folder`: 폴더 데이터 레이어(api·queries·schema),
  북마크 이동 시 옵티미스틱 업데이트(`useMoveBookmarkMutation`)

### Changed

- `post.schema`: `userInteractions.bookmarkFolderId` 필드 추가
  (게시글이 속한 폴더 표시용)

### Tests

- `folder.schema` Zod 스키마 및 `useMoveBookmarkMutation` 훅 테스트 추가 (16개)

### Notes

- BE API 의존: `/bookmark/folders` 등 폴더 API,
  `PostResponse.userInteractions.bookmarkFolderId` 필요
- 드래그앤드랍 · 다중 선택 · 폴더 공유는 차후 별도 작업

[Unreleased]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/releases/tag/v0.1.0
