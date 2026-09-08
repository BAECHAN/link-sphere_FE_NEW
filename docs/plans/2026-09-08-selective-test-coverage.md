# 고위험 공백에 선별적으로 테스트 추가

## Context

"어떤 파일엔 테스트가 있고 어떤 파일엔 없는데 기준이 뭐냐, 모든 파일에 추가하면 어떠냐"는 질문에서 출발했다.

**기준은 이미 존재한다.** `docs/TESTING.md:107-134`의 "무엇에 테스트를 쓰는가"와 `docs/DECISIONS.md:61-77`(2026-09-08 "결정 3 — 테스트 정책을 있는 그대로 문서화한다")이 같은 질문을 이미 다뤘고, 현재 기준을 세 가지로 명문화해 뒀다: ①버그 리포트를 받은 파일의 회귀 테스트 ②`*.queries.ts`(낙관적 업데이트·캐시 무효화) ③Zod 스키마.

커밋 히스토리로 검증한 결과 이 서술은 사실이다. 테스트 파일 33개의 최초 추가 커밋 대부분이 `fix(...)` 커밋이다 (`fix(post): 링크 수정 화면 진입 시 관심 분야가 초기화되는 문제 수정` → `useUpdatePost.test.tsx` 등).

**"모든 파일에 추가"는 하지 않기로 했다.** 실측 근거:

| 항목                     | 값                               |
| ------------------------ | -------------------------------- |
| 소스 217개 / 테스트 33개 | 15.2%                            |
| 실측 커버리지            | statements 40.15%, branch 30.94% |
| 테스트 코드 총량         | 4,948줄 (대상 소스와 거의 1:1)   |
| 스위트 실행              | 224 케이스 / 5.2초               |

파일 보유율 15%인데 실측 커버리지가 40%인 것은 간접 커버가 상당하다는 뜻이다(`src/shared/store/`는 직접 테스트가 1개뿐인데 70%). 남은 184개에 같은 밀도로 붙이면 8,000~12,000줄이 새로 생기고, 그중 37개는 이미 스토리 32개가 커버하는 `shared/ui`, 23개는 `pages/`·`app/` 조립 코드다.

대신 **깨졌을 때 사용자가 앱을 못 쓰게 되는 경로**와 **순수 함수**에만 선별 추가한다.

### 조사 중 확정된 제외 대상

- `src/shared/utils/common.util.ts`(580줄, 메서드 24개) — 실사용은 `form.util.ts:43`이 부르는 `emptyStringToNull` **1개뿐**. 나머지 23개(`formatToKRW`, `formatPhoneWithHyphen`, `isDeepEqual` 등)는 이 앱에서 호출되지 않는다.
- `src/shared/utils/file.util.ts`(23줄, `FileUtil.downloadFromBlob`) — 레포 전체 **사용처 0개**.

둘 다 테스트 대상에서 뺀다. 죽은 코드에 테스트를 붙이면 나중에 지우기만 더 어려워진다. `.claude/CLAUDE.md` §3("무관한 죽은 코드는 언급만 하고 지우지 않는다")에 따라 삭제도 하지 않고, 발견 사실만 보고한다.

## 작업 단위 (PR 3개)

### PR 1 — 순수 함수 3종

테스트 파일은 전부 소스와 같은 폴더에 colocate(`__tests__/`는 이 레포에 0개). 선례는 `src/shared/utils/date.util.test.ts`·`url.util.test.ts`.

| 대상                                                | 케이스                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/widgets/post/post-list/utils/search-parser.ts` | 빈 문자열 → `{}` / `@카테고리`만 / `#닉네임`만 / 셋 다 섞인 입력 / `@` 여러 개 → 콤마 조인 / 태그 제거 후 남은 공백 정규화 / 아래 경계 케이스                                                                                                                                                                                                                                                                        |
| `src/shared/utils/auth.util.ts` `isTokenExpired`    | 정상 미만료 토큰 → false / 만료 토큰 → true / **exp까지 20초 남은 토큰 → true**(30초 여유 마진, `auth.util.ts:20`) / 점이 없는 문자열 → true / `exp` 없는 payload → true / base64 깨진 토큰 → true                                                                                                                                                                                                                   |
| `src/shared/utils/error.util.ts`                    | `isServerError`: 500대 `ApiError` → true, 4xx → false, `TypeError('Failed to fetch')` → true / `isChunkLoadError`: 3가지 메시지 변형 각각 → true, `Error` 아닌 값 → false / `resolveMessage`: **`ApiError`의 서버 메시지가 그대로 새어나오지 않고 `TEXTS.messages.error.serverError`로 감싸지는지**(보안·UX 정책, `error.util.ts:8-9`), `UserFacingError`는 원문 유지, 그 외는 `TEXTS.errors.unexpected.description` |
| `src/shared/utils/storage.util.ts`                  | 객체 저장 → 조회 라운드트립 / JSON이 아닌 기존 문자열 값 → 원본 반환(하위 호환, `storage.util.ts:40-44`) / `getStorage` 접근이 throw할 때(Safari 프라이빗 모드) → `null` 반환하고 크래시 안 함 / `LocalStorageUtil`·`SessionStorageUtil`이 서로 다른 스토리지를 쓰는지                                                                                                                                               |

`storage.util.ts`는 `getItem` 10곳·`setItem` 9곳·`clear` 23곳에서 쓰여 대상 중 사용 빈도가 가장 높다.

**`search-parser`의 경계 케이스는 실제 함수를 돌려 동작을 확인해 뒀다:**

| 입력                               | 현재 결과                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `"contact me at hong@example.com"` | `category: 'example.com'`, `search: 'contact me at hong'` — 이메일 검색이 불가능하다 |
| `"a#b"`                            | `nickname: 'b'`, `search: 'a'` — 단어 중간의 `#`도 태그로 잡힌다                     |
| `"@@AI"`                           | `category: '@AI'` — `@`가 하나만 벗겨진다                                            |
| `"@"`                              | `search: '@'` — `\S+`가 1자 이상이라 태그로 안 잡히고 검색어로 남는다                |

테스트는 **현재 동작을 그대로 고정**한다(동작 변경은 이 작업의 범위가 아니다). 다만 위 세 가지는 사용자가 실제로 겪을 수 있는 문제라 구현 후 별도로 보고하고, 고칠지 여부는 따로 판단받는다.

### PR 2 — 인증·권한 경로

깨지면 권한 누출이나 "앱이 스피너에서 멈춤"으로 이어지는 영역. 이 PR이 우선순위가 가장 높다.

| 대상                                               | 케이스                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/routes/ProtectedRoute.tsx`                | `isAuthResolved` 전에는 스피너를 띄우고 리다이렉트하지 않는다(`:19-22`의 "새로고침 시 피드로 튕기던" 버그 회귀) / 만료 토큰이면 `restoreAuth` 후 통과 / **첫 진입이 비로그인이면 `state.loginModalOpen: true`로 리다이렉트, 로그인 상태였다가 풀린 경우(로그아웃)엔 state 없이 조용히 리다이렉트**(`:36-42`, `:61-71`) / 로그인 성공 콜백이 원래 경로로 복귀시키는지 |
| `src/entities/user/hooks/useAuth.ts` `restoreAuth` | 이미 인증 상태면 API 호출 없이 true / refresh 성공 → `setAuth` 후 true / refresh가 토큰 없는 응답 → `clearAuth` 후 false / refresh throw → `clearAuth` 후 false                                                                                                                                                                                                      |
| `src/entities/user/hooks/useAppInitialization.ts`  | 비로그인 방문자(`hasStoredSession()` false)는 **네트워크 요청 없이** 즉시 끝난다 / 복원 실패해도 `finally`에서 `setAuthResolved(true)`가 반드시 불린다(안 불리면 `ProtectedRoute`가 영원히 스피너) / `hasInitialized` ref로 중복 실행 방지                                                                                                                           |
| `src/entities/user/hooks/useAuthGuard.ts`          | 로그인 상태 → action 그대로 실행 / 비로그인 → action 실행 안 하고 모달, 그리고 **이전 `onSuccess` 콜백을 `undefined`로 비우는지**(`:22`)                                                                                                                                                                                                                             |
| `src/entities/user/hooks/useProtectedNavigate.ts`  | 로그인 → 즉시 navigate / 비로그인 → 모달 + 콜백이 **`replace: true`로** navigate(`:23-24`의 orphan 히스토리 버그 방지)                                                                                                                                                                                                                                               |
| `src/entities/user/hooks/useAccount.ts`            | `blob:` URL은 `LAST_AVATAR`에 저장하지 않는다(`:13`) / 일반 URL은 저장 / `isLoggedIn` 파생                                                                                                                                                                                                                                                                           |

`useAuth.ts`는 `useAuthStore`·`useLoginMutation`·`authApi.refresh`가 얽혀 MSW 핸들러가 필요하다. `auth.handlers.ts`에 refresh가 이미 있으므로 `server.use()`로 케이스별 오버라이드만 하면 된다.

### PR 3 — folder-tree 훅

2026-09-08 `b48799c`(폴더 고르기 3형제 로직 분리)로 로직이 여기로 옮겨왔는데 테스트가 따라오지 않은 파일들. `docs/TESTING.md:128-134`가 이미 이 사례를 경고로 적어 뒀다.

실제 로직은 두 파일에 몰려 있고 나머지는 얇은 조합·토글이다:

| 대상                                                                                                | 케이스                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCreateFolderForm.ts`                                                                            | 공백만 입력하면 요청을 보내지 않는다 / **`submittingRef`로 연타 시 중복 생성 안 됨** / 성공 시 입력 비우고 `onCreated` 호출 / 실패 시 `folderCreateFailed` 토스트                                                                                                                                                                                               |
| `useFolderActions.ts`                                                                               | 이름이 그대로면 요청 없이 편집 모드만 닫는다 / rename 실패 시 원래 이름으로 롤백(`:51`) / 연타 중복 방지 / **IME 조합 중 Enter는 무시**(`:59-61`, 한글 입력 시 중복 제출 버그) / Escape → 편집 취소 + 이름 복원 / 삭제는 confirm을 거치고, **`onBeforeDelete`가 DELETE 요청보다 먼저 실행된다**(`useFolderTree.ts:32-37`, 선택된 폴더 삭제 후 404 refetch 방지) |
| `useFolderTree.ts`의 `useInlineCreateFolderInput`, `useMobileFolderList.ts`의 `useCreateFolderCard` | IME 가드와 Escape·Blur 처리만 별도로. 두 훅이 같은 키보드 로직을 각자 복제하고 있어 한쪽만 고쳐지는 사고가 나기 쉽다                                                                                                                                                                                                                                            |

**제외**: `useFolderSections.ts`(21줄, 두 쿼리 조합 — 양쪽 다 이미 테스트 있음), `useMobileFolderList`(1줄 별칭), `useCreateFolderInput`·`useFolderChips`(useState 토글). 얇은 래퍼에 테스트를 붙이면 리팩터마다 깨지면서 버그는 못 잡는다.

## 구현 시 지켜야 할 이 레포 관례

- **파일명**: 훅 테스트가 JSX wrapper를 쓰면 `.tsx`가 되고, ESLint `unicorn/filename-case`가 `.tsx`에 PascalCase를 강제해 dot-case 소스명과 어긋난다. 2026-09-08 `1fc8528`이 `React.createElement`로 wrapper를 작성해 `.ts`를 유지하는 선례를 만들었다(`src/entities/post/api/post.queries.test.ts` 등 5개). 새 훅 테스트는 이 선례를 따른다. `ProtectedRoute.test.tsx`는 대상이 PascalCase 컴포넌트라 그대로 `.tsx`.
- **MSW 함정**: `src/mocks/handlers/`의 post/comment/folder 핸들러는 `API_BASE_URL` 접두사 없이 등록돼 있어 그대로는 매칭되지 않는다. 파일 상단에 `` const url = (e: string) => `${API_BASE_URL}${e}` ``를 두고 `server.use()`로 재등록하는 것이 사실상 표준이다(`useCreateComment.test.tsx:19-21` 주석 참고).
- **셀렉터**: UI 문자열은 하드코딩 대신 `TEXTS.*` 참조.
- **훅 테스트**: `renderWithProviders`(컴포넌트용) 대신 파일마다 로컬 `createWrapper(queryClient)`를 재선언하는 것이 관행.
- **로그인 상태**: `useAuthStore.getState().setAuth(token)` 후 `authKeys.account()` 캐시를 `waitFor`로 대기. `src/test/setup.ts`의 `afterEach`가 `clearAuth()`로 자동 정리한다.
- **코드 스타일**: `if`는 항상 중괄호 블록, 가드절 뒤·제어 블록 앞뒤 빈 줄 1줄.

## 문서 갱신

`docs/TESTING.md`의 "무엇에 테스트를 쓰는가"에 네 번째 기준을 추가한다 — **"인증·권한 경로와 순수 함수"**. 기존 세 기준은 사후적(버그가 난 뒤에 붙인다)인데 이 둘은 사전적이라는 점, 그리고 이번에 실측한 수치(커버리지 40.15%, 간접 커버 사례)를 함께 적는다. 21% 보유율 서술도 이번 추가분 반영해 갱신한다.

`CHANGELOG.md`는 건드리지 않는다 — `test` 커밋은 사용자 영향이 없어 기록 대상이 아니다(`.claude/CLAUDE.md` "릴리즈노트 관리").

계획 파일은 `docs/plans/2026-09-08-selective-test-coverage.md`로 PR 1과 함께 커밋하고, PR 본문에 `## 계획 대비 구현` 섹션을 남긴다(`.claude/CLAUDE.md` §11).

## 검증

각 PR마다 순서대로:

1. `pnpm type-check` — `tsc -b --noEmit` (루트 tsconfig로는 0개 파일을 검사하므로 반드시 이 스크립트로)
2. `pnpm test` — 신규 테스트 통과 + 기존 224 케이스 무회귀
3. `pnpm check` — type-check + lint + format:check (`unicorn/filename-case` 위반 여부가 여기서 잡힌다)
4. `pnpm check:docs` — `docs/TESTING.md`를 고쳤으므로 경로·줄번호 정합성 확인
5. `pnpm test:coverage` — 대상 디렉터리 커버리지가 실제로 올랐는지 확인 (현재 `src/shared/utils` 27.07%, `src/app/routes` 0%)

작업은 `EnterWorktree`로 워크트리를 만들어 진행하고, 진입 직후 `cp ../../../.env .` + `pnpm install`을 실행한다. 작업 시작 전 `git log origin/main..main`으로 미푸시 커밋을 확인한다.
