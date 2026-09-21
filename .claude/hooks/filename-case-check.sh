#!/usr/bin/env bash
# .claude/hooks/filename-case-check.sh
#
# PostToolUse(Write) 훅 — 새로 만든 파일이 eslint.config.js의 unicorn/filename-case
# 규칙(atoms·컴포넌트·훅·utils·api·queries·types·schema·config 전부 커버)을 어기면
# 그 자리에서 알린다.
#
# 배경: 2026-09-22, queryClient↔auth.util 순환 의존을 고치며 상태를 분리한 유틸 파일을
# logoutGrace.util.ts(camelCase)로 먼저 만들었다가 사용자 지적으로 뒤늦게 kebab-case로
# 고쳤다. 이 룰 자체는 이미 있었고(src/**/utils/**은 kebab-case 강제) 실제로 걸러낼 수도
# 있었지만, lint를 돌리기 *전에* 이름을 스스로 정정해버려서 룰이 개입할 기회가 없었다
# (사후 프로브 파일로 재현 확인: 실제로 즉시 에러가 남). 파일 생성 직후 그 파일 하나만
# 즉시 검사해, lint 실행 시점까지 기다리지 않고 바로 피드백을 준다.
#
# Write에만 건다(Edit/MultiEdit 아님) — 파일명은 생성 시점에만 정해지고, 기존 파일을
# 고치는 동작으로는 이름이 안 바뀐다.
#
# set -e를 쓰지 않는 이유: plan-diagram-reminder.sh와 동일 - grep/명령 실패가 정상
# 흐름인 지점들이 있어 set -e 아래에서는 훅이 조용히 무력화될 수 있다(그 훅 주석의
# 실측 케이스와 같은 함정). 모든 종료는 명시한다.
set -uo pipefail

# 훅은 절대 작업을 막는 방향으로 실패하면 안 된다 - 도구가 없으면 조용히 통과.
command -v jq >/dev/null 2>&1 || exit 0

payload=$(cat)
[ -n "${payload}" ] || exit 0

file_path=$(printf '%s' "${payload}" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "${file_path}" ] || exit 0

# 경로 매칭은 [[ =~ ]]가 아니라 case로 - 공백·한글·글로브 문자에 안전하다.
case "${file_path}" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

case "${file_path}" in
  /*) ;;
  *) file_path="${CLAUDE_PROJECT_DIR:-$PWD}/${file_path}" ;;
esac

[ -f "${file_path}" ] || exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"

# unicorn/filename-case 규칙은 src/** 아래만 커버한다(eslint.config.js) - 그 밖은 검사 무의미.
case "${file_path}" in
  "${project_dir}/src/"*) ;;
  *) exit 0 ;;
esac

command -v pnpm >/dev/null 2>&1 || exit 0
[ -d "${project_dir}/node_modules" ] || exit 0

result=$(cd "${project_dir}" && pnpm exec eslint --format json "${file_path}" 2>/dev/null)
[ -n "${result}" ] || exit 0

message=$(printf '%s' "${result}" | jq -r '
  [.[].messages[]? | select(.ruleId == "unicorn/filename-case")] as $violations
  | if ($violations | length) > 0 then $violations[0].message else empty end
' 2>/dev/null) || exit 0

[ -n "${message}" ] || exit 0

cat >&2 <<EOF
[docs/FE-ARCHITECTURE.md §18 네이밍 컨벤션] 방금 만든 파일이 파일명 규칙을 어깁니다.
  ${file_path}
  ${message}
lint 실행을 기다리지 말고 지금 바로 이름을 고치세요.
EOF
exit 2
