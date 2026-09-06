# 문서 안내

> **문서 성격**: 랜딩 페이지 — 아래 문서들을 요약하지 않고 안내만 한다.
>
> **대상 독자**: 이 레포에서 무언가를 찾는 모든 개발자.
>
> **읽고 나면**: 지금 필요한 문서가 어느 것인지 찾아 이동할 수 있다.
>
> **마지막 검토**: 2026-09-06

`docs/`의 문서는 성격에 따라 네 종류로 나뉜다(설계 결정 기록은 `DECISIONS.md` 하나뿐이라
표는 합쳤다). 새 문서를 추가하면 이 표와 루트 [`../README.md`](../README.md)의 `## 문서`
섹션 두 곳 모두에 등록한다(`.claude/CLAUDE.md`의 "docs/ 내부 분류" 규칙).

## 독립 기능 문서 (서사형 — "지금 어떻게 동작하는가")

| 문서                                                     | 무엇을 설명하는가                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`BOOKMARK.md`](./BOOKMARK.md)                           | 북마크 페이지 — 폴더 분류, 반응형 3분기, 폴더 내 검색                     |
| [`CI-CHECK-GATE.md`](./CI-CHECK-GATE.md)                 | `pnpm check`가 실제로는 아무 데도 안 걸려 있던 문제와 PR·배포 게이트 정비 |
| [`FCM-PUSH-NOTIFICATION.md`](./FCM-PUSH-NOTIFICATION.md) | 댓글·답글 FCM 웹 푸시 — 토큰 수명주기, 서비스워커, 알림 클릭 딥링크       |
| [`MYPAGE.md`](./MYPAGE.md)                               | 프로필 수정 모달 — 닉네임·아바타 변경, 재오픈 시 입력값 복원              |
| [`UNSAVED-CHANGES-GUARD.md`](./UNSAVED-CHANGES-GUARD.md) | 저장하지 않은 입력이 있을 때 페이지 이탈을 막는 전역 가드                 |

## 절차 (how-to·런북 — "이럴 땐 이렇게 한다")

| 문서                         | 언제 보는가                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| [`DEPLOY.md`](./DEPLOY.md)   | S3+CloudFront 배포 아키텍처, GitHub Actions 파이프라인, Secrets 설정 |
| [`TESTING.md`](./TESTING.md) | Vitest·Testing Library·MSW로 테스트 작성/실행하는 법                 |

## 레퍼런스 (사실 — "지금 값이 뭔가")

| 문서                                                     | 무엇을 담고 있는가                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`FE-ARCHITECTURE.md`](./FE-ARCHITECTURE.md)             | FSD 변형 구조(정식 FSD와 다른 점 포함), 3-Layer API·Feature Hook 등 재사용 패턴, 네이밍 컨벤션  |
| [`SYSTEM-ARCHITECTURE.md`](./SYSTEM-ARCHITECTURE.md)     | 시스템 컨텍스트·배포 파이프라인·FE/BE 구조를 Mermaid로 정리                                     |
| [`VERSION-COMPATIBILITY.md`](./VERSION-COMPATIBILITY.md) | BE·FE 버전 호환 매트릭스                                                                        |
| [`HISTORY.md`](./HISTORY.md)                             | 커밋 기반 변경 이력 — **`.github/workflows/history.yml`이 자동 생성한다. 직접 편집하지 않는다** |

## 설계 결정 기록 (ADR 경량판)

| 문서                             | 무엇을 담고 있는가                                              |
| -------------------------------- | --------------------------------------------------------------- |
| [`DECISIONS.md`](./DECISIONS.md) | 되돌리기 어렵고 대안을 비교해 선택한 설계·UX 결정 (append-only) |

## 문서가 아닌 것

- [`../README.md`](../README.md) — 프로젝트 개요, 기술 스택, 시작하기
- [`../CHANGELOG.md`](../CHANGELOG.md) — 버전별 변경 사항 (Keep a Changelog)
