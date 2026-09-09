# entities/user를 auth/account/user 세 엔티티로 분리

## Context

"user라는 이름도 좀 애매한 것 같다"는 사용자 지적에서 출발했다. 조사 결과
`entities/user/` 폴더는 이름과 달리 내용물이 전부 `auth.*.ts` 파일이었다 —
`auth.api.ts`의 `authApi` 객체 하나에 `login`(인증)과 `updateAccount`(프로필
수정)가 같이 있었고, `authKeys`는 `auth.keys.ts`(함수형)와 `auth.queries.ts`
(배열형) 두 곳에 형태가 다르게 중복 정의돼 있었다. 반면 `UserAvatar.tsx`는
"내 계정"이 아니라 게시글·댓글 작성자(남의 프로필) 표시에 주로 쓰이고 있어,
"인증(auth)" · "내 계정(account)" · "공개 사용자 표현(user)" 세 축이 이미
코드 안에 잠재해 있었다.

의도: 이 세 관심사를 실제 폴더 구조로 분리해 이름과 내용을 일치시키고, 부수적으로
발견된 `authKeys` 이중 정의를 하나로 통합한다.

## 결정 근거 (실측·공식 문서 확인)

- FSD 공식 [Authentication 가이드](https://feature-sliced.design/docs/guides/examples/auth):
  "current user(비공개 정보)" vs "user(공개 정보)"가 공식이 가르는 축이다.
  `Account`의 `email`·`role`은 비공개, `post.schema.ts`의 `author`
  (`accountSchema.pick({id,nickname,image})`)는 공개 정보만 — 이 축과 일치.
- 공식 등재 예제 [nukeapp](https://github.com/noveogroup-amorgunov/nukeapp/tree/master/src/entities)은
  `session`과 `user`를 별도 슬라이스로 둔다 — 같은 구도.
- FSD 공식 [Public API — cross-imports](https://feature-sliced.design/docs/reference/public-api):
  entities 레이어의 동일 레이어 슬라이스 참조는 예외적으로 허용된다("often
  unreasonable to eliminate"). 이 레포는 이미 `docs/FE-ARCHITECTURE.md` §1에서
  이 규칙을 미채택으로 기록(entities cross-import 29건 실측)했으므로,
  `entities/auth` → `entities/account` 참조 1건은 새 위반이 아니라 기존
  `auth.keys.ts`가 post·comment·bookmark/folder 3개 슬라이스를 참조하던 결합을
  줄이는 방향이다.
- `docs/DECISIONS.md`(2026-09-09, 엔티티 파일명 접두사 결정)의 선례를 따라
  `git mv` + 파일명/식별자 동시 개명 + `docs/plans/` 스냅샷 + fresh subagent
  대조 절차를 그대로 적용했다.

## 변경 내용

### 1. `entities/user/` → `entities/auth/` + `entities/account/` + `entities/user/`(축소)

| 관심사                                   | 이동 위치                             | 포함                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증(로그인·로그아웃·회원가입·세션 복원) | `entities/auth/{api,hooks,model}/`    | `auth.api.ts`(login/logout/refresh/createAccount/checkEmailAvailability), `auth.keys.ts`(`authKeys`, `handleAuthRestoreSuccess`), `auth.queries.ts`, `auth.schema.ts`(loginSchema/createAccountSchema/passwordValidationSchema), `useAuth`/`useAppInitialization`/`useAuthGuard`/`useProtectedNavigate`  |
| 내 계정(프로필 조회·수정)                | `entities/account/{api,hooks,model}/` | `account.api.ts`(fetchAccount/updateAccount/checkNicknameAvailability), `account.keys.ts`(`accountKeys`, `accountMutationKeys`, `handleAccountUpdateSuccess`), `account.queries.ts`, `account.schema.ts`(accountSchema/updateAccountSchema/nicknameValidationSchema/emailValidationSchema), `useAccount` |
| 공개 사용자 표현                         | `entities/user/ui/`                   | `UserAvatar.tsx`만 (api·hooks 세그먼트 제거)                                                                                                                                                                                                                                                             |

`account.schema.ts`는 nickname·email validator를(계정 데이터 소유자이므로)
자체 보유하고, `auth.schema.ts`가 그 둘을 cross-import해서 `createAccountSchema`를
구성한다 — 반대 방향 import는 없어 파일 단위 순환은 생기지 않는다.

### 2. `shared/types/auth.type.ts` 제거

전체 내용을 위 두 스키마 파일로 분리 이관. `entities/post/model/post.schema.ts`의
`accountSchema` import 경로만 갱신(다른 엔티티 스키마를 참조하는 기존 패턴과 동일).

### 3. `features/auth/profile/` → `features/account/update/`

`useUpdateProfile`→`useUpdateAccount`, `UpdateProfileForm`→`UpdateAccountForm`으로
폴더·파일·심볼을 함께 개명(폴더만 옮기고 이름을 안 맞추는 반쪽 마이그레이션 방지).
`features/auth/signup/`은 그대로 auth 아래 유지(비로그인 상태의 인증 flow,
BE 엔드포인트도 `/auth/signup`).

### 4. `authKeys` 이중 정의 통합 + `accountKeys` 신설

`auth.keys.ts`(함수형)와 `auth.queries.ts`(배열형)에 따로 있던 `authKeys`를
`auth.keys.ts` 하나로 통합(3-Layer 규약대로 keys 파일이 소유). `account`는
`accountKeys.root = ['account']`로 새로 분리 — 캐시 키 문자열이
`['auth','account']` → `['account']`로 바뀐다(런타임 재현 가능한 캐시라
마이그레이션 코드 불필요, 하드코딩 테스트 3곳만 갱신).

### 5. mocks 분리

`mocks/fixtures/auth.fixtures.ts`(`mockLoginResponse`만) + `mocks/fixtures/account.fixtures.ts`
(`mockAccount`, `mockOtherAccount`), `mocks/handlers/auth.handlers.ts`(로그인/가입/refresh/
로그아웃/이메일중복확인) + `mocks/handlers/account.handlers.ts`(계정 조회/수정/닉네임중복확인).
엔티티 분리 선례(bookmark-folder 리네임)와 동일하게 mocks도 엔티티 구조를 따라간다.

### 6. 손대지 않은 것

- `shared/store/auth.store.ts`·`shared/utils/auth.util.ts`·`shared/config/storage-keys.ts`의
  `AUTH.LAST_AVATAR` — 이미 세션/토큰 인프라로 올바르게 좁혀져 있음.
- `API_ENDPOINTS.auth.*` — BE 실제 라우트(`/auth/account` 등)는 FE 폴더 구조와 무관.
- `entities/user/api/auth.keys.ts`의 `authInvalidateQueries.all`은 분리 후 `['auth']`
  트리에 invalidate할 대상이 안 남아(계정 캐시는 `['account']`로 이동) 제거함 — 이미
  프로덕션 미사용 코드였다.
- `useCreateAccountMutation`의 `navigate(API_ENDPOINTS.auth.login)`(원래
  `ROUTES_PATHS.AUTH.LOGIN`이어야 할 기존 버그, 우연히 같은 문자열이라 지금은 무해) —
  이번 리네임과 무관해 그대로 둠.

## 실행 순서

1. 워크트리 생성(`EnterWorktree`) → `.env` 복사 + `pnpm install`
2. `git mv`로 파일 이동/개명 (hooks 5개+테스트, api 4개+테스트, schema 2개+테스트,
   feature 3개+테스트, mocks 2개)
3. 새 파일(`account.api.ts`, `account.keys.ts`, `account.queries.ts`+테스트,
   `auth.schema.ts`) 작성 + 기존 이동 파일 내용을 인증/계정으로 분할
4. 소비처 30여 개 파일의 import 경로 일괄 갱신
5. `shared/api/client.ts`의 `LoginResponse` import를 로컬 타입(`RefreshTokenResponse`)으로
   교체 — entities 참조 시 `shared→entities` 레이어 역방향 위반이 되므로
6. 문서 갱신(`AUTH.md`, `MYPAGE.md`, `FE-ARCHITECTURE.md`, `DECISIONS.md`,
   `.claude/commands/add-schema.md`의 기존에 이미 stale하던 경로)
7. 검증 (아래) → 계획 파일 커밋 → fresh subagent 대조 → PR

## 검증

```bash
npm run type-check   # tsc -b --noEmit — 0 errors
npm run test         # 48 files, 314 tests — all pass
npm run lint         # eslint --max-warnings 0 — 0 errors
npm run check:docs   # 문서-코드 참조 검사 통과
npm run format:check # prettier --check . — 전부 통과
```

잔존 확인:

```bash
grep -rln "entities/user/api\|entities/user/hooks\|shared/types/auth\.type\|features/auth/profile\|UpdateProfileForm\|useUpdateProfile\b" src/   # 결과 없음
find src/entities/user -type f   # ui/UserAvatar.tsx 하나만
```

## 규모

- `git mv`: 21개 파일 (hooks 10, api 8, schema 2, feature 3, mocks 4 — 일부 중복 집계 있음, 실제 rename 21건)
- 신규 파일: 7개 (`account.api.ts`, `account.keys.ts`, `account.queries.ts`+테스트,
  `auth.schema.ts`, `auth.fixtures.ts`, `auth.handlers.ts`)
- import 경로 갱신: 약 30개 소비처 파일
- 문서 갱신: `AUTH.md`, `MYPAGE.md`, `FE-ARCHITECTURE.md`, `DECISIONS.md`(신규 항목),
  `.claude/commands/add-schema.md`
- 로직 변경: `authInvalidateQueries` 제거(미사용 죽은 코드) 외에는 없음 — 순수 구조 리팩터

## 후속 PR로 미루는 것

- `useCreateAccountMutation`의 `navigate(API_ENDPOINTS.auth.login)` 기존 버그 수정
  (`ROUTES_PATHS.AUTH.LOGIN`으로 교체) — 이번 리네임과 무관.
- `docs/FE-ARCHITECTURE.md` mermaid 다이어그램의 기존 누락 edge(post→category,
  post→bookmark/folder 등, 이번 조사에서 발견했으나 무관한 기존 drift) 보정.
