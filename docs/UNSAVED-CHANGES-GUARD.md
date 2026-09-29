# 폼 이탈 방지 (Unsaved Changes Guard)

> **문서 성격**: 독립 기능 문서(서사형)
>
> **대상 독자**: 이 레포 FE를 처음 보거나 오랜만에 돌아온 개발자.
>
> **읽고 나면**: "dirty"·"전역 레지스트리"가 정확히 무엇을 가리키는지 알고, 새 폼에
> 이 가드를 붙이거나 이탈 판정 조건을 바꿀 수 있다.
>
> **마지막 검토**: 2026-09-29

게시글 등록/수정, 댓글·답글 작성, 댓글 수정, 회원가입 폼에서 저장하지 않은 입력이 있는
상태로 페이지를 벗어나려 하면 한 번 막습니다. 앱 내 이동은 확인 모달, 새로고침·탭 닫기는
브라우저 기본 경고로 처리됩니다.

설계 배경(react-router 단일 blocker 제약, 전역 레지스트리를 택한 이유)은
[DECISIONS.md](./DECISIONS.md)를 참고하세요. 이 문서는 "지금 어떻게 동작하는가"만
다룹니다.

## 1. 쉬운 설명

한 화면에 댓글 폼·답글 폼·수정 폼이 동시에 여러 개 열려 있을 수 있다. 이걸
하나씩 "저장 안 한 입력이 있나요?"라고 따로따로 물어보는 대신, **칠판에
이름표를 붙이는 방식**을 쓴다 — 입력 중인 폼은 각자 자기 이름표(**"dirty
키"**)를 칠판(**"전역 레지스트리"**, Zustand 스토어)에 붙이고, 입력을
지우거나 제출하면 이름표를 뗀다. 페이지를 나가려 할 때는 이 칠판을 한 번만
보면 된다 — **이름표가 하나라도 붙어 있으면** 어느 폼인지 몰라도 무조건
막는다.

```mermaid
flowchart TD
  Nav["페이지 이탈 시도"] --> Auth{"로그인 상태?"}
  Auth -->|"아니오 + 로그인·회원가입<br/>페이지도 아님"| Allow1["통과<br/>(로그아웃 리다이렉트를 막으면 안 됨)"]
  Auth -->|"예<br/>또는 로그인·회원가입 페이지"| AlertOpen{"열려 있는<br/>Alert/Confirm 있음?"}
  AlertOpen -->|있음| BlockAlert["차단하고 그 대화상자만 취소<br/>이탈 확인 모달은 안 띄움"]
  AlertOpen -->|없음| SamePath{"같은 pathname으로<br/>이동?"}
  SamePath -->|예| Allow2["통과<br/>(쿼리 파라미터만 바뀌는 이동)"]
  SamePath -->|아니오| Dirty{"칠판(전역 레지스트리)에<br/>이름표가 하나라도 있나?"}
  Dirty -->|없음| Allow3["통과"]
  Dirty -->|있음| Page{"현재 페이지가<br/>회원가입?"}
  Page -->|예| BlockSignup["차단 → '회원가입을 그만둘까요?' 확인 모달"]
  Page -->|아니오| BlockConfirm["차단 → '작성 중인 내용이 있어요' 확인 모달"]
```

## 2. 전제 지식

React Router의 `useBlocker`(단일 라우트 blocker만 등록 가능하다는 제약)와
Zustand 기본 개념은 안다고 가정한다.

가정하지 않는 것:

- **왜** 전역 레지스트리 방식을 택했는지(react-router가 blocker를 여러 개
  동시에 등록하지 못하는 제약과 그 대안 비교) → [DECISIONS.md](./DECISIONS.md).
  이 문서는 "지금 어떻게 동작하는가"만 다룬다
- 처음 나오는 용어(dirty 키, 전역 레지스트리 등) → §12 용어 사전

## 3. 사용한 도구·기술

**기능 자체를 이루는 것**

- **Zustand** — dirty 키를 전역으로 들고 있는 스토어(§6)
- **React Router `useBlocker`** — 앱 내 네비게이션을 가로채는 유일한 지점
- **`beforeunload` 이벤트** — 새로고침·탭 닫기용 브라우저 기본 경고
- **`shared/ui/elements/modal/alert`** — 확인 모달(Alert/Confirm) 공용 컴포넌트

## 4. 왜 만들었나

댓글·게시글 작성 중 실수로 뒤로가기나 다른 메뉴를 눌러 입력을 통째로 잃는
사고를 막기 위해 만들었다. 여러 폼이 동시에 열릴 수 있는 화면 구조상, 폼마다
따로 이탈을 감시하는 대신 하나의 판단 지점으로 모았다(§5).

## 5. 구조

### `shouldBlockNavigation` 판정 순서

§1 순서도가 실제로 `useUnsavedChangesGuard.ts`의 `shouldBlockNavigation`
함수 하나에 그대로 대응한다. 순서가 중요하다:

1. **로그인 상태가 아니면 통과 — 단 현재 페이지가 게스트 전용 페이지(`PUBLIC_PATHS`,
   `route-paths.ts`: 로그인·회원가입·비밀번호 찾기·비밀번호 재설정 4개 경로)면 예외.**
   로그아웃·세션 만료 시 `ProtectedRoute`의 강제 리다이렉트까지 막으면 폼에(또는 열린
   대화상자에) 갇힌다 — 이 위험은 로그인이 필요한 페이지에서만 있고, `PUBLIC_PATHS`
   4곳은 원래도 `GuestGuard`라 비로그인 전용이라 갇힐 인증 자체가 없다(2026-09-29,
   `isGuestOnlyPage` 추가 — 회원가입 폼 이탈 확인을 붙이려면 이 예외가 먼저 필요했다).
2. **열려 있는 Alert/Confirm이 있으면 차단하되, 이탈 확인 모달은 띄우지
   않고 그 대화상자만 취소 처리한다.** Alert/Confirm은 브라우저 히스토리에
   묶여 있지 않아 뒤로가기가 그대로 페이지를 이동시켜버린다 — 북마크
   페이지처럼 쿼리 파라미터만 바뀌는 이동도 잡아야 해서 이 검사가
   pathname 비교보다 먼저 온다.
3. **같은 pathname으로의 이동이면 통과.** 쿼리 파라미터만 바뀌는 이동(예:
   북마크 페이지의 폴더 전환)까지 막으면 과도하다.
4. **여기까지 왔으면 dirty 키 존재 여부로 최종 판단.** 하나라도 있으면
   차단하고 현재 페이지가 회원가입이면 전용 문구("회원가입을 그만둘까요?"), 아니면
   "작성 중인 내용이 있어요" 확인 모달을 띄운다.

차단됐을 때의 두 갈래(대화상자 취소 vs. 이탈 확인 모달)는 `useEffect`
안에서 분기한다 — Alert/Confirm 때문에 막힌 경우엔 그 대화상자를
`cancelAlert`로 취소 처리하고 이동 자체는 없었던 일로 되돌리며(`blocker.reset()`),
아니면 이탈 확인 모달을 새로 연다.

**왜 회원가입 전용 문구를 따로 뒀나.** [NN/g(Jakob Nielsen)](https://www.nngroup.com/articles/confirmation-dialog/)는
_"너무 자주 외치면 사람들은 질문에 주의를 기울이지 않게 되고, 확인창은 오류를 막는 힘을
잃는다"_ (번역)고 경고한다 — 그래서 회원가입은 폼이 하나뿐이라 "회원가입을 그만둘까요?"처럼
그 페이지 맥락에 맞는 구체적인 문구를 쓴다(pathname이 `/auth/sign-up`인지로 판정).

**"Sign In" 링크는 이메일이 이미 가입된 것으로 확인됐을 때만 확인창을 생략한다**
(`useSignUp.ts`의 `onLoginLinkClick` — `emailCheck.isDuplicate`가 아니면 그냥 return해
일반 네비게이션으로 흘려보낸다). 그 외(단순 입력 중)엔 이 링크도 다른 이탈 경로와 똑같이
확인창이 뜬다. [Cloudscape — Communicating unsaved changes](https://cloudscape.design/patterns/general/unsaved-changes/)는
_"페이지의 버튼·링크로 데이터가 사라지는 동작을 하려 할 때 페이지 내 모달을 띄운다"_ (번역)고
하는데, 이메일 중복이 아니면 이 원칙을 그대로 따르고, 중복으로 확인된 경우에만 로그인하려는
의도가 이미 명확하다고 보고 예외를 둔다(2026-09-29 실사용 피드백으로 두 차례 조정 — §10 참고).

**로그인 페이지 이메일 자동 채움(prefill)**: 회원가입 폼에서 로그인 페이지로 건너가는 두
경로(위 "Sign In" 링크, 그리고 §5의 "회원가입만 갖는 예외"에서 다루는 가입 성공 후
"메일함을 확인해주세요" 화면의 "로그인하러 가기" 버튼) 모두 `location.state`로 이메일을
함께 넘긴다 — `useLogin.ts`가 `location.state.email`(있으면 저장된 이메일보다 우선)을
폼 기본값으로 쓴다. "Sign In" 링크는 이메일 중복이 확인됐을 때만 넘기고(`loginLinkState`,
아직 입력 중이면 어떤 이메일로 로그인할지 알 수 없으므로), "로그인하러 가기" 버튼은
가입에 실제로 쓴 이메일을 항상 넘긴다(`postSignupLoginState`).

### 폼별 dirty 판정 기준

| 폼             | 언제 "작성 중"으로 잡히나                                                                       | 코드 위치             |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| 게시글 등록    | URL·제목·관심분야·공개설정 중 하나라도 기본값에서 바뀌면                                        | `useCreatePost.ts`    |
| 게시글 수정    | 위와 동일(원래 게시글 값 대비)                                                                  | `useUpdatePost.ts`    |
| 댓글/답글 작성 | 텍스트를 한 글자라도 쓰거나, 텍스트 없이 스크린샷만 붙여넣어도 잡힘                             | `useCreateComment.ts` |
| 댓글 수정      | 수정 시작 시점 원본과 비교해 텍스트가 다르거나, 새 이미지를 붙였거나, 기존 이미지 개수가 바뀌면 | `useUpdateComment.ts` |
| 회원가입       | 닉네임·이메일·비밀번호 중 하나라도 입력되면(제출 요청 중엔 잠깐 dirty로 안 잡는다 — §6)         | `useSignUp.ts`        |

### 이탈 방법별 동작

| 이탈 방법                                         | 동작                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| 사이드바·탭바·뒤로가기 등 앱 내 이동              | 확인 모달: "작성 중인 내용이 있어요" / 취소="계속 작성" / 확인="나가기"         |
| 새로고침·탭 닫기·주소창 직접 이동                 | 브라우저 기본 이탈 경고(앱 모달 아님)                                           |
| 열려 있는 Alert/Confirm이 있는 상태에서 이동 시도 | 그 대화상자만 취소되고 이동은 없었던 일이 됨(§5의 2번) — 이탈 확인 모달은 안 뜸 |
| 같은 pathname 안에서의 이동(쿼리만 변경)          | 검사 없이 통과(§5의 3번)                                                        |
| 모달에서 "계속 작성" 클릭                         | 이동 취소, 폼 값 그대로 유지                                                    |
| 모달에서 "나가기" 클릭                            | 이동 진행                                                                       |

**버튼 강조**: "계속 작성"이 채움(primary)이고 오른쪽에 있으며, "나가기"가 outline이고
왼쪽에 있다(연 순간 포커스도 "계속 작성"에 간다) — 반사적으로 눌러도 안전한 쪽이 눌리게
하기 위해서다. 이건 [Alert.tsx](../src/shared/ui/elements/modal/alert/Alert.tsx)의 `emphasis`
옵션 기본값(`'cancel'`, 생략 시 적용)을 이 가드가 그대로 쓰고 있는 것이다 — **모든 confirm
공통 규칙이 아니다.** 삭제·탈퇴처럼 메뉴에서 직접 선택해야만 뜨는 확인창이나, 공개 설정
토글처럼 어느 방향도 위험하지 않은 확인창은 `emphasis: 'confirm'`으로 반대(확인=채움·오른쪽)로
켠다 — 전체 규칙표는 [FE-ARCHITECTURE.md](./FE-ARCHITECTURE.md) §10 참고. 근거와 검토한 대안
(Apple HIG의 destructive 빨강, 현행 유지 등)은 [DECISIONS.md](./DECISIONS.md) 2026-09-29
항목(팔로업 포함) 참고.

### 의도적으로 막지 않는 경우

| 상황                                                | 이유                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 등록/수정 정상 제출 성공 후 이동                    | 제출 직후 즉시 dirty 해제(`clearNow`, §6)하고 이동 → 모달 안 뜸                     |
| 로그아웃·세션 만료 상태                             | `ProtectedRoute`의 강제 리다이렉트를 막으면 폼에 갇히므로 아예 검사 안 함(§5의 1번) |
| 답글 폼 "취소", 댓글 수정 "취소" 같은 폼 내부 버튼  | 페이지 이동이 아니라 가드 대상이 아님 → 즉시 닫힘                                   |
| 아무것도 입력 안 한 상태                            | 애초에 dirty가 아니므로 모달 안 뜸                                                  |
| 같은 pathname 안에서의 이동                         | §5의 3번 — 북마크 페이지의 폴더 전환 등                                             |
| 회원가입 - 이메일 중복 확인된 상태의 "Sign In" 링크 | 로그인하려는 의도가 이미 명확해 확인창 없이 바로 이동(§5 참고) - 클릭 시 dirty 해제 |

### 동시에 여러 폼이 열려 있을 때

상세 페이지엔 댓글 폼 + 답글 폼 + 수정 폼이 동시에 여러 개 뜰 수 있다. **이 중
하나라도 작성 중이면 페이지 이탈이 막힌다.** (예: 최상단 댓글은 다 써놓고 다른
댓글의 답글 폼은 비워둔 채 나가려 해도 최상단 초안 때문에 모달이 뜬다 — 전역
레지스트리 방식이라 등록된 키가 전부 비어야 이동이 허용된다.)

## 6. 상태 모델

### `useUnsavedChangesStore`(`src/shared/store/unsavedChanges.store.ts`)

이 기능 전체가 이 스토어 하나다 — §1의 "칠판"이자 §5에서 반복 언급되는
"전역 레지스트리"의 실체.

| 필드/함수        | 타입                    | 역할                                                  |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| `dirtyKeys`      | `Set<string>`           | 지금 "저장 안 한 입력이 있다"고 등록된 폼 키들의 집합 |
| `markDirty(key)` | `(key: string) => void` | 키를 집합에 추가                                      |
| `markClean(key)` | `(key: string) => void` | 키를 집합에서 제거                                    |

모듈 레벨 헬퍼(React 렌더를 구독하지 않는 시점 — 라우터 blocker 판정,
`beforeunload`에서 씀):

- `hasUnsavedChanges(): boolean` — `dirtyKeys.size > 0`
- `clearUnsavedChanges(key: string): void` — 특정 키를 즉시(동기) 해제.
  제출 직후 navigate처럼 effect 클린업을 기다릴 수 없을 때 쓴다

### `useUnsavedChanges(key, isDirty)`(`src/shared/hooks/useUnsavedChanges.ts`)

폼이 자기 dirty 상태를 레지스트리에 등록하는 훅. **"dirty 키"**란 이 훅의
첫 번째 인자로, 폼 인스턴스를 구분하는 문자열이다 — 실제 호출부 5곳의 값:

| 폼             | 키                                                     |
| -------------- | ------------------------------------------------------ |
| 게시글 등록    | `'post-create'`                                        |
| 게시글 수정    | `` `post-update:${postId}` ``                          |
| 댓글/답글 작성 | `` `comment-create:${postId}:${parentId ?? 'root'}` `` |
| 댓글 수정      | `` `comment-update:${comment.id}` ``                   |
| 회원가입       | `'auth-signup'`                                        |

**회원가입만 갖는 예외** — 두 번째 인자를 `isDirty && !isPending && !isSubmitted`
3개 조건의 AND로 준다(`useSignUp.ts`). **정정(2026-09-29)**: 가입 성공 시 로그인
페이지로 곧장 `navigate`하지 않는다 — `onSubmit`이 `createMember` 성공 직후
`clearNow()`로 dirty를 동기 해제하고 `setIsSubmitted(true)`만 호출해, 같은 페이지
안에서 폼 대신 "메일함을 확인해주세요" 화면(`SignUpForm.tsx`의 `isSubmitted` 분기,
`TEXTS.auth.signup.checkEmailTitle`/`checkEmailDescription`)으로 전환한다. 이 화면의
"로그인하러 가기" 버튼을 눌러야 비로소 `/auth/login`으로 이동한다.

- `!isPending`이 없으면 제출 요청 중에도 폼이 여전히 dirty라 판정돼 그 사이의
  이탈 시도(거의 없지만)가 막힌다 — 요청이 실패하면 `isPending`이 다시 `false`로
  돌아오면서 조건이 다시 `true`가 돼 effect가 자동으로 재등록한다.
- `!isSubmitted`가 없으면 다른 문제가 생긴다 — 이 훅은 렌더마다 반응형으로 다시
  평가되므로, `onSubmit`의 `clearNow()`가 지운 직후에도 `form.formState.isDirty`
  자체는 여전히 `true`라(폼 값은 안 지웠으므로) 바로 다음 렌더의 effect가 그걸 보고
  다시 등록해버린다. 그 결과 브라우저 `beforeunload` 경고가 살아있는 채로 "메일함을
  확인해주세요" 화면에 남는 버그로 실제 재현됐다 — `isSubmitted`를 조건에 넣어 화면이
  전환된 뒤에는 폼이 dirty여도 재등록하지 않도록 막는다.

```typescript
export function useUnsavedChanges(key: string, isDirty: boolean) {
  // isDirty가 true면 markDirty(key), false면 markClean(key)를 effect로 동기화하고,
  // 언마운트 시에는 항상 markClean(key)(작성 중이던 폼이 사라지면 이름표도 뗀다)
  // ...
  return { clearNow: () => clearUnsavedChanges(key) };
}
```

`clearNow`는 제출 성공 직후처럼 "지금 즉시" 해제해야 할 때 동기 호출한다
(§5 "의도적으로 막지 않는 경우").

## 7. 운영 파라미터

해당 없음 — 이 기능에는 주기·건수·타임아웃 같은 운영 파라미터가 없다.

## 8. 코드 지도와 자주 하는 수정

```
src/
├── shared/
│   ├── store/
│   │   └── unsavedChanges.store.ts       # §6 — dirty 키 레지스트리(Zustand)
│   └── hooks/
│       ├── useUnsavedChanges.ts          # §6 — 폼이 자기 dirty 상태를 등록하는 훅
│       └── useUnsavedChangesGuard.ts     # §5 — RootLayout에서 1회만 도는 전역 가드
├── app/routes/layouts/RootLayout.tsx     # 가드 마운트 지점(앱 전체 1곳)
├── shared/ui/elements/modal/alert/alert.store.ts  # §5의 Alert/Confirm 우선 차단 분기가
│                                                    # 참조하는 getOpenAlertId 출처
├── shared/config/texts.ts                # TEXTS.unsavedChanges.* — 확인 모달 문구(.signup은 회원가입 전용)
├── shared/config/route-paths.ts          # PUBLIC_PATHS — §5의 "게스트 전용 페이지" 판정 출처
├── features/post/create/hooks/useCreatePost.ts
├── features/post/update/hooks/useUpdatePost.ts
├── features/comment/create/hooks/useCreateComment.ts
├── features/comment/update/hooks/useUpdateComment.ts
└── features/auth/signup/hooks/useSignUp.ts
```

### 자주 하는 수정

| 하고 싶은 것               | 방법                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 새 폼에 이 가드를 붙이려면 | 폼 훅 안에서 `const { clearNow } = useUnsavedChanges('폼을-구분할-고유-키', isDirty)` 호출 + 제출 성공 직후 `clearNow()` 호출(§6 표의 키 네이밍 패턴을 따른다) |
| 이탈 확인 모달 문구 변경   | `TEXTS.unsavedChanges.*`(`shared/config/texts.ts`)                                                                                                             |
| 특정 상황을 검사에서 제외  | `useUnsavedChangesGuard.ts`의 `shouldBlockNavigation`에 §5 순서대로 분기 추가(순서가 중요 — 로그인 상태 검사보다 먼저 오면 안 됨)                              |

## 9. 검증 결과

댓글/게시글 폼은 `e2e/unsaved-changes.spec.ts`(PUSH·POP 이동, "계속 작성"/"나가기" 분기)가,
회원가입 폼은 `e2e/signup-unsaved-changes.spec.ts`(전용 문구, 이메일 중복 여부에 따른
"Sign In" 링크 분기, 뒤로가기 차단, 제출 실패 후 재등록)가 각각 통합 테스트로 커버한다
(2026-09-29). 그 외 자체 검증 수치는 없다 — `useUnsavedChangesGuard.ts` 자체에 대한
유닛 테스트 파일은 여전히 없다.

## 10. 시행착오

**2026-09-29, 회원가입 페이지 "Sign In" 링크 두 개 → 하나로.** 처음 배포했을 때는
이메일 중복 안내 바로 아래에 확인창을 생략하는 전용 링크를 하나 더 두고, 하단
"이미 계정이 있으신가요? Sign In" 푸터 링크는 그대로 가드 대상으로 남겨뒀다(§5의
Cloudscape 인용도 그 전용 링크만 겨냥한 것이었다). 실사용 중 사용자가 두 링크가
똑같이 "Sign In"이라 어느 쪽을 눌렀는지 구분하지 못했고, 하단 링크를 누르고 나서야
확인창이 뜨는 걸 보고 "이메일 중복이면 가드 안 하기로 하지 않았냐"고 되물었다 —
실제로는 의도대로 동작했지만(하단 링크는 원래도 가드 대상), 화면에 똑같이 생긴
두 링크를 두고 하나만 다르게 동작시킨 것 자체가 혼란의 원인이었다. 전용 링크를
없애고 하단 링크 하나만 남긴 뒤, 그 하나가 항상 확인창을 생략하도록 바꿨다 —
페이지에 "Sign In" 링크가 하나뿐이면 링크마다 다른 규칙을 만들 필요가 없다.

**정정(같은 날, 몇 시간 뒤).** "항상 생략"으로 바꾼 뒤 실사용 확인 결과, 이메일 중복이
아닌 일반적인 입력 중 상태에서도 "Sign In"을 누르면 조용히 입력이 사라지는 게 오히려
문제였다 — 로그인하려는 의도가 명확한 건 "이메일이 이미 가입돼 있다"는 걸 확인한
경우뿐이고, 단순히 폼을 채우다 실수로 누른 경우까지 의도가 명확하다고 볼 근거는
없었다. 링크는 하나로 유지하되, 그 하나의 동작을 `emailCheck.isDuplicate` 조건으로
다시 나눴다 — 중복 확인 시에만 생략, 그 외엔 뒤로가기와 동일하게 확인창. "링크
개수를 하나로 줄인 것"과 "그 링크의 확인창 생략 조건"은 서로 다른 결정이었는데,
처음엔 이 둘을 한 번에 바꿔서 결과적으로 두 번 고치게 됐다.

## 11. 남은 것

현재 알려진 미해결 이슈 없음(**정정, 2026-09-29**: 이전 버전은 이 절에 "인증 강화
계획 FE Phase 5가 배포되면 `navigate('/auth/login')`이 없어질 가능성이 있다"는 미래형
항목을 적어뒀으나, 그 Phase 5는 이미 배포돼 있었다 — `useSignUp.ts`는 이미 `navigate`
없이 `isSubmitted` 상태로 전환하고, 우려했던 재등록 문제도 이미 `!isSubmitted` 조건으로
막혀 있다(§6 참고). 미래 리스크가 아니라 이미 해소된 과거 항목이라 이 절에서 제거했다).

## 12. 용어 사전

- **dirty(키)** — "저장하지 않은 입력이 있다"는 상태 그 자체, 또는 그
  상태를 표시하려고 폼이 레지스트리에 등록하는 문자열 키. 이 문서 전체에서
  가장 많이 쓰이지만 지금까지 정의되지 않았던 용어 — §6 표가 실제 키 값이다
- **전역 레지스트리** — `useUnsavedChangesStore`(§6)를 가리키는 표현. 폼마다
  따로 감시하지 않고 모든 폼의 dirty 여부를 한 곳에 모아두는 방식이라
  "전역"이라 부른다
- **`clearNow`** — `useUnsavedChanges`가 반환하는 함수. 특정 키를
  effect 클린업을 기다리지 않고 즉시 해제한다(§6)
- **`ProtectedRoute`** — 인증이 필요한 라우트를 감싸 비로그인 접근을
  리다이렉트하는 컴포넌트. §5의 "로그인 상태가 아니면 통과" 분기가 이
  리다이렉트를 막지 않기 위한 것이다
