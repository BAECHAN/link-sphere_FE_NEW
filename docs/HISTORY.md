### 2026-03-02
- 배포 시 발생하던 흰 화면 문제를 성공적으로 해결하여, 서비스가 정상적으로 표시되도록 개선했습니다.

### 2026-03-02
 - 전역 에러 처리 기능을 구현하여 애플리케이션의 안정성을 높였으며, 500 서버 오류 발생 시 사용자에게 적절한 안내 페이지를 제공하도록 개선했습니다.

### 2026-03-02
- 댓글 및 답글에 대한 FCM(Firebase Cloud Messaging) 기반 푸시 알림 기능이 추가되었습니다.

### 2026-03-02
- 프로젝트의 `package.json` 스크립트 및 README 테스트 문서화를 개선하여 코드 구조의 명확성과 유지보수성을 높였습니다.

```markdown
### 2026-03-02
- 안정적인 코드 품질 관리를 위한 테스트 인프라를 성공적으로 구축하였습니다.
```

### 2026-03-02
- 공유 UI 컴포넌트의 Storybook 스토리를 추가하여 개발 편의성 및 문서화를 강화하고, 타입 에러를 수정하여 코드 안정성을 개선했습니다.

### 2026-03-01 
- 포스트 좋아요 및 북마크 기능이 추가되었습니다.
- 포스트 도메인의 기능 및 API 구조가 대폭 개선되었으며, 댓글 기능과 Interaction API가 독립적인 feature 단위 및 도메인으로 분리되었습니다.
- 공유 유틸리티(useImagePaste) 및 재사용 가능한 액션 버튼(ActionButton) 컴포넌트가 추가되었습니다.
- PostList, PostDetailPage 등 포스트 관련 UI 및 공통 UI 설정이 정리되고 PostCard 컴포넌트의 위치가 최적화되었습니다.

### 2026-03-01
- 애플리케이션 아키텍처 및 코드 품질 강화를 위한 대규모 리팩토링을 완료했습니다. `app/layouts` 기반으로 레이아웃 구조를 표준화하고, 인증 도메인 관련 로직(훅, 스키마, 스토어, 유틸)을 도메인 및 공유 레이어로 재배치하여 모듈 간 응집도와 재사용성을 높였습니다. 더불어, 아키텍처 및 안티패턴 방지를 위한 ESLint 규칙을 설정하여 코드 일관성과 유지보수성을 대폭 향상시켰습니다.

### 2026-03-01
- 네비게이션 바 검색 기능 전체 구현 및 사용자 경험 향상

### 2026-03-01
- `usePostList` 훅의 무한 스크롤 `rootMargin` 값을 3000px로 조정하여 다음 페이지 콘텐츠 로딩 시점을 앞당겼습니다.

```markdown
### 2026-02-28
- 무한 스크롤 다음 페이지 로딩 성능 개선을 위해 `rootMargin` 값을 600px에서 1000px로 조정했습니다.
```

### 2026-02-28

- Intersection Observer의 `rootMargin`을 600px로 설정하여 무한 스크롤의 다음 페이지 로딩 시점을 앞당기고 성능을 향상했습니다.

### 2026-02-28

- 게시물 수정 기능 도입을 위해 관련 UI, API, 라우팅 등 필수 기술 스택을 추가하고 통합했습니다.

### 2026-02-26

- 게시글 상세 페이지로 직접 접속 시, 뒤로가기 동작이 유효하지 않은 페이지로 이동하는 문제를 해결하여 내비게이션의 안정성을 향상했습니다.

### 2026-02-26

- 댓글 제출 및 파싱 과정에서 줄바꿈 처리 방식을 통일하여 콘텐츠 표시의 일관성과 정확성을 향상했습니다.

### 2026-02-25

- 모바일 환경에서 링크 복사 시 불필요한 토스트 알림을 방지하여 사용자 경험을 최적화했습니다.

### 2026-02-25

- 댓글 입력 및 수정 기능에 마크다운(Markdown) 실시간 미리보기 기능을 추가하여 사용자 작성 편의성과 최종 콘텐츠 정확도를 향상시켰습니다.

### 2026-02-24

- 댓글 기능 고도화:
  - 이미지 붙여넣기 업로드 기능
  - 링크 등록 시 링크 클릭 활성화 ( anchor 태그로 생성 )
  - 링크는 모바일에서는 현재 탭에서 열리도록, 웹에서는 새 탭에서 열리도록 하여, 기기 별로 대처
  - 작성자 식별 뱃지 시스템 구현

### 2026-02-24

- CSS 파일 내 Pretendard 폰트 경로 문제를 해결하여 안정적인 폰트 로딩을 보장하고, 사용자 인터페이스의 시각적 일관성을 개선했습니다.

### 2026-02-24

- 가변 폰트(Pretendard)를 도입하여 렌더링 성능을 최적화하고, 불필요한 정적 폰트 설정 및 프리로드를 제거하여 웹 애플리케이션의 로딩 효율을 개선했습니다.
- 댓글 작성자에게 '작성자' 배지를 시각적으로 표시하는 기능을 구현하여, 사용자 경험(UX)을 향상시키고 정보 식별성을 높였습니다.

---

### [YYYY-MM-DD]

- 인증 시스템의 안정성과 오류 처리 능력을 향상시키기 위해 누락 및 유효하지 않은 리프레시 토큰에 대한 전용 에러 코드를 추가하여, 보다 예측 가능하고 견고한 API 응답을 제공합니다.

### 2023-11-20

- **Gemini 기반 자동 히스토리 업데이트 워크플로우 구축 및 개발 프로세스 최적화**
  최신 AI 기술(Google Generative AI)을 활용하여 프로젝트 히스토리 문서를 자동으로 생성하고 업데이트하는 워크플로우를 성공적으로 구축했습니다. 이를 통해 수동 문서화 작업에 소요되는 시간을 대폭 절감하고 개발 생산성을 향상시켰습니다.
  - 기존 pre-push 훅을 제거하여 개발자의 커밋 및 푸시 과정을 간소화하고 전체 개발 워크플로우의 효율성을 증대시켰습니다.
  - 자동 생성된 커밋이 기존 pre-commit 훅과 충돌하지 않도록 예외 처리 로직을 구현하여 시스템 안정성 및 통합성을 확보했습니다.
  - `@google/generative-ai` 패키지 통합을 통해 실질적인 AI 적용 역량을 입증하고, 개발 환경에서의 AI 활용 가능성을 확장했습니다.

```markdown
### [날짜] v[버전명]

- 사용자 경험 및 브랜드 아이덴티티 강화를 위해 기본 Vite 아이콘을 사용자 정의 파비콘 및 웹 매니페스트로 교체하여 애플리케이션의 시각적 통일성과 완성도를 높였습니다. 이는 PWA(Progressive Web App) 기능의 초기 기반을 마련하고, 사용자가 홈 화면에 앱을 추가했을 때의 경험을 개선하는 데 기여합니다.
```

# Link Sphere Project History

이 문서는 프로젝트의 개발 내역을 시간 순서대로 기록합니다.

## 10단계: 검색 기능 확장 및 UX 편의성 개선 (Search Expansion & UX Improvements)

- `feat`: 게시물 목록 검색에 닉네임 필터링 기능 추가 및 연동
  - 닉네임 `#` 프리픽스를 인식하는 파서 구조 추가 및 백엔드 API 검색 연동
- `feat`: 목록과 상세 페이지 간 이동 시 이전 스크롤 위치 보존 기능 구현
- `feat`: 게시물 목록 최초 로딩 시 상단 NProgress 바를 표시하여 응답성 시각화
- `fix`: PostCard 컴포넌트 내부 드롭다운 메뉴 사용 시 `pointer-events: none` 속성이 해제되지 않던 버그 수정 (비모달 방식 변경)
- `chore`: GitHub Actions History 워크플로우를 위한 패키지 및 SHA 환경변수 전달 로직 수정

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

## 7단계: Form 리팩토링 및 회원가입 구현 (Form Refactoring & Signup)

### Form 컴포넌트 구조 개선

- `a6593dd` refactor: Form 컴포넌트 구조 개선 및 form 디렉토리로 이동
  - `FormField`, `FormInput`, `FormInputPassword`, `FormCheckboxGroup`을 `form/` 디렉토리로 재구조화
  - `FormField` 기본 컴포넌트 추가 (레이블, 설명, 에러 메시지 통합 관리)

### 회원가입 기능 및 UI 개선

- `2a23878` feat: 회원가입 기능 추가 및 인증 폼 개선
  - 회원가입 페이지(`SignUpPage`), 폼(`SignUpForm`), hooks(`useSignUp`) 추가
  - 로그인 폼 및 페이지 개선
- `d8d1026` feat: TooltipWrapper 컴포넌트 추가 및 Button 컴포넌트 개선
  - Tooltip 기능을 제공하는 래퍼 컴포넌트 추가
  - Button 컴포넌트 개선

### 설정 및 에러 핸들링

- `9936f4f` chore: 라우트 경로, 텍스트 설정 및 React Query 에러 핸들링 개선
  - 라우트 설정, 텍스트 상수 업데이트
  - React Query 에러 핸들링 로직 개선

### Auth 도메인 리팩토링

- `6000f79` refactor: Auth API 및 스키마 구조 개선
  - Account 중심의 스키마 구조로 통일 (LoginRequest → Login, Member → Account)
  - `useCreateAccountMutation` 추가 및 409 Conflict 에러 핸들링 구현
  - 로그인/회원가입 스키마 및 hooks 개선

### API 및 도메인 정리

- `b13d88e` refactor: API 클라이언트 에러 처리 개선 및 Member 도메인 제거
  - API 에러 응답 JSON 파싱 개선 (텍스트 응답 처리)
  - signup 엔드포인트 추가
  - 미사용 Member 도메인 스키마 및 유틸 제거

### Post 스키마 통일

- `42c9da5` refactor: Post 스키마 개선 및 의존성 업데이트
  - Post 스키마를 Account 기반으로 통일
  - 앱 라우팅 업데이트 (SignUpPage 추가)
  - shadcn/ui sonner 패키지 추가 (Toast 알림용)

### 백엔드 테스트

- `f942091` test: MemberService 테스트 추가
  - MemberService 단위 테스트 구현

## 8단계: 배포 자동화 및 기능 개선 (Deployment & Features)

### 배포 (Deployment)

- `feat`: S3 및 CloudFront 배포를 위한 GitHub Actions 워크플로우 추가
  - 빌드, S3 업로드, CloudFront 캐시 무효화 자동화
  - OIDC 인증 방식 적용 및 보안 강화
- `fix`: 배포 환경 변수 및 권한 설정 수정
  - Vite API URL 환경 변수 업데이트
  - GitHub Pages 권한 제거 및 AWS OIDC 권한 명시
- `chore`: GitHub Actions 배포 워크플로우 최적화 (`paths` 허용 리스트 방식 적용)

### 기능 (Features)

- `feat`: 게시글 상세 페이지 및 삭제 기능 구현
  - 게시글 상세 조회 및 삭제 로직 추가
  - 공통 모달 시스템 도입
- `feat`: 날짜 유틸리티 개선
  - `DateUtil` 도입으로 타임스탬프 포맷팅 표준화 (Asia/Seoul 기준)
- `refactor`: 로그인 훅 리팩토링
  - 불필요한 기본값 및 useEffect 제거로 로직 간소화

## 9단계: 댓글 상호작용 및 UI 고도화 (Comment Interactions & UI Enhancement)

- `feat`: 댓글 수정 기능 구현 및 UI 개선
  - `CommentItem` 수정 모드(textarea) 및 저장/취소 기능 구현
  - 댓글 내용 줄바꿈(`whitespace-pre-wrap`) 및 단어 끊김 방지 적용
  - `useUpdateCommentMutation` 추가 및 실시간 목록 무효화 연동
  - 버튼 타입 명시 및 시맨틱 마크업 보완
