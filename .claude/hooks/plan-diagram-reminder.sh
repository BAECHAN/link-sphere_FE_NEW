#!/usr/bin/env bash
# .claude/hooks/plan-diagram-reminder.sh
#
# PostToolUse(Write|Edit|MultiEdit) 훅 — 계획 파일에 Mermaid 순서도가 빠졌는지 확인한다.
# 규칙 본문은 .claude/CLAUDE.md §12. 이 훅은 1차 수단(Plan 모드 Final Plan 작성 시점에
# CLAUDE.md §12를 읽고 직접 넣는 것)을 놓쳤을 때의 2차 안전망이다.
#
# set -e를 쓰지 않는 이유: 이 스크립트는 "grep이 실패하면 계속 진행"이 정상 흐름인데
# `grep -q ... && exit 0`이 마지막 문장이면 set -e 아래에서 종료코드가 1이 되어 훅이
# 조용히 무력화된다(실측 확인). 모든 종료는 명시한다.
set -uo pipefail

MIN_LINES="${PLAN_DIAGRAM_MIN_LINES:-150}"

# 훅은 절대 작업을 막는 방향으로 실패하면 안 된다 — 도구가 없으면 조용히 통과.
command -v jq >/dev/null 2>&1 || exit 0

payload=$(cat)
[ -n "${payload}" ] || exit 0

file_path=$(printf '%s' "${payload}" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "${file_path}" ] || exit 0

# 경로 매칭은 [[ =~ ]]가 아니라 case로 — 공백·한글·글로브 문자에 안전하다.
case "${file_path}" in
  */plans/*.md) ;;
  *) exit 0 ;;
esac

case "${file_path}" in
  /*) ;;
  *) file_path="${CLAUDE_PROJECT_DIR:-$PWD}/${file_path}" ;;
esac

[ -f "${file_path}" ] || exit 0

# 이미 git에 추적 중인 계획 스냅샷(docs/plans/)은 건드리지 않는다.
# CLAUDE.md §11 append-only + ci.yml "docs/plans 불변성 확인"과 충돌하기 때문.
# ~/.claude/plans는 git 저장소가 아니라 이 명령이 실패 → 조건 거짓 → 계속 진행한다.
if git -C "$(dirname "${file_path}")" ls-files --error-unmatch -- "${file_path}" >/dev/null 2>&1; then
  exit 0
fi

lines=$(wc -l < "${file_path}" | tr -d '[:space:]')
case "${lines}" in '' | *[!0-9]*) exit 0 ;; esac
[ "${lines}" -ge "${MIN_LINES}" ] || exit 0

grep -qE '^[[:space:]]*(```|~~~)[[:space:]]*mermaid' "${file_path}" && exit 0
grep -qE '<!--[[:space:]]*no-diagram:' "${file_path}" && exit 0

# 주의: 맥 기본 bash 3.2는 "$lines줄"에서 한글을 변수명으로 먹는다(set -u면 사망).
# 한글이 뒤따르는 변수는 반드시 ${var} 형태로 쓴다.
cat >&2 <<EOF
[.claude/CLAUDE.md §12] 계획 파일에 Mermaid 순서도가 없습니다.
  ${file_path} (${lines}줄 / 기준 ${MIN_LINES}줄)
단계·분기·실패 지점이 여럿이면 산문만으로 끝내지 말고 Mermaid 순서도를 넣으세요.
정말 흐름이랄 게 없는 작업이면 파일 안에 아래 한 줄을 남기면 이 확인이 멈춥니다.
  <!-- no-diagram: (왜 다이어그램이 필요 없는지 한 줄) -->
EOF
exit 2
