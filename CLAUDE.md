# Link-Sphere FE — Claude Code Guide

@docs/FE-ARCHITECTURE.md

---

## Critical Rules

- **Never** native `confirm()` → 항상 `useAlert` + `openConfirm` 사용
- **Never** API 레이어 건너뛰기 → API 호출은 반드시 `.api.ts` 에서만
- **Never** 인라인 쿼리 키 → 항상 `<entity>Keys.*` 사용
- **Never** 인라인 문자열 → 항상 `TEXTS.*` 사용
- **Never** 인라인 API 경로 → 항상 `API_ENDPOINTS.*` 사용
- **Never** feature hook에서 직접 `queryClient.invalidateQueries` → 항상 `.keys.ts` success handlers 사용

## Slash Commands (`.claude/commands/`)

| 커맨드            | 사용법                            | 역할                   |
| ----------------- | --------------------------------- | ---------------------- |
| `/new-domain`     | `/new-domain notification`        | 도메인 전체 구조 생성  |
| `/new-feature`    | `/new-feature post pin-post`      | feature hook + UI 생성 |
| `/add-entity-api` | `/add-entity-api post tag`        | 3-layer API 파일 생성  |
| `/add-schema`     | `/add-schema member address`      | Zod 스키마 파일 생성   |
| `/fix-bug`        | `/fix-bug 삭제 후 목록 갱신 안됨` | 버그 분석 + 수정       |
| `/code-review`    | `/code-review`                    | 아키텍처 준수 리뷰     |
