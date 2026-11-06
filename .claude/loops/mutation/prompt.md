# 뮤테이션 테스트 보강

`{{target}}`의 동작을 지키는 테스트를 `{{testFile}}`에 쓴다. JSX가 필요하면 확장자를 `.tsx`로 쓴다. 만든 파일은 지울 수 없으니 확장자를 쓰기 전에 정한다.

뮤턴트는 코드 한 곳을 일부러 망가뜨린 사본이다. 아래 목록은 지금 테스트가 못 잡는 뮤턴트다. `[Survived]`는 망가뜨려도
테스트가 통과했다는 뜻이고, `[NoCoverage]`는 그 줄을 지나는 테스트가 없다는 뜻이다. 앞의 숫자는 줄:칸, 화살표 뒤는 바뀐 코드다.

```
{{mutants}}
```

## 할 일

1. 대상 파일과 그 파일을 쓰는 곳을 읽고, 이 코드가 지켜야 할 동작을 파악한다.
2. 그 동작을 단언하는 테스트를 쓴다. 뮤턴트 목록은 어디가 비었는지 보는 참고 자료이지 목표가 아니다.
3. 아래 명령을 모두 통과시킨다. `.tsx`로 썼으면 명령의 경로도 `.tsx`로 바꾼다.
   - `pnpm exec vitest run --config vitest.stryker.config.ts {{testFile}}`
   - `pnpm exec eslint --fix {{testFile}}`
   - `pnpm type-check`
4. 마지막 응답을 아래 "출력" 형식으로 낸다.

## 지킬 것

- 쓸 수 있는 파일은 테스트 파일 하나다. 대상 파일이나 다른 파일을 고쳐야 할 것 같으면 `blocked`로 보고한다.
  테스트 파일을 둘 만들었어도 `blocked`로 보고한다. 남은 파일을 채워 명령을 통과시키지 않는다.
- Bash는 위 명령만 허용된다. 적힌 그대로 하나씩 실행한다. `;`·`&&`·파이프로 잇거나 뒤에 무엇을 덧붙이면 거부된다.
- 파일은 Read·Glob·Grep으로 읽는다. 네트워크는 없다.
- 호출하는 쪽이나 사용자가 관찰할 수 있는 결과를 단언한다. 구현 줄을 그대로 옮긴 단언, 내부 호출 순서만 보는 단언,
  뮤턴트를 죽이려고만 만든 단언은 쓰지 않는다.
- 지금 동작이 틀려 보이면 테스트로 고정하지 않는다. 멈추고 `suspected-bug`로 보고한다.
- 바꿔도 동작이 같아 어떤 테스트로도 구분할 수 없는 뮤턴트(등가 뮤턴트)는 억지로 잡지 않는다.
- `.skip`·`.only`·`.todo`를 쓰지 않는다.

## 테스트 환경

- Vitest + jsdom. 전역 셋업은 `src/test/setup.ts`(MSW, jsdom 스텁, 토스트 목)이고 자동으로 적용된다.
- 훅은 `@testing-library/react`의 `renderHook`으로 돌린다. 예: `src/shared/hooks/useClickGuard.test.ts`.
- 프로바이더가 필요하면 `src/test/utils.tsx`의 `renderWithProviders`·`createTestQueryClient`를 쓴다.
- API는 목으로 대체하지 않고 MSW로 응답을 준다. `src/mocks/server.ts`, `src/mocks/http.ts`, `src/mocks/fixtures/`를 쓴다.
- import는 `@/` 별칭을 쓴다. 테스트 제목은 지키려는 동작을 한국어 문장으로 쓴다.

## 코드 스타일

- `if`는 한 줄이어도 중괄호로 감싼다. 가드절 뒤와 `if`·`try` 블록 앞뒤에 빈 줄을 둔다.
- 날짜는 `new Date()` 대신 `dayjs`를 쓴다.
- 옆에 있는 테스트 파일의 들여쓰기·따옴표·주석 밀도를 따른다.

## 출력

- `status`
  - `done`: 테스트를 다 썼고 위 명령이 모두 통과했다.
  - `suspected-bug`: 지금 동작이 틀려 보인다. `findings`에 줄과 이유를 적는다.
  - `equivalent`: 남은 뮤턴트가 모두 등가라 더 쓸 테스트가 없다. `findings`에 줄과 이유를 적는다. 테스트 파일이 있으면 위 명령을 통과시킨 뒤에 낸다.
  - `blocked`: 테스트 파일 하나만으로는 진행할 수 없다. `findings`에 이유를 적는다.
- `summary`: 테스트가 지키는 동작을 두세 문장으로 쓴다.
- `findings`: 해당 없으면 빈 배열이다.
