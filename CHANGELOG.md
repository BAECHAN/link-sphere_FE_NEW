# Changelog

이 프로젝트(Link-Sphere FE)의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
버전 표기는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 사용합니다.

## [Unreleased]

### Fixed

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

[Unreleased]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/releases/tag/v0.1.0
