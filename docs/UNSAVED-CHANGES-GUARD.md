# 폼 이탈 방지 (Unsaved Changes Guard)

> **문서 성격**: 독립 기능 문서(서사형)
>
> **대상 독자**: 이 레포 FE를 처음 보거나 오랜만에 돌아온 개발자.
>
> **읽고 나면**: "dirty"·"전역 레지스트리"가 정확히 무엇을 가리키는지 알고, 새 폼에
> 이 가드를 붙이거나 이탈 판정 조건을 바꿀 수 있다.
>
> **마지막 검토**: 2026-11-03

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
  Auth -->|"아니오 + 그 화면에 둔 상태(signedOutInPlace)도<br/>게스트 전용 페이지(PUBLIC_PATHS 4개)도 아님"| Allow1["통과<br/>(로그아웃 리다이렉트를 막으면 안 됨)"]
  Auth -->|"예<br/>또는 로그인이 풀린 채 그 화면에 둔 상태<br/>또는 게스트 전용 페이지"| AlertOpen{"열려 있는<br/>Alert/Confirm 있음?"}
  AlertOpen -->|있음| BlockAlert["차단하고 그 대화상자만 취소<br/>이탈 확인 모달은 안 띄움"]
  AlertOpen -->|없음| SamePath{"같은 pathname으로<br/>이동?"}
  SamePath -->|예| Allow2["통과<br/>(쿼리 파라미터만 바뀌는 이동)"]
  SamePath -->|아니오| Dirty{"칠판(전역 레지스트리)에<br/>이름표가 하나라도 있나?"}
  Dirty -->|없음| Allow3["통과"]
  Dirty -->|있음| Pending{"응답을 기다리는 폼이 있나?<br/>(usePendingSubmit, 회원가입·게시글 등록·수정)"}
  Pending -->|있음| BlockPending["차단 → 그 폼이 넘긴 문구로 확인 모달<br/>'이미 가입을·등록을·수정을 요청했어요'"]
  Pending -->|없음| Page{"현재 페이지가<br/>회원가입?"}
  Page -->|예| BlockSignup["차단 → '회원가입을 그만둘까요?' 확인 모달"]
  Page -->|아니오| BlockConfirm["차단 → '작성 중인 내용이 있어요' 확인 모달"]
  BlockConfirm -->|"모달이 떠 있는 동안 저장이 끝나<br/>이름표가 모두 떼어짐(댓글 수정 등)"| AutoClose["모달을 스스로 취소 · 막힌 이동은 버림<br/>→ 폼의 성공 동작이 그대로 통과"]
  BlockPending -->|"모달이 떠 있는 동안 응답이 옴<br/>(성공·실패 모두)"| AutoClosePending["모달을 스스로 취소 · 막힌 이동은 버림<br/>성공 → 폼의 성공 동작(피드·들어온 화면·가입 완료 화면)<br/>실패 → 화면에 머물러 실패 안내, 입력 유지"]
  BlockPending -->|"'나가기'로 떠난 뒤 실패"| LeftFail["옮겨 간 화면에 닫을 때까지 남는 실패 토스트<br/>제목(무엇이 실패) · 설명(이유·할 일) · 돌아갈 버튼"]
  LeftFail -->|"[다시 가입하기]·[다시 등록하기]·[다시 수정하기]"| Restore["그 폼으로 이동해 입력을 되살림(작성 중으로)<br/>게시글은 머물렀을 때의 안내도 다시 · 가입은 닉네임·이메일만<br/>그 폼에 새로 입력 중이면 덮지 않음"]
  LeftFail -->|"가입 이메일 중복: [로그인]"| LoginFill["로그인 화면에 그 이메일을 채움"]
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
- **`shared/ui/elements/dialog/alert`** — 확인 모달(Alert/Confirm) 공용 컴포넌트
- **`RouterEvents`**(`shared/lib/router/router-events.ts`) — 저장 중 떠났는지 판정(`useHasLeftPage`,
  §5 "저장 요청 중 이탈")이 React가 커밋하기 전의 라우터 위치를 읽는 곳

**구현·검증 과정에서 쓴 도구**

- **Vitest + `createMemoryRouter`(데이터 라우터)** — `useBlocker`는 데이터 라우터에서만 동작해
  `MemoryRouter` 컴포넌트로는 가드를 띄울 수 없다(§9)
- **MSW 응답 붙잡기** — 핸들러 안에서 Promise를 붙잡아 "확인창이 떠 있는 동안 응답이 온다" 같은
  경합을 결정적으로 재현한다

## 4. 왜 만들었나

댓글·게시글 작성 중 실수로 뒤로가기나 다른 메뉴를 눌러 입력을 통째로 잃는
사고를 막기 위해 만들었다. 여러 폼이 동시에 열릴 수 있는 화면 구조상, 폼마다
따로 이탈을 감시하는 대신 하나의 판단 지점으로 모았다(§5).

## 5. 구조

### `shouldBlockNavigation` 판정 순서

§1 순서도가 실제로 `useUnsavedChangesGuard.ts`의 `shouldBlockNavigation`
함수 하나에 그대로 대응한다. 순서가 중요하다:

1. **로그인 상태가 아니면 통과 — 단 로그인이 풀린 채 쓰던 화면에 둔 상태(`useAuthStore`의
   `signedOutInPlace`)이거나, 현재 페이지가 게스트 전용 페이지(`PUBLIC_PATHS`, `route-paths.ts`:
   로그인·회원가입·비밀번호 찾기·비밀번호 재설정 4개 경로)면 예외.**
   로그아웃 시 `ProtectedRoute`의 강제 리다이렉트까지 막으면 폼에(또는 열린
   대화상자에) 갇힌다 — 이 위험은 로그인이 필요한 페이지에서만 있고, `PUBLIC_PATHS`
   4곳은 원래도 `GuestGuard`라 비로그인 전용이라 갇힐 인증 자체가 없다(2026-09-29,
   `isGuestOnlyPage` 추가 — 회원가입 폼 이탈 확인을 붙이려면 이 예외가 먼저 필요했다).
   `signedOutInPlace`는 로그인이 만료되거나 쓰는 중에 다른 탭이 로그아웃해 **화면을 떠나지 않고
   그 자리에 로그인 창을 띄운** 상태다([AUTH.md](./AUTH.md) §8-I). 이 동안에는 강제 리다이렉트가
   없으므로 평소처럼 막는다 — 막지 않으면 로그인 창을 닫고 다른 메뉴를 누를 때 쓰던 글이 확인 없이
   사라진다(2026-10-28, `docs/plans/2026-10-28-keep-writing-in-place.md` 결정 5). 보호 화면에서 로그인
   없이 창을 닫으면 `ProtectedRoute`가 `/post`로 한 번 보내는데, 이 이동도 이 확인창에 막혀 "계속
   작성"을 고르면 로그아웃 상태로 그 화면에 남는다.
2. **열려 있는 Alert/Confirm이 있으면 차단하되, 이탈 확인 모달은 띄우지
   않고 그 대화상자만 취소 처리한다.** Alert/Confirm은 브라우저 히스토리에
   묶여 있지 않아 뒤로가기가 그대로 페이지를 이동시켜버린다 — 북마크
   페이지처럼 쿼리 파라미터만 바뀌는 이동도 잡아야 해서 이 검사가
   pathname 비교보다 먼저 온다.
3. **같은 pathname으로의 이동이면 통과.** 쿼리 파라미터만 바뀌는 이동(예:
   북마크 페이지의 폴더 전환)까지 막으면 과도하다.
4. **여기까지 왔으면 dirty 키 존재 여부로 최종 판단.** 하나라도 있으면 차단한다. 모달 문구는
   응답을 기다리는 폼이 있으면 그 폼이 등록한 문구("이미 가입을 요청했어요" 등 — 아래 "저장 요청 중
   이탈"), 없으면 현재 페이지가 회원가입일 때 전용 문구("회원가입을 그만둘까요?"), 아니면 "작성 중인
   내용이 있어요"다.

차단됐을 때의 두 갈래(대화상자 취소 vs. 이탈 확인 모달)는 `useEffect`
안에서 분기한다 — Alert/Confirm 때문에 막힌 경우엔 그 대화상자를
`cancelAlert`로 취소 처리하고 이동 자체는 없었던 일로 되돌리며(`blocker.reset()`),
아니면 이탈 확인 모달을 새로 연다.

세 번째 갈래는 판정이 아니라 **모달이 떠 있는 동안** 생긴다. 가드는 dirty 스토어를 구독하다가
자기가 띄운 이탈 확인 모달이 열려 있는데 이름표가 모두 떼어지면(저장 성공 → `clearNow()`, 또는
폼이 닫혀 언마운트) 그 모달을 `cancelAlert`로 스스로 취소한다 — "입력한 내용이 사라져요"라는
모달의 전제가 사라졌기 때문이다. 막혔던 이동은 `blocker.reset()`으로 버려지고, 이어지는 폼의 성공
이동은 평소 규칙대로 통과한다. 이 구독이 없으면 그 성공 이동이 "열린 Alert" 규칙(2번)에 다시
막혀, "계속 작성"이 저장 뒤 이동을 버리는 버그가 있었다(§10 2026-10-21). 같은 구독이 **응답을 기다리는
중에 띄운 모달**도 닫는다 — 응답이 오면(성공·실패 모두) "취소되지 않아요"라는 그 모달의 전제가 사라지기
때문이다. 실패하면 입력이 남아 이름표가 그대로라 앞의 조건으로는 닫히지 않으므로, 모달을 띄울 때 요청
중이었는지 기억해 두고(`openedWhilePendingRef`) 요청 중 이름표가 모두 빠졌는지를 따로 본다
(`useUnsavedChangesGuard.ts`의 `cancelOutdatedConfirm`).

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

| 폼             | 언제 "작성 중"으로 잡히나                                                                        | 코드 위치             |
| -------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| 게시글 등록    | URL·제목·관심분야·북마크(폴더)·공개설정 중 하나라도 기본값에서 바뀌면                            | `useCreatePost.ts`    |
| 게시글 수정    | 위와 동일(원래 게시글 값 대비)                                                                   | `useUpdatePost.ts`    |
| 댓글/답글 작성 | 공백이 아닌 글자를 한 글자라도 쓰거나, 텍스트 없이 스크린샷만 붙여넣어도 잡힘                    | `useCreateComment.ts` |
| 댓글 수정      | 수정 시작 시점 원본과 비교해 텍스트가 다르거나, 새 이미지를 붙였거나, 기존 이미지 개수가 바뀌면  | `useUpdateComment.ts` |
| 회원가입       | 닉네임·이메일·비밀번호 중 하나라도 입력되면(가입 요청 중에도 유지, 가입 완료 화면에선 해제 — §6) | `useSignUp.ts`        |

### 이탈 방법별 동작

| 이탈 방법                                                                                                      | 동작                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 사이드바·탭바·뒤로가기 등 앱 내 이동                                                                           | 확인 모달: "작성 중인 내용이 있어요" / 취소="계속 작성" / 확인="나가기"                                                                                                                                                                                      |
| 새로고침·탭 닫기·주소창 직접 이동                                                                              | 브라우저 기본 이탈 경고(앱 모달 아님)                                                                                                                                                                                                                        |
| 열려 있는 Alert/Confirm이 있는 상태에서 이동 시도                                                              | 그 대화상자만 취소되고 이동은 없었던 일이 됨(§5의 2번) — 이탈 확인 모달은 안 뜸                                                                                                                                                                              |
| 같은 pathname 안에서의 이동(쿼리만 변경)                                                                       | 검사 없이 통과(§5의 3번)                                                                                                                                                                                                                                     |
| 모달에서 "계속 작성" 클릭                                                                                      | 이동 취소, 폼 값 그대로 유지                                                                                                                                                                                                                                 |
| 모달에서 "나가기" 클릭                                                                                         | 이동 진행                                                                                                                                                                                                                                                    |
| 저장 요청 중 앱 내 이동                                                                                        | 확인 모달: "이미 가입을·등록을·수정을 요청했어요" / 취소="결과 기다리기" / 확인="나가기"(요청은 계속 진행) — 아래 "저장 요청 중 이탈"                                                                                                                        |
| 모달이 떠 있는 동안 저장 성공                                                                                  | 모달이 저절로 닫히고 폼의 성공 동작대로(등록 → 피드, 수정 → 들어온 화면, 회원가입 → 같은 화면의 가입 완료 화면)                                                                                                                                              |
| 요청 중 모달이 떠 있는 동안 저장 실패                                                                          | 모달이 저절로 닫히고 화면에 머문다 — 입력과 실패 안내(회원가입은 에러 토스트, 중복이면 그 칸 오류도)가 남는다. 다시 떠나려 하면 평소 모달("회원가입을 그만둘까요?"·"작성 중인 내용이 있어요")                                                                |
| 저장 응답 전에 "나가기"                                                                                        | 떠난 화면에 그대로 머문다. 성공은 성공 토스트, 실패는 에러 토스트로 알린다                                                                                                                                                                                   |
| 로그인이 풀린 채 그 화면에 둔 상태에서 이동                                                                    | 로그인 상태와 같다 — 확인 모달이 뜬다(§5의 1번, [AUTH.md](./AUTH.md) §8-I)                                                                                                                                                                                   |
| 쓰는 중에 이 탭에서 직접 로그아웃                                                                              | 먼저 확인창: "로그아웃하면 작성 중인 내용이 사라져요" / 취소="계속 작성" / 확인="로그아웃" → 확인하면 모든 이름표를 떼고 로그아웃한 뒤 `/post`(`useDelayedLogout.ts`)                                                                                        |
| 로그인이 풀린 채 둔 화면에서 다른 회원으로 바뀜                                                                | 쓰는 중이거나 보호 화면이면 확인 없이 모든 이름표를 떼고 `/post` — 이전 회원의 글을 새 회원에게 보이지 않게(`useLeaveOnMemberChange.ts`, [AUTH.md](./AUTH.md) §8-I). 평소대로 로그아웃한 뒤 비로그인으로 새로 쓴 글은 다른 계정으로 로그인해도 버리지 않는다 |
| 공개 화면에서 쓰는 중에 갱신이나 다른 탭 로그인 받아들이기가 다른 계정의 쿠키로 거절됨(409 `SESSION_MISMATCH`) | 이 탭만 로그아웃한 뒤 확인 없이 모든 이름표를 떼고 `/post`(`AuthUtil.signOutForOtherAccount`, [AUTH.md](./AUTH.md) §8-B·§8-H)                                                                                                                                |

### 저장 요청 중 이탈 (게시글 등록·수정·회원가입)

게시글 폼과 회원가입 폼은 응답을 기다리는 동안에도 dirty라 그 사이의 이탈 시도에 모달이 뜬다. 이때 모달은
"입력한 내용이 사라져요"가 아니라 **이미 요청했다는 전용 문구**로 뜬다 — 요청은 이미 서버로 갔고, 화면을
떠나도 취소되지 않는다(`mutateAsync`의 promise는 언마운트 뒤에도 끝까지 간다, §10 2026-11-02).

| 폼          | 제목                   | 본문                                                                   | 취소 / 확인            |
| ----------- | ---------------------- | ---------------------------------------------------------------------- | ---------------------- |
| 회원가입    | 이미 가입을 요청했어요 | 지금 나가도 가입은 취소되지 않아요. 결과는 이동한 화면에서 알려드려요. | 결과 기다리기 / 나가기 |
| 게시글 등록 | 이미 등록을 요청했어요 | 지금 나가도 등록은 취소되지 않아요. 결과는 이동한 화면에서 알려드려요. | 결과 기다리기 / 나가기 |
| 게시글 수정 | 이미 수정을 요청했어요 | 지금 나가도 수정은 취소되지 않아요. 결과는 이동한 화면에서 알려드려요. | 결과 기다리기 / 나가기 |

문구는 폼이 `usePendingSubmit(key, isPending, texts)`로 요청 중 이름표를 붙일 때 함께 넘긴다
(`TEXTS.unsavedChanges.pending.*`) — 가드가 수정 화면 경로(`/post/:id/edit`)까지 알 필요가 없고, 문구는 그 폼이
정한다. 모달과 응답이 겹치는 네 경우를 이렇게 정했다(게시글 2026-10-21, 회원가입 2026-11-02, 전용 문구와 실패 시
자동 닫힘 2026-11-02 사용자 결정):

| 겹치는 경우               | 동작                                                                                                                                                                                         | 코드                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 모달이 떠 있는 동안 성공  | 모달을 닫고 폼의 평소 성공 동작이 이긴다(가려던 곳이 아니라 피드·들어온 화면, 회원가입은 같은 화면의 가입 완료 화면)                                                                         | `useUnsavedChangesGuard.ts`의 `cancelOutdatedConfirm`                  |
| 모달이 떠 있는 동안 실패  | 모달을 닫고 화면에 머문다 — 입력과 실패 안내(게시글은 칸 아래·버튼 위 안내, 회원가입은 에러 토스트, 중복이면 그 칸 오류도)가 남는다. 다시 떠나려 하면 평소 모달이 뜬다                       | 같은 곳 — 요청 중에 띄운 모달만(`openedWhilePendingRef`)               |
| 응답 전에 "나가기" → 성공 | 떠난 화면을 덮어쓰지 않는다. 게시글은 mutation의 `meta.successMessage`가 성공 토스트를 띄운다. 회원가입은 mutation에 성공 토스트가 없어(머물면 완료 화면이 보여준다) 떠났을 때만 훅이 띄운다 | `useCreatePost.ts`·`useUpdatePost.ts`·`useSignUp.ts`의 `hasLeftPage()` |
| 응답 전에 "나가기" → 실패 | 안내할 폼이 없으니 옮겨 간 화면에 닫을 때까지 남는 실패 토스트를 띄우고, 버튼으로 그 폼에 돌아가 입력을 되살린다(아래 "떠난 뒤 실패 토스트")                                                 | 같은 곳, 토스트 모양은 `shared/lib/toast/LeftPageFailureToast.tsx`     |

- **"떠났는가"는 마운트 여부만으로 판단하지 않는다.** "나가기" 직후 라우터 위치는 바로 바뀌지만,
  `v7_startTransition` 때문에 다음 화면이 청크·데이터로 suspend하는 동안엔 이전 폼이 마운트된 채
  남는다(정지 구간). 그래서 `useHasLeftPage`(`shared/hooks/useHasLeftPage.ts`)는 언마운트 **또는**
  라우터의 최신 경로(`RouterEvents.getLocation()`)가 폼 경로와 다르면 떠난 것으로 본다. key가 아니라
  경로를 비교하는 이유는 같은 화면 위 오버레이(`useHistoryOverlay`, 북마크 폴더 선택)가 같은 경로에
  새 key를 push하기 때문이다(북마크 폴더 선택은 Android 터치 기기에서는 push하지 않는다 —
  `docs/DECISIONS.md` 2026-11-03).
- **댓글 수정에도 첫 줄 규칙이 적용된다** — 댓글 수정 저장 중 뜬 모달은 수정이 성공해 폼이 닫히면
  저절로 닫히고 상세 화면에 머문다(사용자가 받아들인 부수 효과).
- **근거 수준**: 위 동작은 이 레포의 선례 — 이탈 없이 성공하면 모달 없이 피드로 간다는 e2e 계약
  (`e2e/post-create.spec.ts`의 "등록 중..." 테스트), 요청 중 폼이 닫히면 토스트로 대신 알리는 댓글 폼
  (`useCreateComment.ts`, 당시 `isMountedRef`. 2026-11-02부터 `useHasLeftPage`) — 에 맞춘 것이고, 다른 제품 사례 조사는 하지 않았다.
  회원가입에 넓힐 때(2026-11-02) 찾아본 [Agriculture Design System](https://design-system.agriculture.gov.au/patterns/warn-before-leaving)과
  [Cloudscape](https://cloudscape.design/patterns/general/unsaved-changes/)도 _"양식이나 과정에서 벗어나면
  지금까지 입력한 정보를 잃게 될 때"_ (번역, Agriculture Design System) 경고하라는 데까지만 다루고, 요청이
  진행 중일 때 떠나는 경우는 다루지 않는다 — 이 갈래는 여전히 위 선례에 기댄다.
- **요청 중엔 전용 문구를 쓴다** — [NN/g](https://www.nngroup.com/articles/confirmation-dialog/)는 확인 대화상자에
  _"행동의 결과를 구체적으로 알려라. '정말 이렇게 할까요?'라고 묻지 마라"_ (번역)고 하고, 버튼도 _"각 선택의 결과를
  요약하라"_ (번역)고 한다. 요청 중 "나가기"는 등록·가입을 취소하지 않으므로 "사라져요"·"그만둘까요?"는 사실과 다른
  결과를 알린다. 그래서 요청 중엔 "이미 요청했어요 / 취소되지 않아요"로 알리고, 남는 쪽 버튼은 "결과 기다리기"로
  그 결과를 요약한다. 회원가입 문구는 "가입을 처리하고 있어요"(제목에 "이미 요청했다"가 없다), 실패 시 다시
  입력해야 한다는 안내를 덧붙인 안(본문이 길어진다)과 비교해 골랐고, 게시글은 "저장" 하나로 묶는 안보다 버튼
  문구("등록 중..."·"수정 중...")와 맞는 등록·수정 따로를 골랐다(모두 2026-11-02 사용자 선택, 경위는 §10 2026-11-02).

**버튼 강조**: "계속 작성"이 채움(primary)이고 오른쪽에 있으며, "나가기"가 outline이고
왼쪽에 있다(연 순간 포커스도 "계속 작성"에 간다. 요청 중 모달은 "결과 기다리기"가 그 자리다) — 반사적으로 눌러도
안전한 쪽이 눌리게 하기 위해서다. 이건 [Alert.tsx](../src/shared/ui/elements/dialog/alert/Alert.tsx)의 `emphasis`
옵션 기본값(`'cancel'`, 생략 시 적용)을 이 가드가 그대로 쓰고 있는 것이다 — **모든 confirm
공통 규칙이 아니다.** 삭제·탈퇴처럼 메뉴에서 직접 선택해야만 뜨는 확인창이나, 공개 설정
토글처럼 어느 방향도 위험하지 않은 확인창은 `emphasis: 'confirm'`으로 반대(확인=채움·오른쪽)로
켠다 — 전체 규칙표는 [FE-ARCHITECTURE.md](./FE-ARCHITECTURE.md) §10 참고. 근거와 검토한 대안
(Apple HIG의 destructive 빨강, 현행 유지 등)은 [DECISIONS.md](./DECISIONS.md) 2026-09-29
항목(팔로업 포함) 참고.

### 떠난 뒤 실패 토스트 (회원가입·게시글 등록·수정·댓글)

응답 전에 "나가기"로 떠난 뒤 요청이 실패하면 실패 안내를 보여 줄 폼이 없다. 옮겨 간 화면의 토스트만 실패를 알려 줄
수 있다. 그래서 이 토스트는 대부분의 에러 토스트처럼 4초 뒤 사라지지 않는다(sonner 2.0.7 기본값
`TOAST_LIFETIME = 4000`, `node_modules/sonner/dist/index.mjs:417`). 닫을 때까지 남고, 무엇이 실패했는지와 그 폼으로
돌아갈 버튼을 단다(2026-11-02). 댓글 폼은 화면을 떠날 때뿐 아니라 저장 중 폼을 닫을 때(답글 취소·모바일 입력 바
접기·수정 취소)도 같은 토스트를 띄운다. 다른 에러 토스트 중 이 토스트를 닫을 때까지 남기는 기준은
[FE-ARCHITECTURE.md](./FE-ARCHITECTURE.md) §14 "에러 토스트 유지 시간"에 있다.

| 폼             | 제목                                                | 설명                                                                                                                                                                                                                                        | 버튼                                                                                                |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 회원가입       | 가입하지 못했어요                                   | 닉네임 중복 "닉네임이 이미 쓰이고 있어요. 다른 닉네임으로 다시 가입해주세요." / 이메일 중복은 가입 화면 칸 아래 문구 그대로 "이미 가입된 이메일이에요. 탈퇴를 신청했다면 로그인해서 취소할 수 있어요." / 그 밖 "잠시 후 다시 시도해주세요." | 이메일 중복이면 [로그인](로그인 화면에 그 이메일을 채움), 그 밖엔 [다시 가입하기]                   |
| 게시글 등록    | 포스트를 등록하지 못했어요                          | 머물렀다면 칸 아래·버튼 위에 떴을 문구(`PostUtil.resolveSubmitError`의 `message`). 원인을 가려내지 못한 실패(`unclassified`)만 제목과 겹치는 "일시적인 문제로 등록하지 못했어요" 대신 "잠시 후 다시 시도해주세요."                          | [다시 등록하기]                                                                                     |
| 게시글 수정    | 포스트를 수정하지 못했어요                          | 등록과 같다                                                                                                                                                                                                                                 | [다시 수정하기]. 글이 삭제됐거나 남의 글이면(`retryable: false`) 버튼 없음 — 다시 수정해도 실패한다 |
| 댓글·답글 등록 | 댓글을 등록하지 못했어요 / 답글을 등록하지 못했어요 | 머물렀다면 폼 안 FormAlert에 떴을 문구(`CommentUtil.resolveSubmitError`). 원인을 가려내지 못한 실패만 "잠시 후 다시 시도해주세요."(`CommentUtil.toLeftFormFailureDescription`)                                                              | 없음(사용자 선택 2026-11-02, [#488](https://github.com/BAECHAN/link-sphere_FE_NEW/issues/488))      |
| 댓글 수정      | 댓글을 수정하지 못했어요                            | 등록과 같다                                                                                                                                                                                                                                 | 없음                                                                                                |

- **문구 위치**: `TEXTS.messages.error.leftPageFailure.*`(가입 이메일 중복은 칸 아래 문구
  `TEXTS.auth.signup.emailDuplicate`를 같이 쓴다), 버튼은 `TEXTS.buttons.signUpAgain`·`createPostAgain`·
  `updatePostAgain`. 설명은 문장마다 줄을 바꿔 한 문장이 두 줄로 쪼개지지 않게 한다(`showLeftPageFailureToast`).
- **원인을 가려내지 못한 실패**: `PostUtil.resolveSubmitError`가 아는 원인(주소 오류·폴더 없음·요청 제한·응답 지연·
  네트워크·로그인 필요·글 삭제됨·남의 글 등)에 들지 않은 것 — 504를 뺀 5xx, 모르는 오류 코드, 예상 못 한 예외. 이때만
  "잠시 후 다시 시도해주세요."를 쓴다. 가입도 닉네임·이메일 중복이 아니면 같은 문구다.
- **어떻게 돌아가나**: 버튼은 폼이 언마운트된 뒤 눌린다. 그래서 컴포넌트 밖 이동인 `NavigationService.navigate`로 그
  폼 경로에 가고, 되살릴 입력은 `location.state`에 싣는다(선례: 가입 화면이 로그인 화면에 이메일을 넘기는
  `useLogin.ts`). 되살릴 값은 `handleSubmit`이 주는 값이 아니라 제출 때 받아 둔 `form.getValues()`다
  (`useCreatePost.ts:160`). zod가 `categoryIds`를 숫자로 바꿔(`post.schema.ts:21`) 폼 값과 모양이 다르기 때문이다.
- **비밀번호는 되살리지 않는다**(사용자 결정): `location.state`는 브라우저 방문 기록(`history.state`)에 저장돼
  새로고침·뒤로가기 뒤에도 남는다. 가입은 닉네임·이메일만 싣는다.
- **폼이 비어 있을 때만 되살린다**: 같은 경로 이동은 이 가드가 막지 않는다(`useUnsavedChangesGuard.ts:33`). 그래서 새로
  입력하던 걸 덮으면 확인 없이 사라진다. 비어 있지 않으면 버튼은 토스트만 닫는다(§11).
- **되살린 입력은 작성 중(dirty)이다**: `reset(values, { keepDefaultValues: true })`로 기본값은 두고 값만 넣는다.
  그래서 되살린 뒤 다시 떠나려 하면 평소 모달이 뜬다.
- **머물렀을 때와 같은 안내를 다시 띄운다**: 버튼을 누르면 sonner가 토스트를 닫아 이유도 함께 사라진다(2.0.7
  `index.mjs:818-821`). 그래서 게시글은 되살린 폼에 칸 아래 에러나 버튼 위 FormAlert를 다시 띄운다. FormAlert가 화면
  아래에 있으면 제출 버튼이 보이는 데까지 내린다(`scrollIntoView({ block: 'nearest' })`, 이미 보이면 움직이지 않음,
  2026-11-02 사용자 선택, §10). 가입은 머물러도 토스트만 띄우므로 다시 띄우지 않는다 — 닉네임·이메일 중복은 중복
  확인이 다시 돌아 칸 아래에 뜬다.
- **수정은 그 글일 때만 덮는다**: state에 `postId`를 함께 싣는다. 서버 글로 폼을 처음 채운 직후에 같은 글일 때만
  덮는다(`useUpdatePost.ts`의 `resetFormWithFetchedPost`). URL을 바꿨던 입력이면 `wasUrlChangedRef`도 맞춘다
  (`useUpdatePost.ts:100`). 맞추지 않으면 URL 변경 감지가 제목·관심 분야를 비운다.
- **이미 로그인 화면에 있을 때**: 가입 화면에서 "로그인" 링크로 떠난 뒤 이메일 중복으로 실패하면, [로그인]을 누를 때
  이미 로그인 화면이다. 폼이 다시 마운트되지 않아 `defaultValues`가 다시 읽히지 않으므로 `useLogin`의
  `fillEmailArrivedOnSamePage`가 새로 실려 온 이메일을 칸에 넣는다(입력 중이면 덮지 않음, §10).
- **쌓이지 않는다**: 토스트 id가 `left-page-failure:<이탈 가드 키>`다(가입 `auth-signup`, 등록 `post-create`, 수정
  `post-update:<postId>`, 댓글 `comment-create:<postId>:<부모 댓글 id 또는 root>`·`comment-update:<commentId>`). 같은 폼에서 또 실패하면 이전 토스트를 바꾼다. 선례는 로그인 만료 토스트
  (`showSessionExpiredToast`, `shared/utils/auth.util.ts:223`)로, 닫을 때까지 남고 버튼·닫기 X·고정 id를 쓴다.
- **가입 실패 판정 위치**: 머물 때와 떠난 뒤를 나눠야 해서 `useCreateAccountMutation`의 `onError` 토스트를 없앴다.
  판정은 `SignUpUtil.resolveSubmitError`(`entities/auth/utils/auth.util.ts:132`)가 하고, `useSignUp`의 `catch`가
  머물렀으면 지금과 같은 4초 토스트를, 떠났으면 이 토스트를 띄운다(게시글 `PostUtil.resolveSubmitError` + 훅 `catch`
  선례).

**왜 닫을 때까지 남기나** — 사라지는 알림이 괜찮은 건 그 정보를 다른 곳에서도 알 수 있을 때다.

- WCAG 2.2.1 이해 문서는 그런 경우로 _"받은편지함을 보는 등 다른 방법으로"_ (번역) 정보를 얻을 수 있을 때를 든다
  ([Understanding 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)). 떠난 뒤 실패는 다른
  방법이 없다.
- Primer는 _"사용자가 직접 닫을 때까지 토스트를 계속 남겨 두는 장치가 있어야 한다"_ (번역)고 쓴다
  ([Primer toasts](https://primer.style/accessibility/toasts/)).
- Material 3는 버튼이 있는 스낵바를 자동으로 닫지 않는다 — Flutter 변경 공지에서 재인용
  ([Flutter](https://docs.flutter.dev/release/breaking-changes/snackbar-with-action-behavior-update)). M3 원문은 확인하지
  못했다.

**왜 돌아갈 버튼을 다나** — NN/g는 _"문제를 말하는 것만으로는 부족하다. 해결책을 제시하라"_ (번역), _"처음부터
다시 하게 하지 말고 원래 입력을 고쳐서 바로잡게 하라"_ (번역)고 쓴다
([Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)). Atlassian Flag는 _"문제를
설명하고 다음 단계나 대안을 제시하라"_ (번역)며 "Try again" 버튼을 예로 든다
([Flag usage](https://atlassian.design/components/flag/usage)). 한계: "폼을 떠난 뒤의 실패"를 직접 다룬 자료는 찾지
못했다. 가장 가까운 기준은 WCAG의 "다른 곳에서 알 수 있는가"다.

**모양** — 실제 sonner 렌더를 라이트·다크, 모바일 375px·데스크톱으로 캡처해 나란히 비교했고, 사용자가 골랐다
(2026-11-02). 모양은 `LeftPageFailureToast.tsx:6-14`의 `CLASS_NAMES`에 있고, 참고본은 스토리
`sonner.stories.tsx`의 `LeftPageFailure`(경우 7개)다.

| 항목           | 고른 것                                                                           | 버린 것                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 문구 구성      | 제목(무엇이 실패) + 설명(이유·할 일)                                              | 한 문장 — 게시글 실패 이유마다 문구를 새로 써야 한다                                                                         |
| 설명 줄바꿈    | 문장마다 줄을 바꾼다                                                              | 폭에 맡김 — 한 문장이 중간에서 줄이 바뀌어 읽기 어려웠다(사용자 지적)                                                        |
| 버튼 위치      | 설명 아래 오른쪽, 닫기 X는 오른쪽 위, 아이콘은 제목 줄                            | 설명 옆 가운데(sonner 기본 — 여러 줄 토스트에서 어색했다), 설명 아래 왼쪽                                                    |
| 제목·설명 구분 | 제목은 빨강 + `text-subsection-title`(14px·600), 설명은 본문색(`text-foreground`) | sonner 기본(둘 다 13px·빨강, 굵기 500/400로만 구분), 제목만 굵게(설명도 빨강), 둘 다 본문색(빨강은 아이콘에만 — Carbon 방식) |

- Volvo Cars 디자인 시스템은 _"동작이 있으면 항상 메시지 아래 별도 줄에 둔다"_, _"동작 버튼이 있으면 자동으로 닫지
  않는다. 이때는 항상 X 버튼을 보여 준다"_ (번역)고 쓴다
  ([Toast message usage](https://designsystem.volvocars.com/web/components/toast-message/usage/)).
- Firefox Acorn(안드로이드 스낵바)의 "Text & long action" 유형은 _"동작 라벨이 메시지 옆에 들어가기엔 길어서 자기 줄로
  내려간다"_ (번역) ([Snackbar](https://acorn.firefox.com/latest/mobile/components/snackbar/android-pNOUdFi9)).
- 오른쪽: Material 3 Compose 스낵바는 버튼을 새 줄에 둘 때 오른쪽 끝에 붙인다
  ([Compose `material3` 폴더](https://github.com/androidx/androidx/tree/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3)의
  `Snackbar.kt`, `Modifier.align(Alignment.End)`). 이 앱의 확인창도 데스크톱에서 버튼을 오른쪽에 모은다(`dialog.tsx`·
  `alert-dialog.tsx`의 `sm:justify-end`). 반대로 Atlassian Flag와
  [Carbon](https://carbondesignsystem.com/components/notification/usage/)은 동작을 설명 아래 왼쪽에 둔다 — 업계가
  한쪽으로 정해진 건 아니다.
- 제목 구분: Carbon 토스트는 제목 14px·굵기 600, 본문 14px·굵기 400이고 둘 다 기본 글자색이다. 상태색(빨강)은
  테두리·아이콘·배경에만 쓴다([Notification style](https://carbondesignsystem.com/components/notification/style/)).
  사용자는 그보다 제목을 빨강으로 두는 쪽을 골랐다.

### 의도적으로 막지 않는 경우

| 상황                                                             | 이유                                                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록/수정 정상 제출 성공 후 이동                                 | 응답 성공 직후 dirty 해제(`clearNow`, §6)하고 이동 → 모달 안 뜸(저장 대기 중 이탈은 확인창이 뜨고, 그 사이 성공하면 확인창이 닫힌다 — 위 "저장 요청 중 이탈")         |
| 로그아웃 상태(그 화면에 둔 상태가 아닌 경우)                     | `ProtectedRoute`의 강제 리다이렉트를 막으면 폼에 갇히므로 아예 검사 안 함(§5의 1번). 로그인 만료·쓰는 중 다른 탭 로그아웃은 화면을 떠나지 않으므로 여기에 들지 않는다 |
| 다른 회원으로 바뀜·`SESSION_MISMATCH`·직접 로그아웃 확인 뒤 이동 | 쓰던 글을 버리기로 한 이동이라 `clearAllUnsavedChanges()`로 이름표를 먼저 모두 떼고 보낸다 — 남겨 두면 이 확인창이 그 이동을 막는다                                   |
| 답글 폼 "취소", 댓글 수정 "취소" 같은 폼 내부 버튼               | 페이지 이동이 아니라 가드 대상이 아님 → 즉시 닫힘                                                                                                                     |
| 아무것도 입력 안 한 상태                                         | 애초에 dirty가 아니므로 모달 안 뜸                                                                                                                                    |
| 같은 pathname 안에서의 이동                                      | §5의 3번 — 북마크 페이지의 폴더 전환 등                                                                                                                               |
| 회원가입 - 이메일 중복 확인된 상태의 "Sign In" 링크              | 로그인하려는 의도가 이미 명확해 확인창 없이 바로 이동(§5 참고) - 클릭 시 dirty 해제                                                                                   |

### 동시에 여러 폼이 열려 있을 때

상세 페이지엔 댓글 폼 + 답글 폼 + 수정 폼이 동시에 여러 개 뜰 수 있다. **이 중
하나라도 작성 중이면 페이지 이탈이 막힌다.** (예: 최상단 댓글은 다 써놓고 다른
댓글의 답글 폼은 비워둔 채 나가려 해도 최상단 초안 때문에 모달이 뜬다 — 전역
레지스트리 방식이라 등록된 키가 전부 비어야 이동이 허용된다.)

## 6. 상태 모델

### `useUnsavedChangesStore`(`src/shared/store/unsavedChanges.store.ts`)

이 기능 전체가 이 스토어 하나다 — §1의 "칠판"이자 §5에서 반복 언급되는
"전역 레지스트리"의 실체.

| 필드/함수                 | 타입                                              | 역할                                                                                           |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dirtyKeys`               | `Set<string>`                                     | 지금 "저장 안 한 입력이 있다"고 등록된 폼 키들의 집합                                          |
| `markDirty(key)`          | `(key: string) => void`                           | 키를 집합에 추가                                                                               |
| `markClean(key)`          | `(key: string) => void`                           | 키를 집합에서 제거                                                                             |
| `pendingSubmits`          | `Map<string, LeaveConfirmTexts>`                  | 요청을 보내고 응답을 기다리는 폼 키 → 그동안 이탈 모달에 쓸 문구(2026-11-02, "요청 중 이름표") |
| `markPending(key, texts)` | `(key: string, texts: LeaveConfirmTexts) => void` | 요청 중 이름표를 붙인다                                                                        |
| `markSettled(key)`        | `(key: string) => void`                           | 요청 중 이름표를 뗀다                                                                          |

`LeaveConfirmTexts`는 `title`·`message`·`confirm`·`cancel` 네 문자열이다. 요청 중 이름표는 이동을 막지 않는다 —
막는 건 여전히 `dirtyKeys`이고, 이 이름표는 모달 문구와 모달을 닫는 시점만 정한다(§5 "저장 요청 중 이탈").
그래서 `clearAllUnsavedChanges()`는 이 이름표를 비우지 않는다.

모듈 레벨 헬퍼(React 렌더를 구독하지 않는 시점 — 라우터 blocker 판정,
`beforeunload`에서 씀):

- `hasUnsavedChanges(): boolean` — `dirtyKeys.size > 0`
- `getPendingSubmitTexts(): LeaveConfirmTexts | null` — 응답을 기다리는 폼이 있으면 그 문구(첫 항목), 없으면 `null`.
  가드가 모달을 띄울 때와 모달을 닫을지 볼 때 쓴다
- `clearUnsavedChanges(key: string): void` — 특정 키를 즉시(동기) 해제.
  제출 직후 navigate처럼 effect 클린업을 기다릴 수 없을 때 쓴다
- `clearAllUnsavedChanges(): void` — 등록된 키를 **모두** 즉시(동기) 해제(2026-10-28). 쓰던 글을 버리고
  화면을 옮겨야 할 때 그 이동을 이 가드가 막지 않게 한다 — 로그인이 풀린 채 둔 화면에서 다른 회원으로 바뀜
  (`useLeaveOnMemberChange.ts`), 공개 화면에서 쓰는 중 `SESSION_MISMATCH`(`AuthUtil.signOutForOtherAccount`,
  `auth.util.ts`), 직접 로그아웃 확인(`useDelayedLogout.ts`)

**가드도 이 스토어를 구독한다** — `useUnsavedChangesGuard`가 `useUnsavedChangesStore.subscribe`로
변경을 받아, 자기가 띄운 모달(`confirmIdRef`에 id를 둔다. `openConfirm`이 id를 돌려주지 않아 띄운
직후 `getOpenAlertId()`로 읽는다)이 열려 있는데 `dirtyKeys`가 비면 그 모달을 취소한다(§5 세 번째
갈래). 모달을 요청 중에 띄웠으면(`openedWhilePendingRef`) `pendingSubmits`가 비어도 취소한다.
선택자 구독이 아니라 `subscribe`인 이유: zustand는 `set` 안에서 리스너를 동기로 부르므로
_"모든 변경마다 동기로 실행된다"_ (번역, [zustand README](https://github.com/pmndrs/zustand#readingwriting-state-and-reacting-to-changes-outside-components)),
`clearNow()` 바로 다음 줄의 `navigate`보다 먼저 모달이 닫힌다. 렌더 뒤에 도는 선택자 + effect면
그 `navigate`가 먼저 다시 막힌다.

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

**회원가입만 갖는 예외** — 두 번째 인자를 `isDirty && !isSubmitted` 2개 조건의 AND로
준다(`useSignUp.ts`). **정정(2026-09-29)**: 가입 성공 시 로그인
페이지로 곧장 `navigate`하지 않는다 — `onSubmit`이 `createMember` 성공 직후
`clearNow()`로 dirty를 동기 해제하고 `setIsSubmitted(true)`만 호출해, 같은 페이지
안에서 폼 대신 "메일함을 확인해주세요" 화면(`SignUpForm.tsx`의 `isSubmitted` 분기,
`TEXTS.auth.signup.checkEmailTitle`/`checkEmailDescription`)으로 전환한다. 이 화면의
"로그인하러 가기" 버튼을 눌러야 비로소 `/auth/login`으로 이동한다. 응답 전에 "나가기"로
떠났으면 이 전환 대신 성공 토스트(`TEXTS.messages.success.signUpCompleted`)를 띄운다(§5
"저장 요청 중 이탈").

- **정정(2026-11-02)**: 원래는 `!isPending`도 넣어 3개 조건이었다 — 요청 중 이탈 시도가
  "거의 없다"고 보고 요청 중에는 일부러 가드를 껐다. 요청 중 하단 "로그인" 링크를 눌러
  확인 없이 떠나면 완료 화면을 못 봐 가입 결과를 모른다는 제보로 그 전제가 깨져 뺐다(§10).
  이제 요청 중에도 확인창이 뜨고, 새로고침·탭 닫기에도 브라우저 기본 경고가 뜬다.
- `!isSubmitted`가 없으면 다른 문제가 생긴다 — 이 훅은 렌더마다 반응형으로 다시
  평가되므로, `onSubmit`의 `clearNow()`가 지운 직후에도 `form.formState.isDirty`
  자체는 여전히 `true`라(폼 값은 안 지웠으므로) 바로 다음 렌더의 effect가 그걸 보고
  다시 등록해버린다. 그 결과 브라우저 `beforeunload` 경고가 살아있는 채로 "메일함을
  확인해주세요" 화면에 남는 버그로 실제 재현됐다 — `isSubmitted`를 조건에 넣어 화면이
  전환된 뒤에는 폼이 dirty여도 재등록하지 않도록 막는다.

```typescript
export function useUnsavedChanges(key: string, isDirty: boolean) {
  // isDirty가 true면 markDirty(key), false면 markClean(key)를 레이아웃 effect(useLayoutEffect)로
  // 동기화하고, 언마운트 시에는 항상 markClean(key)(작성 중이던 폼이 사라지면 이름표도 뗀다)
  // ...
  return { clearNow: () => clearUnsavedChanges(key) };
}
```

등록은 `useEffect`가 아니라 `useLayoutEffect`로 한다 — 화면이 그려지기 전에 등록돼야, 화면이 바뀐
직후(예: 가입 실패 뒤 버튼이 다시 눌러짐)의 뒤로가기·링크 이동도 가드가 막는다(§10 2026-10-13).

`clearNow`는 제출 성공 직후처럼 "지금 즉시" 해제해야 할 때 동기 호출한다
(§5 "의도적으로 막지 않는 경우").

### `usePendingSubmit(key, isPending, texts)`(`src/shared/hooks/usePendingSubmit.ts`)

폼이 "요청을 보내고 응답을 기다리는 중"임을 `pendingSubmits`에 등록하는 훅(2026-11-02). `useUnsavedChanges`와 같은
모양이다 — `isPending`이면 `markPending(key, texts)`, 아니면·언마운트 때 `markSettled(key)`를 레이아웃 effect로
동기화한다. 키는 같은 폼의 `useUnsavedChanges` 키를 그대로 쓴다.

| 폼          | 호출                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------- |
| 회원가입    | `usePendingSubmit('auth-signup', isPending, TEXTS.unsavedChanges.pending.signup)`                  |
| 게시글 등록 | `usePendingSubmit('post-create', isCreating, TEXTS.unsavedChanges.pending.postCreate)`             |
| 게시글 수정 | ``usePendingSubmit(`post-update:${postId}`, isUpdating, TEXTS.unsavedChanges.pending.postUpdate)`` |

댓글 폼은 쓰지 않는다 — 이번 범위(2026-11-02 사용자 결정: 회원가입·게시글 등록·수정)에 들지 않았다(§11).

## 7. 운영 파라미터

해당 없음 — 이 기능에는 주기·건수·타임아웃 같은 운영 파라미터가 없다.

## 8. 코드 지도와 자주 하는 수정

```
src/
├── shared/
│   ├── store/
│   │   └── unsavedChanges.store.ts       # §6 — dirty 키·요청 중 이름표 레지스트리(Zustand)
│   └── hooks/
│       ├── useUnsavedChanges.ts          # §6 — 폼이 자기 dirty 상태를 등록하는 훅
│       ├── usePendingSubmit.ts           # §6 — 폼이 요청 중임과 그동안의 모달 문구를 등록하는 훅
│       ├── useUnsavedChangesGuard.ts     # §5 — RootLayout에서 1회만 도는 전역 가드
│       └── useHasLeftPage.ts             # §5 "저장 요청 중 이탈" — 응답 뒤 떠났는지 판정
├── shared/lib/router/router-events.ts    # useHasLeftPage가 읽는 라우터 최신 위치
├── shared/lib/toast/LeftPageFailureToast.tsx # §5 "떠난 뒤 실패 토스트" — 닫을 때까지 남는 모양·고정 id
├── shared/lib/router/navigation.ts       # NavigationService — 토스트 버튼이 컴포넌트 밖에서 폼으로 이동
├── entities/auth/utils/auth.util.ts      # SignUpUtil.resolveSubmitError — 가입 실패 판정(머물 때·떠난 뒤 공통)
├── entities/post/utils/post.util.ts      # PostUtil.resolveSubmitError — retryable·unclassified 표시
├── features/auth/login/hooks/useLogin.ts # fillEmailArrivedOnSamePage — 이미 로그인 화면일 때 실려 온 이메일 채움
├── app/routes/layouts/RootLayout.tsx     # 가드 마운트 지점(앱 전체 1곳)
├── app/hooks/useLeaveOnMemberChange.ts   # 다른 회원으로 바뀌면 쓰는 중이거나 보호 화면일 때 clearAllUnsavedChanges → /post
├── widgets/layout/navbar/hooks/useDelayedLogout.ts # 쓰는 중 직접 로그아웃이면 먼저 확인(TEXTS.unsavedChanges.logout)
├── shared/store/auth.store.ts            # signedOutInPlace — §5의 1번 예외(로그인이 풀린 채 그 화면에 둠)
├── shared/ui/elements/dialog/alert/alert.store.ts # §5의 Alert/Confirm 우선 차단 분기가
│                                                    # 참조하는 getOpenAlertId 출처
├── shared/config/texts.ts                # TEXTS.unsavedChanges.* — 확인 모달 문구(.signup은 회원가입 전용, .pending.*은 요청 중, .logout은 직접 로그아웃 확인)
├── shared/config/route-paths.ts          # PUBLIC_PATHS — §5의 "게스트 전용 페이지" 판정 출처
├── features/post/create/hooks/useCreatePost.ts
├── features/post/update/hooks/useUpdatePost.ts
├── features/comment/create/hooks/useCreateComment.ts
├── features/comment/update/hooks/useUpdateComment.ts
└── features/auth/signup/hooks/useSignUp.ts
```

### 자주 하는 수정

| 하고 싶은 것                       | 방법                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 새 폼에 이 가드를 붙이려면         | 폼 훅 안에서 `const { clearNow } = useUnsavedChanges('폼을-구분할-고유-키', isDirty)` 호출 + 제출 성공 직후 `clearNow()` 호출(§6 표의 키 네이밍 패턴을 따른다)                                                                                                                                                             |
| 이탈 확인 모달 문구 변경           | `TEXTS.unsavedChanges.*`(`shared/config/texts.ts`)                                                                                                                                                                                                                                                                         |
| 특정 상황을 검사에서 제외          | `useUnsavedChangesGuard.ts`의 `shouldBlockNavigation`에 §5 순서대로 분기 추가(순서가 중요 — 로그인 상태 검사보다 먼저 오면 안 됨)                                                                                                                                                                                          |
| 저장 뒤 이동하는 새 폼             | 응답을 기다린 뒤 `useHasLeftPage()`의 반환 함수로 떠났는지 먼저 본다 — 떠났으면 이동하지 않고, 실패는 토스트로(§5 "저장 요청 중 이탈", `useCreatePost.ts` 참고). 요청 중 모달 문구는 `usePendingSubmit`에 `TEXTS.unsavedChanges.pending`의 새 키를 넘긴다(§6)                                                              |
| 쓰던 글을 버리고 옮기는 새 경로    | 이동 전에 `clearAllUnsavedChanges()`를 부른다(§6, 선례 `useLeaveOnMemberChange.ts`·`useDelayedLogout.ts`·`AuthUtil.signOutForOtherAccount`) — 안 부르면 이 가드가 그 이동을 막는다                                                                                                                                         |
| 떠난 뒤 실패 토스트 문구 변경      | 제목·가입 설명은 `TEXTS.messages.error.leftPageFailure`(`texts.ts:570`), 버튼은 `TEXTS.buttons`의 `signUpAgain`·`createPostAgain`·`updatePostAgain`(`texts.ts:73-76`). 게시글 설명은 `TEXTS.messages.error.postSubmit.*` 그대로다                                                                                          |
| 떠난 뒤 실패 토스트 모양 변경      | `LeftPageFailureToast.tsx:6-14`의 `CLASS_NAMES`. sonner 자체 CSS를 덮으려면 `!`가 필요하다. 스토리 `sonner.stories.tsx`의 `LeftPageFailure`로 경우 7개를 함께 본다                                                                                                                                                         |
| 새 폼에 떠난 뒤 실패 토스트 붙이기 | 제출 전 `form.getValues()`를 받아 두고, `hasLeftPage()`면 `showLeftPageFailureToast`에 그 폼의 이탈 가드 키와 `NavigationService.navigate(폼 경로, { state })` 버튼을 넘긴다. 되살리기는 `useCreatePost.ts:115`의 `restoreSubmissionAfterLeftPageFailure`, 안내까지 내리기는 `:132`의 `revealRestoredSubmitError`를 본뜬다 |

## 9. 검증 결과

**e2e** — 댓글 폼은 `e2e/unsaved-changes.spec.ts`(PUSH·POP 이동, "계속 작성"/"나가기" 분기)가,
회원가입 폼은 `e2e/signup-unsaved-changes.spec.ts`(전용 문구, 이메일 중복 여부에 따른
"Sign In" 링크 분기, 뒤로가기 차단, 제출 실패 후 재등록)가 각각 통합 테스트로 커버한다
(2026-09-29). 같은 회원가입 스펙이 가입 요청 중 "Sign In" 링크에 "이미 가입을 요청했어요" 확인창이 뜨고, "나가기" 뒤
로그인 화면에 성공 토스트가 뜨는 것, 확인창이 열린 채 가입이 끝나면 성공이면 완료 화면, 실패면 확인창이 닫히고 입력이
남는 것도 본다(2026-11-02 — 응답을 붙잡는 `page.route`로 풀어 주므로 시간 지연에 기대지 않는다. 이 3개와 아래
`post-create.spec.ts` 1개를 `--repeat-each=10`으로 40회 모두 통과, 직접 측정). 게시글 등록은 `e2e/post-create.spec.ts`가
"이탈 없이 성공하면 어떤 확인창도 없이 피드로 간다"만 본다 — 2026-11-02부터 제목이 아니라 `alertdialog` 전체를 본다.
제목으로만 찾으면 제목이 다른 요청 중 확인창이 잘못 떠도 통과하기 때문이다. 이 파일들은 `chromium` 프로젝트에서만 돈다
(`mobile-chrome`은 `*.mobile.spec.ts`만, `playwright.config.ts`). (정정, 2026-10-21: 이 절은 전에
`unsaved-changes.spec.ts`가 "댓글/게시글 폼"을 커버한다고 적었지만, 그 스펙은 댓글 폼만 연다.)

**유닛 테스트(2026-10-21)** — 데이터 라우터(`createMemoryRouter`) + 실제 가드 + 실제 확인 모달 +
응답을 붙잡는 MSW로 저장 중 이탈 경합을 재현한다. 고치기 전 RED 10회, 고친 뒤 전부 GREEN을 확인했다.

| 파일                                                          | 다루는 것                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/hooks/useUnsavedChangesGuard.test.tsx`            | 모달이 떠 있는 동안 이름표가 모두 떼어져야(하나만이면 유지) 모달을 닫고 막힌 이동을 버린다. 요청 중 이름표가 있으면 그 문구로 모달, 요청 중에 띄운 모달은 dirty가 남아도 요청 중 이름표가 빠지면 닫힘(다시 떠나면 평소 모달), 요청 중이 아닐 때 띄운 모달은 그대로 |
| `src/features/post/create/hooks/useCreatePost.guard.test.tsx` | 모달 중 성공(탭·뒤로) → 피드, "결과 기다리기" 뒤 성공, 모달 중 실패 → 모달 닫힘 + 입력·실패 안내 유지, "나가기" 뒤 성공·실패, 정지 구간, 같은 경로 오버레이                                                                                                        |
| `src/features/post/update/hooks/useUpdatePost.guard.test.tsx` | 모달 중 성공(탭·뒤로) → 들어온 화면, 모달 중 실패 → 모달 닫힘 + 입력·실패 안내 유지, "나가기" 뒤 성공(한 칸 더 뒤로 가지 않음)·실패                                                                                                                                |
| `src/features/auth/signup/hooks/useSignUp.guard.test.tsx`     | 요청 중 "로그인" 링크·뒤로 → 요청 중 모달, 모달 중 성공 → 완료 화면, 모달 중 실패 → 모달 닫힘 + 입력 유지(다시 떠나면 "그만둘까요?"), "나가기" 뒤 성공(토스트)·실패, 정지 구간                                                                                     |

회원가입 가드 테스트(2026-11-02)는 훅 대신 `SignUpForm`을 렌더해 제보된 하단 "로그인" 링크를 그대로 누른다.
고치기 전 코드에서 7개 중 6개가 "확인창을 찾을 수 없음"으로 실패하고 떠나지 않는 경우 1개만 통과했으며, 고친 뒤
모두 통과했다(직접 측정, `pnpm vitest run src/features/auth/signup/hooks/useSignUp.guard.test.tsx`).

요청 중 전용 문구(2026-11-02)는 가드 파일만 이전 버전(`git show HEAD:src/shared/hooks/useUnsavedChangesGuard.ts`)으로 잠시
되돌려 위 네 파일을 돌렸을 때 27개 중 20개가 실패하고, 되돌린 걸 복원한 뒤 모두 통과하는 것을 확인했다(직접 측정).
이전 가드는 요청 중 문구를 띄우지 않아 요청 중 문구로 모달을 찾는 테스트는 그 단계에서 먼저 실패하므로, 실패 뒤 자동
닫힘은 따로 확인했다 — 구독 콜백의 `isResponseIn`만 `false`로 잠시 바꾸면 "모달이 열린 채 실패" 테스트 4개(가드·회원가입·
등록·수정 하나씩)만 실패하고 나머지 23개는 통과한다(직접 측정, 위 네 파일 `pnpm vitest run`).

경계 확인: 구독 콜백의 `hasUnsavedChanges()` 조건을 잠시 빼면 가드 테스트의 중간 단언이, `useHasLeftPage`를
마운트 여부만 보게 바꾸면 정지 구간 테스트가 실패하는 것을 확인했다.

**떠난 뒤 실패 토스트(2026-11-02)** — 위 회원가입·등록·수정 가드 테스트에 더한 것:

- 떠난 뒤 실패하면 제목·설명·버튼, `duration: Infinity`, 고정 id로 토스트가 뜬다(가입·등록은 원인별 `it.each`).
- 버튼을 누르면 그 폼으로 가서 입력을 되살린다. 가입은 닉네임·이메일만 되살리고 비밀번호는 빈칸이며, 되살린 입력도
  떠날 때 확인창이 뜬다. 게시글은 머물렀을 때의 안내도 다시 뜨고, 수정은 바꾼 URL과 제목을 그대로 둔다.
- 이메일 중복이면 [로그인]이 그 이메일을 채운 로그인 화면으로 보낸다. 글이 삭제됐거나 남의 글이라 실패했으면 버튼이
  없다.
- 그 폼에 새로 입력 중이면 버튼이 입력을 덮지 않는다(가입·등록).

`scrollIntoView` 호출을 잠시 빼면 "안내까지 내림"을 보는 테스트 2개(등록 429, 수정)만 실패하고, 되돌리면 통과한다(직접
측정). 세 가드 파일은 10회 반복 실행에서 모두 통과했다. e2e는 `signup-unsaved-changes.spec.ts`에 2개(떠난 뒤 실패 →
[다시 가입하기] → 닉네임·이메일만 되살림, "Sign In"으로 떠난 뒤 이메일 중복 → 이미 열린 로그인 화면에서 [로그인] → 이메일
채움), `post-create.spec.ts`에 1개(떠난 뒤 500 → [다시 등록하기] → 입력과 버튼 위 안내가 화면 안에 보임)를 더했다.
셋 모두 `--repeat-each=10`으로 30회 통과했다(직접 측정).

브라우저 녹화 8개(가입 서버 오류·닉네임 중복·이메일 중복, 등록 429, 수정 500·글 삭제됨, 머문 채 가입·등록 실패)로
화면도 확인했다. 토스트가 5초 넘게 남는지, 머문 채 실패하면 가입 토스트가 4초 뒤 사라지는지도 녹화로 봤다. 녹화 파일은
gitignore된 `.claude/browser-artifacts/`에만 있다.

**로그인이 풀린 상태(2026-10-28)** — `useUnsavedChangesGuard.test.tsx`의 "로그인이 풀린 상태" `describe`가
`signedOutInPlace` 동안에는 로그아웃 상태여도 막고, 그 표시가 없는 로그아웃 상태면 지금처럼 막지 않는 것을 고정한다.
`ProtectedRoute.test.tsx`(보호 화면에서 창을 닫으면 확인창 → "계속 작성"이면 그 자리에 남음),
`useDelayedLogout.test.tsx`(직접 로그아웃 확인), `useLeaveOnMemberChange.test.tsx`(쓰는 중이거나 보호 화면에서 다른
회원이면 이름표를 모두 떼고 `/post`, 평소 로그아웃 뒤 비로그인으로 새로 쓴 글은 그대로), `auth.util.test.ts`의
`applySessionMismatch`(공개 화면에서 쓰는 중이면 `/post`), `useAuthEpochSync.test.tsx`(다른 탭의 로그인을 받아들이려다
다른 계정이라 거절되면 같은 처리)와 e2e `auth-tab-sync.spec.ts`의 "쓰는 중에 다른 탭에서 로그아웃"·`logout.spec.ts`의 "쓰는 중에 로그아웃"이
이 가드와 맞물린 흐름을 본다(목록과 확인 내용은 [AUTH.md](./AUTH.md) §9).

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

**2026-10-13, 가드가 화면보다 늦게 켜지던 e2e flaky.** CI e2e가 재시도(`retries: 2`)로만
통과한 경우를 세 보니 최근 성공 run 40건 중 3건이었고, 테스트는 두 개였다.
`signup-unsaved-changes.spec.ts`의 "가입 요청이 실패한 뒤 뒤로가기를 누르면 확인창이 다시
뜬다"(뒤로가기 뒤 확인창이 없음)와 `dialog-outside-click.spec.ts`의 로그인 모달 "비밀번호를
입력했으면 바깥을 눌러도 그대로 있다"(바깥 클릭 뒤 모달이 사라짐)다. 둘 다 가드 상태를
`useEffect`로 반영하고 있었다.

- `useEffect`는 화면을 그린 뒤에 돈다. 그래서 화면은 이미 "준비됨"으로 보이는데 가드는 아직
  꺼져 있는 틈이 생긴다. 예를 들어 버튼이 다시 눌러지는 화면은 떴는데 `markDirty`는 아직 안
  돌았거나, 입력은 보이는데 `dismissOnOutsideClick`은 아직 `true`인 상태다. Playwright는 그 틈에
  다음 동작을 한다.
- **재현(직접 측정)**: 두 스펙에 CPU 6배 스로틀(`Emulation.setCPUThrottlingRate`)을 임시로 넣고
  각 30회 돌렸다. 로그인 모달은 30회 중 26회가 바깥 클릭 직후 `toBeVisible()`에서 실패했다.
  회원가입은 6배·20배에서 모두 통과했고, 12워커 병렬에서도 과부하로 앞 단계가 타임아웃 났을 뿐
  확인창 단계 실패는 없었다. 그래서 회원가입 쪽은 재현하지 못했고, 같은 구조라는 코드 근거로 함께 고쳤다.
- **고침**: `useUnsavedChanges`의 등록과 `useLogin`의 `reportInputDirty`를 `useLayoutEffect`로
  바꿨다. 화면을 그리기 전에 돌고 그 안의 상태 변경도 그리기 전에 처리된다
  ([react.dev useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)). 같은 스로틀 조건에서
  두 테스트 각 30회 모두 통과했다.
- 같은 PR에서 `playwright.config.ts`에 `failOnFlakyTests: !!process.env.CI`를 켰다. 재시도로만
  통과한 테스트가 다시 숨지 않게 하려는 것이다(`docs/TESTING.md` "CI 연동").

**2026-10-21, 저장 중 떠나려다 "계속 작성"을 누르면 등록 뒤 이동이 사라지던 문제.** 모바일에서
등록 중 탭이나 뒤로가기를 누르면 모달이 떴고, "계속 작성"을 누른 뒤 직접 나가 보니 그제야 목록에
반영된 것처럼 보였다는 제보였다. 실제로는 등록이 모달이 떠 있는 동안 이미 끝났고, 그 뒤의 자동 이동을
"계속 작성"이 버린 것이었다(목록 캐시엔 새 글이 이미 있었다). 설치본 소스로 따라간 경로(react-router
6.30.3, @remix-run/router 1.23.2):

- 성공 처리는 `clearNow()` → `navigate('/post')`인데, `shouldBlockNavigation`은 "열린 Alert가 있으면
  막는다"(§5 2번)를 dirty보다 먼저 본다 → 그 이동이 다시 막힌다
- 이미 막힌 blocker를 또 막으면 새 목적지로 덮어쓴다(`router.js`의 `navigate` 1852-1879행, 상태 전이표
  3008행이 blocked→blocked 허용). `blocker.state`는 그대로 `'blocked'`라 모달을 띄우는 effect가 다시
  돌지 않고 같은 모달이 남는다 → "계속 작성"의 `reset()`이 `/post` 이동을 버리고, "나가기"는 탭한
  곳이 아니라 `/post`로 갔다
- 함께 찾은 것: 응답 전에 "나가기"로 떠나면 언마운트된 폼의 `navigate`가 그대로 실행돼(react-router
  `dist/index.js`의 `useNavigateStable` 895-918행 — `activeRef`를 되돌리지 않는다) 떠난 화면이 피드로
  바뀌었고(수정 폼은 `navigate(-1)`로 한 칸 더 뒤로), 실패는 아무 안내가 없었다

**고침**: §5 세 번째 갈래(가드가 dirty 스토어를 구독해 모달을 스스로 취소)와 `useHasLeftPage`(§5
"저장 요청 중 이탈"). 검토했다 버린 안:

- 차단 규칙 2번에 "가드 자신의 모달이고 dirty가 없으면 통과" 예외를 넣는 안 — 성공 이동은 통과하지만,
  다음 화면이 suspend하는 동안 남은 낡은 모달에서 "나가기"를 누르면 이미 IDLE로 돌아간 blocker를
  proceeding으로 바꾸려다 라우터 invariant(3008행)가 throw할 수 있고, 문서화된 판정 순서도 바뀐다
- "떠났는가"를 `isMountedRef`(댓글 폼 선례)만으로 보는 안 — "나가기" 직후 다음 화면이 suspend하는 동안엔
  폼이 마운트된 채라 놓친다. 유닛 테스트로 그 구간이 실제로 있음을 확인했다(라우터는 이미 탭에 가
  있는데 폼이 아직 보인다). 판정을 마운트 여부만으로 바꾸면 그 테스트만 실패한다
- 데이터 라우터를 쓰는 유닛 테스트를 새로 만들었다(§9) — 기존 훅 테스트는 `useNavigate`·`useGoBack`을
  mock해 "호출됐다"만 봐서 이 버그를 볼 수 없었다

**2026-11-02, 가입 요청 중 "로그인"을 누르면 가입 결과를 모르던 문제.** 회원가입 제출 뒤 응답 전에 하단
"로그인" 링크를 누르면 확인 없이 로그인 화면으로 넘어가, 가입이 됐는지 알 수 없다는 제보였다. 회원가입만
요청 중에 일부러 가드를 끄고 있었다 — §6의 옛 `!isPending` 조건이 "그 사이의 이탈 시도(거의 없지만)"를 막지
않으려고 넣은 것이었고, 가입 성공은 같은 화면의 완료 화면으로만 보여 줘(토스트 없음, `auth.queries.ts`) 떠나면
결과가 사라졌다. 실패는 mutation의 `onError` 토스트라 떠난 화면에서도 보였다.

- **고침**: `!isPending`을 빼 게시글 폼과 같은 "저장 요청 중 이탈" 규칙(§5)을 따르게 했다. 떠난 뒤 성공하면
  `useSignUp`이 `useHasLeftPage()`로 확인하고 성공 토스트를 띄운다. 언마운트 뒤에도 그 줄이 실행되는 근거는
  `mutateAsync`의 promise가 옵저버와 무관하게 끝난다는 것이다 — 언마운트는 옵저버만 떼고 `mutation.execute()`의
  promise는 그대로다(설치본 `@tanstack/query-core` 5.90.16 `build/modern/mutationObserver.js:38-62`,
  `@tanstack/react-query` 5.90.16 `build/modern/useMutation.js:40`).
- **함께 고친 것**: 가입 실패 시 처리되지 않은 rejection. `onSubmit`이 `await`의 에러를 그대로 던지면
  react-hook-form 7.71.0의 `handleSubmit`이 그것을 다시 던진다(`dist/index.esm.mjs:2194-2216`) — 새 유닛 테스트의
  실패 케이스 2개가 Vitest의 "Unhandled Rejection" 에러로 이것을 드러냈다. 게시글 등록(`useCreatePost.ts`)처럼
  `onSubmit` 안에서 받고 다시 던지지 않는다. 실패 안내는 그대로 mutation의 `onError` 토스트가 맡는다
- **문구를 다시 정함(같은 날)**: 처음엔 요청 중에도 기존 문구("회원가입을 그만둘까요? / 지금 나가면 입력한 가입 정보가
  사라져요")를 그대로 쓰려 했다. 게시글 폼도 2026-10-21부터 요청 중에 "입력한 내용이 사라져요"를 띄우고 있었다.
  구현을 본 사용자가 "이미 가입을 요청했으니 그에 맞는 문구가 필요하다"고 지적했다. 그래서 요청 중 전용 문구와
  요청 중 이름표(`usePendingSubmit`)를 넣고, 게시글 등록·수정에도 같이 적용했다(§5 "저장 요청 중 이탈"). 전용 문구를
  넣기만 하면 모달이 떠 있는 동안 실패했을 때 "취소되지 않아요"가 틀린 채 남는다 — 그래서 요청 중에 띄운 모달은
  응답이 오면 닫는다. 그대로 두는 안(틀린 문구가 남음)과 평소 모달로 바꿔 띄우는 안(확인창 스토어에 문구를 바꾸는 API가
  없어 새로 만들어야 하고 화면이 깜빡임)은 버렸다. 가드가 요청 중인지 알아내는 방법으로 `queryClient.isMutating()`
  (`auth.util.ts`)도 검토했지만 그 화면의 모든 요청을 세고, 끝났는지 보려면 mutation 캐시를 따로 구독해야 해서 버렸다

**2026-11-02, 떠난 뒤 실패 토스트를 녹화하다 찾은 두 가지.** 떠난 뒤 실패 토스트(§5)는 유닛 테스트를 모두 통과했지만,
녹화로 화면을 보니 두 군데가 의도와 달랐다.

- **이미 로그인 화면이면 [로그인]이 이메일을 채우지 않았다.** 가입 화면에서 "Sign In"으로 떠난 뒤 이메일 중복으로
  실패하면, [로그인]을 누를 때 이미 로그인 화면에 있다. 같은 경로로 가는 이동이라 폼이 다시 마운트되지 않는다.
  `useForm`의 `defaultValues`는 마운트 때만 읽히므로 새로 실려 온 `state.email`이 무시됐다. 가드 테스트는 가입 폼만
  렌더해 이 경우를 볼 수 없었다. `useLogin`에 새로 실려 온 이메일을 칸에 넣는 effect(`fillEmailArrivedOnSamePage`)를
  더하고, e2e로 이 경로를 고정했다(§9). 입력 중이면 덮지 않는다.
- **데스크톱에서 되살린 안내가 화면 아래에 있었다.** [다시 등록하기]로 돌아오면 화면이 맨 위에서 시작한다. 버튼 위
  FormAlert는 접힌 아래에 있고, 이유를 적은 토스트는 버튼을 누를 때 이미 닫혔다. 그래서 왜 돌아왔는지 보이지 않았다.
  세 안을 그림으로 보여 주고 사용자가 골랐다. 고른 안은 안내가 보이는 데까지 자동으로 내리는 것이다. 버린 안은 두
  가지다. 하나는 버튼을 눌러도 토스트를 닫지 않는 안이다(sonner에서 `event.preventDefault()`, `index.mjs:820`). 다른
  하나는 그대로 두고 한계로만 적는 안이다. 내리는 기준은 제출 버튼이다. FormAlert가 버튼 바로 위라 버튼이 보이면
  안내도 보인다. `block: 'nearest'`라 이미 보이면 움직이지 않는다. 동작은 `ScrollUtil.getBehavior()`를 따른다(선례
  `CommentForm.tsx`).

## 11. 남은 것

- 저장 중 입력칸이 잠기지 않아(`CreatePostForm.tsx`는 버튼만 막는다) 그 사이 고친 내용이 성공 뒤 비워진다
- 이동이 막힌 렌더가 커밋된 뒤 모달을 띄우는 effect가 돌기 전(한 프레임 정도)에 응답이 오면, 목적지 화면에
  의미 없는 모달이 뜰 수 있다 — 누르면 닫히고, 이번에는 대응하지 않았다
- 실제 브라우저의 비동기 popstate 복원은 메모리 히스토리로 재현되지 않는다 — 필요하면 게시글 폼 e2e를 추가한다
- 댓글 작성·수정 폼은 요청 중 전용 문구를 쓰지 않는다 — 저장 중에 떠나려 하면 평소 모달("작성 중인 내용이 있어요")이
  뜬다. 붙이려면 `usePendingSubmit`과 `TEXTS.unsavedChanges.pending`의 새 키를 더한다(§6, 2026-11-02 범위 밖)
- 제출을 누른 뒤 `isPending`이 렌더에 반영되기 전(한 렌더 사이)에 떠나려 하면 요청 중 문구 대신 평소 문구가 뜬다 —
  막는 동작은 같다
- 새로고침·탭 닫기의 브라우저 기본 경고는 문구를 바꿀 수 없다. 가입 요청 중 새로고침·탭 닫기에서 브라우저 경고를 무시하고 떠나면 결과를 알릴 화면이 없다 — 토스트도 함께
  사라진다(인증 메일은 BE가 보내므로 메일함으로는 알 수 있다)
- 로그인이 풀린 채 그 화면에 둔 상태(§5의 1번)는 글을 보관하지 않는다 — 이 확인창에서 "나가기"를 고르면 그 글은
  사라지고, "나중에 이어 쓰기"는 없다([DECISIONS.md](./DECISIONS.md) 2026-10-28, 남은 한계 전체는
  [AUTH.md](./AUTH.md) §11 항목 11)
- 떠난 뒤 실패 토스트(§5): 그 폼에 새로 입력 중이면 버튼을 눌러도 되살리지 않고 토스트만 닫힌다. 새 입력을 확인 없이
  덮지 않으려는 것이다
- 떠난 사이 다른 계정으로 로그인했다면 [다시 가입하기]를 눌러도 GuestGuard가 피드로 돌려보낸다
- 수정 화면은 링크 미리보기 카드가 안내까지 내린 뒤에 늦게 뜨면 제출 버튼이 다시 화면 아래로 밀릴 수 있다. 버튼 위
  안내는 보인다(녹화에서 확인, 1280×720)
- 수정 화면에서 되살린 입력을 서버 값과 똑같이 되돌려 작성 중이 아니게 되면, 그 글을 다시 받아 올 때(3분 지난 뒤 창
  포커스 등) `resetFormWithFetchedPost`가 되살린 값과 버튼 위 안내를 다시 넣는다. `location.state`가 그대로 남아 있기
  때문이다. 되살린 입력을 고치고 있는 동안(작성 중)에는 덮지 않는다
- 댓글 폼을 떠난 뒤 실패 토스트에는 돌아갈 버튼이 없다(사용자 선택) — 제출 때 비운 입력은 되살리지 않는다
- (해결, 2026-11-02) 댓글 폼의 `isMountedRef`가 같은 정지 구간을 가져 상세에서 떠나는 중 실패하면 곧 사라질 폼에
  안내가 묻혔다 — `useHasLeftPage`로 바꿨다. 다른 에러 토스트를 곳마다 조사한 결과와 판정은
  [#488](https://github.com/BAECHAN/link-sphere_FE_NEW/issues/488)에 있다

**정정, 2026-09-29**(이 절에 남겨 둔 옛 기록): 이전 버전은 이 절에 "인증 강화
계획 FE Phase 5가 배포되면 `navigate('/auth/login')`이 없어질 가능성이 있다"는 미래형
항목을 적어뒀으나, 그 Phase 5는 이미 배포돼 있었다 — `useSignUp.ts`는 이미 `navigate`
없이 `isSubmitted` 상태로 전환하고, 우려했던 재등록 문제도 이미 `!isSubmitted` 조건으로
막혀 있다(§6 참고). 미래 리스크가 아니라 이미 해소된 과거 항목이라 이 절에서 제거했다.

## 12. 용어 사전

- **dirty(키)** — "저장하지 않은 입력이 있다"는 상태 그 자체, 또는 그
  상태를 표시하려고 폼이 레지스트리에 등록하는 문자열 키. 이 문서 전체에서
  가장 많이 쓰이지만 지금까지 정의되지 않았던 용어 — §6 표가 실제 키 값이다
- **전역 레지스트리** — `useUnsavedChangesStore`(§6)를 가리키는 표현. 폼마다
  따로 감시하지 않고 모든 폼의 dirty 여부를 한 곳에 모아두는 방식이라
  "전역"이라 부른다
- **`clearNow`** — `useUnsavedChanges`가 반환하는 함수. 특정 키를
  effect 클린업을 기다리지 않고 즉시 해제한다(§6)
- **요청 중 이름표(`pendingSubmits`)** — 요청을 보내고 응답을 기다리는 폼이 붙이는 두 번째 이름표. 키와 함께 그동안
  이탈 모달에 쓸 문구를 담는다. 이동을 막지는 않고, 모달 문구와 모달을 닫는 시점만 정한다(§5 "저장 요청 중 이탈", §6)
- **`usePendingSubmit`** — 폼이 요청 중 이름표를 붙이고 떼는 훅(§6)
- **`ProtectedRoute`** — 인증이 필요한 라우트를 감싸 비로그인 접근을
  리다이렉트하는 컴포넌트. §5의 "로그인 상태가 아니면 통과" 분기가 이
  리다이렉트를 막지 않기 위한 것이다. 로그인이 풀린 채 그 화면에 둔 동안(`signedOutInPlace`)에는
  리다이렉트하지 않고 화면을 남긴다
- **`signedOutInPlace`** — `useAuthStore`의 값. 로그인이 만료되거나 쓰는 중에 다른 탭이 로그아웃했지만 화면을
  떠나지 않고 그 자리에 로그인 창을 띄운 상태다. 이 값이 있으면 로그아웃 상태여도 이 가드가 평소처럼 막는다
  (§5의 1번, 상세는 [AUTH.md](./AUTH.md) §8-I)
- **`clearAllUnsavedChanges`** — 등록된 dirty 키를 모두 즉시 해제하는 모듈 헬퍼(§6). 쓰던 글을 버리기로 한
  이동(다른 회원으로 바뀜, 공개 화면의 `SESSION_MISMATCH`, 직접 로그아웃 확인)이 이 가드에 막히지 않게 한다
- **blocker** — react-router `useBlocker`가 돌려주는 객체. 이동을 막으면 `state`가 `'blocked'`가 되고
  `proceed()`(막힌 이동 진행)·`reset()`(막힌 이동 버림)을 갖는다. 모달의 "나가기"·"계속 작성"이 각각 이 둘을 부른다
- **정지 구간** — 라우터 위치는 이미 바뀌었는데 `v7_startTransition` 때문에 다음 화면이 suspend해 React가
  아직 이전 화면을 보여주는 사이. 자세한 설명은 `shared/lib/router/router-events.ts` 머리말
- **`useHasLeftPage`** — 응답을 기다린 뒤 그 사이 화면을 떠났는지(언마운트 또는 라우터 경로가 바뀜) 돌려주는
  함수를 주는 훅(§5 "저장 요청 중 이탈")
- **떠난 뒤 실패 토스트(`showLeftPageFailureToast`)** — 저장 요청 중 "나가기"로 떠난 뒤 실패했을 때 옮겨 간 화면에
  띄우는 토스트. 닫을 때까지 남고, 제목·설명·돌아갈 버튼을 갖는다(§5 "떠난 뒤 실패 토스트")
- **되살리기(`restoredInput`·`restoredSubmission`)** — 그 토스트의 버튼이 `location.state`에 실어 보낸 입력을 폼이 다시
  채우는 것. 가입은 `restoredInput`(닉네임·이메일), 게시글은 `restoredSubmission`(폼 값 + 실패 판정, 수정은 `postId`까지)
- **`retryable: false`·`unclassified`** — `PostUtil.resolveSubmitError`가 form 갈래에 붙이는 표시. 앞은 "다시 해도
  실패한다"(글 삭제됨·남의 글 → 버튼 없음), 뒤는 "아는 원인이 아니다"(→ 설명을 "잠시 후 다시 시도해주세요.")
- **`NavigationService`** — 컴포넌트 밖에서 라우터 이동을 하는 모듈(`shared/lib/router/navigation.ts`). 폼이 언마운트된
  뒤 눌리는 토스트 버튼이 이것으로 폼에 돌아간다
