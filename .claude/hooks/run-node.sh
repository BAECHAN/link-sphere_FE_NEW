#!/usr/bin/env bash
# .claude/hooks/run-node.sh
#
# Node로 쓴 훅 스크립트(filename-case-check.mjs)를 실행하는 래퍼. 사용법:
#   bash .claude/hooks/run-node.sh <같은 디렉터리의 .mjs 파일명>   (stdin으로 훅 payload)
#
# 2026-11-16까지는 bash-guard·edit-guard·deploy-verify도 이 래퍼로 돌았다. 세 훅의 정본은 2026-11-01에
# ~/project/claude-base/hooks/로 옮겼고(그쪽에 같은 이름의 run-node.sh가 있다), 이 레포의 동결 사본은
# 2026-11-16에 지웠다. 여기 남은 것은 FE 전용인 filename-case-check뿐이다.
#
# 훅 프로세스는 에디터(Cursor/VS Code)가 띄운 Claude Code의 환경을 물려받아 nvm의 node가 PATH에
# 없을 수 있다 — PATH → nvm → Homebrew 순으로 찾는다. 훅은 절대 작업을 막는 방향으로 실패하면
# 안 되므로 node나 대상 스크립트가 없으면 조용히 통과한다. set -e를 쓰지 않는 이유도 같다.
#
# 등록: FE 프로젝트 설정이 아니라 사용자 설정(~/.claude/settings.json)의 hooks.PostToolUse에 등록한다 —
# BE 레포에서 시작한 세션도 FE 워크트리에 파일을 쓴다(프로젝트 설정은 그 레포 세션에만 로드된다).
# 경로는 FE 메인 체크아웃이라, 이 파일이 바뀌면 메인 체크아웃을 `git pull --ff-only`해야 반영된다.
#
#   {
#     "matcher": "Write",
#     "hooks": [
#       { "type": "command", "timeout": 25,
#         "command": "bash /Users/baechan/project/link-sphere/link-sphere_FE_NEW/.claude/hooks/run-node.sh filename-case-check.mjs" }
#     ]
#   }
#
# 발동 여부는 `node ~/project/claude-base/scripts/rule-metrics.mjs`의 M12(훅 발동)로 확인한다 — 등록 후 계속
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
