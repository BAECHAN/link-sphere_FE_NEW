// 계획 대조 에이전트(.claude/agents/plan-verifier.md)를 채점할 사례를 만든다. 2026-10-31, AI 루프·
// 멀티에이전트 준비 Phase 1(docs/plans/2026-10-31-ai-loop-graph-readiness.md). 머지된 PR의 계획 파일과
// squash 커밋 diff를 사례 폴더에 떨구고, 절반에는 결함 두 개를 고정 시드로 넣는다.
//
// - 빼기: 계획에 경로나 파일명이 나온 파일의 변경을 통째로 뺀다. hunk 하나만 빼면 그 hunk가 계획
//   항목과 무관한 import 한 줄일 수 있어 "미구현"이라는 정답이 성립하지 않는다.
// - 끼우기: 다른 사례 PR의 src/ hunk 하나를 경로 순서 자리에 끼운다(계획에 없는 변경).
//
// 정답 키는 파일로 남기지 않고 표준 출력으로만 낸다 — 평가받는 에이전트가 폴더를 뒤져 답을 보지
// 못하게 하려는 것이다. 출력 JSON을 평가 workflow(.claude/workflows/plan-verifier-eval.js)의 args로 넘긴다.
// 로컬 전용이다 — CI나 package.json에 등록하지 않는다.
//
// 사용법:
//   node .claude/scripts/plan-eval-cases.mjs --out <폴더> [--seed N] <PR 번호...>
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 원래 PR의 §11 대조가 이미 이탈·계획 밖으로 적은 파일(PR 본문 "계획 대비 구현"에서 옮김). 정상 사례에서
// 이 파일을 짚은 지적은 오탐으로 세지 않고, 빼기 대상에서도 제외한다. 사례로 쓰려면 먼저 여기 적는다.
export const KNOWN_FINDINGS = {
  313: [
    'src/entities/post/ui/LinkPreviewCard.test.tsx',
    'src/entities/post/ui/LinkPreviewCard.tsx',
    'docs/POST.md',
  ],
  364: ['docs/POST.md', 'src/entities/interaction/api/interaction.queries.ts'],
  382: [
    '.claude/skills/design-tokens/SKILL.md',
    'docs/SEARCH.md',
    'e2e/like.spec.ts',
    'e2e/post-card-click-area.spec.ts',
    'e2e/guest-guard.spec.ts',
  ],
  392: ['e2e/reduced-motion.spec.ts', '.claude/skills/motion-ux/SKILL.md'],
  400: ['src/features/post/create/ui/CreatePostForm.tsx'],
  402: [
    'src/widgets/post/post-list/ui/PostList.test.tsx',
    'docs/SEARCH.md',
    'docs/POST.md',
    'src/widgets/post/post-list/hooks/usePostListSearch.ts',
    'src/widgets/post/post-list/hooks/usePostList.ts',
  ],
  406: ['src/shared/api/client.ts', 'src/shared/api/client.test.ts', 'docs/AUTH.md'],
  438: [],
};

const DEFAULT_SEED = 20261031;
// 끼울 hunk가 너무 길면 diff에서 눈에 띄어 난이도가 낮아진다.
const MAX_DONOR_HUNK_LINES = 40;

/** `git show` 형식의 diff를 파일 구간({ path, header, hunks })으로 나눈다. */
export function splitDiff(text) {
  const sections = [];
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      sections.push({ path: line.match(/ b\/(.+)$/)[1], header: [line], hunks: [] });
      continue;
    }

    const current = sections.at(-1);

    if (!current) {
      continue;
    }

    if (line.startsWith('@@')) {
      current.hunks.push([line]);
    } else if (current.hunks.length > 0) {
      current.hunks.at(-1).push(line);
    } else {
      current.header.push(line);
    }
  }

  return sections;
}

export function joinDiff(sections) {
  return `${sections.flatMap((s) => [...s.header, ...s.hunks.flat()]).join('\n')}\n`;
}

/** 시드가 같으면 같은 수열을 내는 의사 난수(mulberry32). */
export function createRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function shuffle(rng, list) {
  const result = [...list];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

const isPlanFile = (filePath) => filePath.startsWith('docs/plans/');
const mentionedInPlan = (filePath, planText) =>
  planText.includes(filePath) || planText.includes(path.basename(filePath));

/** 빼기 후보: 계획에 이름이 나오고, 원래 대조가 이미 짚지 않은 파일(CHANGELOG 제외). */
export function removalCandidates(sections, planText, known) {
  return sections.filter(
    (s) =>
      !isPlanFile(s.path) &&
      s.path !== 'CHANGELOG.md' &&
      !known.includes(s.path) &&
      mentionedInPlan(s.path, planText)
  );
}

/** 끼우기 후보: 다른 PR의 수정 파일 hunk 중 대상 diff에 없고 계획에도 이름이 안 나오는 src/ 파일. */
export function donorHunks(donors, targetSections, planText) {
  const targetPaths = new Set(targetSections.map((s) => s.path));
  const result = [];

  for (const donor of donors) {
    for (const section of donor.sections) {
      const isModified = !section.header.some((line) => /^(new|deleted) file mode/.test(line));

      if (
        !section.path.startsWith('src/') ||
        !isModified ||
        targetPaths.has(section.path) ||
        mentionedInPlan(section.path, planText)
      ) {
        continue;
      }

      for (const hunk of section.hunks) {
        if (hunk.length <= MAX_DONOR_HUNK_LINES) {
          result.push({ pr: donor.pr, path: section.path, header: section.header, hunk });
        }
      }
    }
  }

  return result;
}

/** 결함 두 개를 넣은 파일 구간 목록과 정답(뺀 파일, 끼운 파일)을 돌려준다. */
export function injectDefects({ sections, planText, known, donors, rng }) {
  const removable = removalCandidates(sections, planText, known);
  const insertable = donorHunks(donors, sections, planText);

  if (removable.length === 0 || insertable.length === 0) {
    throw new Error(
      `결함을 넣을 후보가 없다(빼기 ${removable.length}, 끼우기 ${insertable.length})`
    );
  }

  const removed = pick(rng, removable);
  const donor = pick(rng, insertable);
  const kept = sections.filter((s) => s !== removed);
  const insertAt = kept.findIndex((s) => s.path > donor.path);
  const inserted = { path: donor.path, header: donor.header, hunks: [donor.hunk] };

  kept.splice(insertAt === -1 ? kept.length : insertAt, 0, inserted);

  return { sections: kept, removed: removed.path, inserted: donor.path, donorPr: donor.pr };
}

function loadPr(pr) {
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const sha = git('log', 'origin/main', '--format=%H', '-E', `--grep=\\(#${pr}\\)$`).split('\n')[0];

  if (!sha) {
    throw new Error(`#${pr}의 squash 커밋을 origin/main에서 찾지 못했다`);
  }

  const all = splitDiff(git('show', '--format=', sha));
  const plans = all.filter((s) => isPlanFile(s.path));

  if (plans.length !== 1) {
    throw new Error(`#${pr}의 계획 파일이 ${plans.length}개다 — 하나인 PR만 사례로 쓴다`);
  }

  return {
    pr,
    planText: git('show', `${sha}:${plans[0].path}`),
    sections: all.filter((s) => !isPlanFile(s.path)),
  };
}

function parseArgs(argv) {
  const options = { out: null, seed: DEFAULT_SEED, prs: [] };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      options.out = path.resolve(argv[++i]);
    } else if (argv[i] === '--seed') {
      options.seed = Number(argv[++i]);
    } else {
      options.prs.push(Number(argv[i]));
    }
  }

  return options;
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isEntrypoint) {
  const { out, seed, prs } = parseArgs(process.argv.slice(2));

  if (!out || prs.length < 2 || prs.length % 2 !== 0) {
    throw new Error('사용법: --out <폴더> [--seed N] <PR 번호...> (PR은 짝수 개)');
  }

  const missing = prs.filter((pr) => !(pr in KNOWN_FINDINGS));

  if (missing.length > 0) {
    throw new Error(`KNOWN_FINDINGS에 없는 PR: ${missing.join(', ')}`);
  }

  const rng = createRng(seed);
  const loaded = prs.map(loadPr);
  const defectPrs = new Set(shuffle(rng, prs).slice(prs.length / 2));
  const cases = [];

  // 사례 번호도 섞어 번호만으로 정상·결함을 짐작하지 못하게 한다.
  for (const [index, item] of shuffle(rng, loaded).entries()) {
    const id = `case-${index + 1}`;
    const dir = path.join(out, id);
    const known = KNOWN_FINDINGS[item.pr];
    const role = defectPrs.has(item.pr) ? 'defect' : 'normal';
    const result =
      role === 'defect'
        ? injectDefects({
            sections: item.sections,
            planText: item.planText,
            known,
            donors: loaded.filter((other) => other.pr !== item.pr),
            rng,
          })
        : { sections: item.sections, removed: null, inserted: null, donorPr: null };

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plan.md'), `${item.planText}\n`);
    fs.writeFileSync(path.join(dir, 'diff.patch'), joinDiff(result.sections));
    cases.push({
      id,
      pr: item.pr,
      role,
      planPath: path.join(dir, 'plan.md'),
      diffPath: path.join(dir, 'diff.patch'),
      known,
      removed: result.removed ? [result.removed] : [],
      inserted: result.inserted ? [result.inserted] : [],
      donorPr: result.donorPr,
    });
  }

  console.log(JSON.stringify({ seed, cases }, null, 2));
}
