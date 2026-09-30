#!/usr/bin/env bash
# .claude/hooks/run-node.sh
#
# Node로 쓴 훅 스크립트(bash-guard.mjs, edit-guard.mjs)를 실행하는 래퍼. 사용법:
#   bash .claude/hooks/run-node.sh <같은 디렉터리의 .mjs 파일명>   (stdin으로 훅 payload)
#
# 가드를 bash가 아니라 Node로 쓴 이유: macOS 기본 bash 3.2로는 따옴표·heredoc·cd·git -C가 섞인
# 명령을 안정적으로 파싱할 수 없고, 측정기(rule-metrics.mjs)와 같은 파서(.claude/lib/
# shell-parse.mjs)를 써야 "측정이 세는 위반"과 "가드가 막는 위반"이 일치한다.
#
# 훅 프로세스는 에디터(Cursor/VS Code)가 띄운 Claude Code의 환경을 물려받아 nvm의 node가 PATH에
# 없을 수 있다 — PATH → nvm → Homebrew 순으로 찾는다. 훅은 절대 작업을 막는 방향으로 실패하면
# 안 되므로(plan-diagram-reminder.sh와 같은 원칙) node나 대상 스크립트가 없으면 조용히 통과한다.
# set -e를 쓰지 않는 이유도 같다.
#
# 등록: 이 가드들은 FE 프로젝트 설정이 아니라 사용자 설정(~/.claude/settings.json)에 등록한다 —
# BE 레포에서 시작한 세션도 FE 메인 체크아웃을 건드릴 수 있어서다(프로젝트 설정은 그 레포 세션에만
# 로드된다). Claude는 사용자 설정에 훅을 추가할 수 없으므로(auto mode 분류기가 Self-Modification
# 으로 거부) 사용자가 아래 블록을 최상위 키로 직접 붙여넣는다. 경로는 FE 메인 체크아웃이라, 이
# 파일이 바뀌면 메인 체크아웃을 `git pull --ff-only`해야 반영된다.
#
#   "hooks": {
#     "PreToolUse": [
#       {
#         "matcher": "Bash",
#         "hooks": [
#           { "type": "command", "if": "Bash(git *)", "timeout": 10,
#             "command": "bash /Users/baechan/project/link-sphere/link-sphere_FE_NEW/.claude/hooks/run-node.sh bash-guard.mjs" },
#           { "type": "command", "if": "Bash(rm *)", "timeout": 10,
#             "command": "bash /Users/baechan/project/link-sphere/link-sphere_FE_NEW/.claude/hooks/run-node.sh bash-guard.mjs" }
#         ]
#       },
#       {
#         "matcher": "Edit|Write|NotebookEdit",
#         "hooks": [
#           { "type": "command", "timeout": 10,
#             "command": "bash /Users/baechan/project/link-sphere/link-sphere_FE_NEW/.claude/hooks/run-node.sh edit-guard.mjs" }
#         ]
#       }
#     ]
#   }
#
# 발동 여부는 `node .claude/scripts/rule-metrics.mjs`의 M12(훅 발동)로 확인한다 — 등록 후 계속
# 0이면 경로 오타·node 미발견으로 조용히 꺼진 것이다.
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${script_dir}/${1:-}"

if [ -z "${1:-}" ] || [ ! -f "${target}" ]; then
  exit 0
fi

node_bin="$(command -v node 2>/dev/null || true)"

if [ -z "${node_bin}" ]; then
  for candidate in "${HOME}"/.nvm/versions/node/*/bin/node; do
    if [ -x "${candidate}" ]; then
      node_bin="${candidate}"
    fi
  done
fi

if [ -z "${node_bin}" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "${candidate}" ]; then
      node_bin="${candidate}"
      break
    fi
  done
fi

if [ -z "${node_bin}" ]; then
  exit 0
fi

exec "${node_bin}" "${target}"
