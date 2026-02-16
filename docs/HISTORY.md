# Link Sphere Project History

이 문서는 프로젝트의 개발 내역을 시간 순서대로 기록합니다.

## 초기 설정 (Initial Setup)

### Backend

- `29acbd2` feat: 초기 프로젝트 설정 및 전체 소스코드 커밋
- `db8638b` docs: create initial README.md file

### Frontend

- `7ce4c30` design: atoms mvp to restart

## 1단계: 프론트엔드 UI/UX 기초 및 컴포넌트 (Frontend Basics)

- `7f196b5` feat: Storybook 환경 구성 및 UI 컴포넌트 스토리 추가, 스타일 시스템 개선
- `50eea61` feat: 폰트 최적화, 테마 시스템 도입 및 빌드 환경 개선
- `08dd0ae` fix: Vite public 경로 관련 폰트 로드 경고 해결
- `42b4432` feat: ScrollToTop 컴포넌트 추가 및 React Query Devtools 위치 조정
- `270e59e` test: ScrollToTop 컴포넌트 스토리 추가

## 2단계: 핵심 기능 구현 (Post & Auth Features)

- `b6920b2` feat: 게시글 관련 페이지 추가 및 라우팅 구조 변경
- `7d8a1a6` feat: 게시글 생성 API 및 관련 훅, UI 컴포넌트 추가
- `0413473` feat: Supabase 인증 기능 추가 및 라우팅 보호 구현
- `0d95703` refactor: 공유 설정 및 타입 리팩토링
- `ed35eec` feat: 공통 API 모듈 추가 (카테고리 옵션)
- `2bb44b4` feat: FormCheckboxGroup 공통 UI 컴포넌트 추가

## 3단계: 리팩토링 및 최적화 (Refactoring)

- `0122ec6` refactor: Member 도메인 스키마 간소화
- `654effa` refactor: Auth 도메인 리팩토링 - 역할(role) 기반 인증 제거

## 4단계: 백엔드 AI 분석 및 비동기 처리 (Backend AI & Async)

- `80d8861` feat: Add Async, SSE, and Gemini AI infrastructure
  - 비동기 처리를 위한 설정 (AsyncConfig)
  - SSE(Server-Sent Events) 서비스 구현
  - Gemini AI 연동 서비스 구현
- `55b2bcc` feat: Implement async post creation with AI analysis
  - 게시글 생성 로직 비동기화
  - AI 분석 및 태그/요약 자동 생성
- `c9de0f5` feat: Implement asynchronous AI post processing for posts and enhance JWT token resolution to support SSE.
  - JWT 토큰 처리 개선 및 SSE 지원 강화

## 5단계: 프론트엔드 리팩토링 및 프로필 연동 (Frontend Refactoring & Profile)

- `feat`: 사용자 프로필 연동 및 Navbar UI 개선
  - `fetchAccount` API 연동 (`useFetchAccountQuery`, `useAccount` hook 추가)
  - Navbar에 로그인한 사용자 아바타 및 이름 표시
- `refactor`: Auth 도메인 API 구조 개선
  - `auth.api.ts`, `auth.keys.ts`, `auth.queries.ts` 외 파일 구조 정리
  - `account` 관련 로직을 `auth` 도메인으로 통합

## 6단계: UI/UX 개선 및 아키텍처 문서화 (UI/UX Improvement & Architecture)

- `fix`: 툴팁 텍스트 사이즈 조정 (모바일/데스크탑 분기 처리)
- `fix`: 모바일 화면 스크롤 방지를 위한 패딩 조정
- `docs`: 에러 핸들링 아키텍처 문서 추가 및 개발 이력 업데이트
