import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  // 1. 커밋 로그 가져오기
  // BE 레포(history-dispatch.yml)가 repository_dispatch로 이미 계산해서 보낸 로그가 있으면
  // 그걸 그대로 쓴다 — BE 레포를 체크아웃할 필요가 없다.
  const precomputedLogs = process.env.PRECOMPUTED_LOGS;
  const sourceLabel = process.env.SOURCE_LABEL || 'FE';

  let logs = '';

  if (precomputedLogs) {
    logs = precomputedLogs.trim();
  } else {
    const beforeSha = process.env.BEFORE_SHA;
    const currentSha = process.env.CURRENT_SHA;

    let gitLogCommand = '';

    if (beforeSha && currentSha && beforeSha !== '0000000000000000000000000000000000000000') {
      // 1-1. 이번 Push에 새롭게 반영된 커밋들만 가져오기
      gitLogCommand = `git log ${beforeSha}..${currentSha} --pretty=format:"- %s"`;
    } else {
      // 1-2. fallback (태그 기반 방식)
      try {
        const currentTag = execSync('git describe --tags --abbrev=0', {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
        const headCommit = execSync('git rev-parse HEAD', {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
        const tagCommit = execSync(`git rev-list -n 1 ${currentTag}`, {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();

        if (headCommit === tagCommit) {
          // HEAD가 방금 만든 최신 태그라면, 이전 태그부터 이번 태그까지 커밋 가져오기
          try {
            const prevTag = execSync('git describe --tags --abbrev=0 HEAD^', {
              encoding: 'utf8',
              stdio: 'pipe',
            }).trim();
            gitLogCommand = `git log ${prevTag}..HEAD --pretty=format:"- %s"`;
          } catch {
            // 이전 태그가 없으면 전체 커밋 내역 중 일부
            gitLogCommand = `git log ${currentTag} --pretty=format:"- %s"`;
          }
        } else {
          gitLogCommand = `git log ${currentTag}..HEAD --pretty=format:"- %s"`;
        }
      } catch {
        // 태그가 없는 경우 방금 발생한 여러 최신 커밋(최대 5개)을 임시로 참조
        gitLogCommand = `git log -5 --pretty=format:"- %s"`;
      }
    }

    try {
      logs = execSync(gitLogCommand, { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch (error) {
      console.error('Git log 가져오기 실패:', error.message);
      return console.log('새로운 커밋이 없습니다.');
    }
  }

  if (!logs) return console.log('새로운 커밋이 없습니다.');

  // 2. Gemini에게 요약 요청
  // 릴리스 노트 요약은 품질 요구가 낮으므로, 일일 한도가 넉넉한 Flash Lite를 쓴다.
  // (서비스용 요약·분류가 쓰는 gemini-2.5-flash의 무료 등급 20 RPD를 나눠 쓰지 않기 위함)
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
  const prompt = `
    다음은 GitHub 커밋 로그들이다(출처: ${sourceLabel} 레포).
    기술적인 성과 위주로 HISTORY.md에 들어갈 릴리스 노트를 작성해줘.
    다른 설명이나 인사말 없이 아래 형식으로만 응답해줘(형식 밖의 문장을 절대 추가하지 말 것):
    ### ${new Date().toISOString().split('T')[0]} (${sourceLabel})
    - 요약내용
    로그:
    ${logs}
  `;

  // 쿼터 소진(429)·과부하(503)로 실패해도 배포와 무관한 부가 작업이므로 갱신만 건너뛴다
  let aiResponse;
  try {
    const result = await model.generateContent(prompt);
    aiResponse = result.response.text();
  } catch (error) {
    console.error('Gemini 요약 실패, HISTORY.md 갱신을 건너뜁니다:', error.message);
    return;
  }

  // Gemini가 프롬프트 지시를 무시하고 서두("제공해주신 커밋 로그를 바탕으로...")를 붙이는 경우가
  // 있어, 프롬프트만으로는 막히지 않는다. 첫 "### " 헤더 이전의 텍스트를 잘라내 후처리로 방어한다.
  const headerIndex = aiResponse.indexOf('### ');
  if (headerIndex > 0) {
    aiResponse = aiResponse.slice(headerIndex);
  }
  aiResponse = aiResponse.trim();

  // 3. docs/HISTORY.md 파일 상단에 추가
  const currentHistory = fs.readFileSync('docs/HISTORY.md', 'utf8');
  fs.writeFileSync('docs/HISTORY.md', `${aiResponse}\n\n${currentHistory}`);
}

main();
