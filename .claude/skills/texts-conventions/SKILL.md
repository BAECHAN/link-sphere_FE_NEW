---
name: texts-conventions
description: Link-Sphere FE 사용자 노출 문구(`TEXTS.*`) 네임스페이스 구조와 톤 규칙. 새 UI 문자열을 추가하거나 성공 토스트가 필요한지 판단할 때 사용.
when_to_use: TEXTS.*에 새 키를 추가할 때, 사용자 노출 문구의 톤(해요체)을 맞출 때, 새 성공 토스트를 추가할지 판단할 때.
paths: src/shared/config/texts.ts
---

2026-09-09, `.claude/CLAUDE.md`가 984줄로 길어져 [공식 권장 목표치(~200줄)](https://code.claude.com/docs/en/memory)를
크게 넘긴 것을
계기로 CLAUDE.md 본문에서 이 절을 옮겼다 — 매 세션 로드할 필요 없이 TEXTS 관련 작업을
할 때만 불러오면 된다.

## TEXTS 구조 (`src/shared/config/texts.ts`)

모든 UI 문자열은 `TEXTS.*`로 참조. 새 문자열 추가 시 반드시 `texts.ts`에 먼저 키를 추가한 뒤 사용.

```
TEXTS
├── common.* (submitting, updating, saving, confirm, cancel, ...)
├── pages.home / pages.post.ROOT / pages.post.SUBMIT
├── labels.nickname / email / password / message
├── placeholders.nickname / email / password / message / postSearch
├── buttons.retry / refresh / home / back / login / logout / delete / search / ...
├── auth.login.* / auth.signup.*
├── nav.brand / feed / submit / logIn / logOut / toggleSearch / toggleTheme / saving
├── mypage.* (title, description, save, changeImage, checkingNickname, ...)
├── recentSearch.* (title, clearAll, empty, removeItem)
├── post.form.create.* (title, description1/2, urlLabel, urlPlaceholder, titleLabel, ...)
├── post.form.update.* (title, description, titleLabel, titlePlaceholder, updating, update, ...)
├── post.card.* (anonymous, visitWebsite, aiSummary, edit, saving, ...)
├── post.detail.* (notFound, backToList)
├── comment.list.* (loadError, heading, empty)
├── comment.form.* (replyPlaceholder, commentPlaceholder, preview, cancel, save, ...)
├── bookmark.* (folder.myFolders/create/all/uncategorized, empty.all/uncategorized/folder, ...)
├── errors.* (notFound/forbidden/serverError/unexpected — title, description)
├── notification.* (defaultTitle, viewAction)
├── descriptions.passwordGuide
├── validation.urlFormat / urlRequired / titleRequired / passwordRegex / emailRegex / ...
├── messages.info.noData / noPosts
├── messages.warning.postDeleteConfirm / commentDeleteConfirm / memberDeleteConfirm
├── messages.success.postCreated / postUpdated / accountUpdated / linkCopied / accountCreated / bookmarkSavedTo / ...
├── messages.error.defaultError / loginFailed / postCreateFailed / linkCopyFailed / ...
├── unsavedChanges.* (title, message, confirm, cancel)
├── shortcuts.sidebarToggle / sidebarToggleMac
└── ariaLabels.* (레이아웃, 헤더, 사이드바, 입력 필드 등)
```

### 톤 규칙

`TEXTS`의 사용자 노출 문구는 **해요체**로 통일한다 (2026-08-04, 기존 합쇼체 `-되었습니다.`
방침에서 변경 — 토스 등 국내 서비스 UX 라이팅 사례 조사 후 확정). 합쇼체 `-습니다./-입니다.`,
격식 청유형 `-시겠습니까?`, 사용자 노출 개조식 명사 종결(`"폴더 생성 실패"` 등)을 새로 섞지
않는다. 콘솔 로그 전용 문구(`console.error`에만 쓰이는 키, 예: `apiRequestFailed`)는 예외 —
톤 규칙 대상이 아니다.

- 예: `messages.success.accountCreated` `'가입을 완료했어요.'`,
  `messages.error.nicknameDuplicate` `'이미 사용 중인 닉네임이에요.'`,
  `messages.warning.postDeleteConfirm` `'정말 이 포스트를 삭제할까요? …'`.
- 완료를 나타내는 성공 메시지(`messages.success`)는 가능하면 **능동형**으로 쓴다
  (`'프로필이 업데이트됐어요.'`보다 `'프로필을 업데이트했어요.'`). 다만 행위자가 불분명하거나
  상태를 서술하는 문구(예: 삭제된 글 안내처럼 "누가" 지웠는지 알 수 없는 경우)까지 억지로
  능동형으로 바꾸지 않는다 — 어색해지는 쪽이 우선순위에서 진다.
- 제목·헤딩(`DialogTitle`, 페이지 `title` prop 등)은 마침표 없이, 본문·설명·토스트류
  문장은 마침표를 붙인다.
- 가드 테스트 `shared/config/texts.test.ts`가 `TEXTS` 전체를 순회하며 구 합쇼체·격식
  청유형(`니다`로 끝나는 모든 형태 — `습니다`/`입니다`/`합니다`/`옵니다` 등, `니까?`) 잔존
  여부를 자동 검사한다(콘솔 전용 키는 화이트리스트로 제외). 새 문구를 추가하면 이 테스트가
  통과하는지로 톤을 확인할 수 있다.

### 성공 토스트 표시 기준

`messages.success`에 새 키를 추가하기 전에, 정말 토스트가 필요한지부터 판단한다. 낙관적
업데이트로 화면이 이미 바뀌는 액션에 "성공했습니다" 토스트까지 띄우면 사용자가 이미 본 결과를
텍스트로 한 번 더 말해주는 중복 신호가 된다.

**판단 축**:

1. **가시성** — 액션 직후 현재 화면에서 결과가 바로 보이는가? (목록에서 사라짐·이름
   변경·아이콘 상태 전환 등) → 보이면 토스트 불필요. 단, "생성"(카드가 목록에 새로
   나타남)·"삭제"(사라짐)·"토글"(아이콘 전환)처럼 위치·존재 자체가 바뀌는 액션은 확실히
   눈에 띄지만, "수정"(Update)은 다르다 — 본문처럼 스크롤 밖에 있거나 다른 화면으로
   이동한 뒤에야 반영되는 필드는 사용자가 바로 인지 못 할 수 있다(2026-09-09 확정:
   `postUpdated`/`accountUpdated`를 이 이유로 "필요" 쪽으로 재분류).
2. **정보량** — 토스트가 "성공했다" 이상의 구체적 정보(어디에 저장됐는지, 왜 이렇게
   됐는지)를 전달하는가? → 전달한다면 가시성과 무관하게 필요.
3. **실행취소** — 토스트에 "실행 취소" 액션이 붙어 있(을 예정이)는가? → 그렇다면 유지.

| 필요 (예)                                                                                               | 불필요 (예)                                                                |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `linkCopied` — 클립보드 복사는 화면 변화가 전혀 없음                                                    | `postDeleted`/`folderDeleted` — 목록에서 바로 사라짐(생성·삭제·토글류)     |
| `bookmarkSavedTo(folderName)` — 아이콘만 봐선 "어느 폴더"인지 모름                                      | `postVisibilityUpdated`/`bookmarkRemoved` — 아이콘 상태 전환으로 이미 보임 |
| `postUpdated`/`accountUpdated` — 본문 등 수정 내용이 스크롤 밖·다른 화면에 있어 바로 티가 안 날 수 있음 | —                                                                          |

- 유의: 시각적 상태 변화만으로 충분하다고 판단해 토스트를 없애도, 스크린리더 사용자에게는
  그 변화가 그대로 전달되지 않을 수 있다(접근성). 별도 `aria-live` 공지가 필요한지는 케이스
  발생 시 별도로 판단한다 — 이 기준만으로 미리 다 막지 않는다.
