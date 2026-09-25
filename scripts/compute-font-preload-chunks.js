// index.html에 preload할 Pretendard dynamic-subset 조각(unicode-range 92개 중 일부)을
// 계산한다. /post 피드는 여러 게시글의 제목·설명·태그가 섞여 있어 한 화면에 필요한 조각
// 수가 많은데(실측 2026-09-26: 20개), 브라우저가 CSS 파싱 후에야 뒤늦게 발견해 두 웨이브로
// 나눠 요청하는 바람에 모바일 LCP가 오히려 나빠졌다(9.4s→11.0s). 자주 쓰이는 조각을 미리
// preload로 선언해 한 번에 병렬로 받게 한다.
//
// 최근 N개 게시글만 본다 — 게시글이 계속 늘어도 계산 비용이 고정되게 캡을 둔다(지금은
// 전체 게시글이 이보다 적어 사실상 전체를 보는 것과 같지만, 캡 자체가 향후 대비다).
//
// 자동으로 index.html을 고치지 않는다 — 결과를 콘솔에 출력만 하고, 사람이 확인 후
// 직접 붙여넣는다(사용자 결정: 매번 자동 실행되는 파이프라인은 지금 원치 않음,
// docs/PERFORMANCE.md "폰트 preload 유지보수" 절 참고).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'public/fonts/web/variable/pretendard-dynamic-subset.css');
const RECENT_POST_LIMIT = 300;
const PAGE_SIZE = 50;

dotenv.config({ path: path.join(ROOT, '.env') });

function parseChunkRanges(cssText) {
  const unicodeRangeLines = [...cssText.matchAll(/unicode-range:\s*([^;]+);/g)];

  return unicodeRangeLines.map(([, rangeText], index) => {
    const ranges = rangeText.split(',').map((part) => {
      const trimmed = part.trim();
      const [fromHex, toHex] = trimmed.slice(2).split('-');

      return {
        from: parseInt(fromHex, 16),
        to: toHex ? parseInt(toHex, 16) : parseInt(fromHex, 16),
      };
    });

    return { index, ranges };
  });
}

function findChunkIndex(chunks, codePoint) {
  for (const chunk of chunks) {
    for (const range of chunk.ranges) {
      if (codePoint >= range.from && codePoint <= range.to) {
        return chunk.index;
      }
    }
  }

  return null;
}

async function fetchRecentPostTexts(baseUrl) {
  const texts = [];

  for (let page = 0; texts.length < RECENT_POST_LIMIT; page++) {
    const url = `${baseUrl.replace(/\/$/, '')}/post?page=${page}&size=${PAGE_SIZE}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`게시글 조회 실패: HTTP ${response.status} ${url}`);
    }

    const body = await response.json();
    const content = body.data.content;

    if (content.length === 0) {
      break;
    }

    for (const post of content) {
      texts.push(post.title ?? '');
      texts.push(post.description ?? '');
      texts.push(...(post.tags ?? []));
    }
  }

  return texts.join('');
}

async function main() {
  const baseUrl = process.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('.env 에 VITE_API_BASE_URL 이 없습니다.');
  }

  console.log(`[compute-font-preload-chunks] 최근 ${RECENT_POST_LIMIT}개 게시글 조회 중...`);

  const text = await fetchRecentPostTexts(baseUrl);
  const cssText = fs.readFileSync(CSS_PATH, 'utf8');
  const chunks = parseChunkRanges(cssText);

  console.log(
    `[compute-font-preload-chunks] 조각 ${chunks.length}개, 게시글 텍스트 ${text.length}자`
  );

  const neededIndices = new Set();

  for (const char of new Set(text)) {
    if (/\s/.test(char)) {
      continue;
    }

    const index = findChunkIndex(chunks, char.codePointAt(0));

    if (index !== null) {
      neededIndices.add(index);
    }
  }

  const sorted = [...neededIndices].sort((a, b) => a - b);

  console.log(
    `\n[compute-font-preload-chunks] 필요한 조각: ${sorted.length}개 / 전체 ${chunks.length}개\n`
  );
  console.log('index.html에 붙여넣을 <link> 태그:\n');

  for (const index of sorted) {
    console.log(
      `    <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/web/variable/woff2-dynamic-subset/PretendardVariable.subset.${index}.woff2" />`
    );
  }
}

main().catch((error) => {
  console.error(`[compute-font-preload-chunks] 실패: ${error.message}`);
  process.exit(1);
});
