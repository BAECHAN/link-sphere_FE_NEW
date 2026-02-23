import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 1. 가져올 커밋 범위 설정 (pre-push 훅에서 전달받음)
  const remoteSha = process.env.REMOTE_SHA;
  const localSha = process.env.LOCAL_SHA;

  let gitLogCommand = '';

  if (remoteSha && localSha && remoteSha !== '0000000000000000000000000000000000000000') {
    // 1-1. 원격 대비 새로 추가된 커밋 로그 가져오기 (이전 히스토리 자동 생성 커밋 제외)
    gitLogCommand = `git log ${remoteSha}..${localSha} --pretty=format:"- %s" --grep="^docs: auto-update" --invert-grep`;
  } else {
    // 1-2. 처음 푸시하거나 정보를 알 수 없는 경우: 가장 최근 5개 커밋
    gitLogCommand = `git log -5 --pretty=format:"- %s" --grep="^docs: auto-update" --invert-grep`;
  }

  let logs = '';
  try {
    logs = execSync(gitLogCommand, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    console.error('Git log 가져오기 실패:', error.message);
    return;
  }

  if (!logs) {
    console.log('HISTORY.md를 업데이트할 새로운 커밋이 없습니다.');
    return;
  }

  console.log('새로운 커밋 요약을 요청합니다...');

  // 2. Gemini에게 요약 요청
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `
    다음은 GitHub 커밋 로그들이다. 이를 바탕으로 채용 담당자가 보기 좋게
    기술적인 성과 위주로 HISTORY.md에 들어갈 릴리스 노트를 작성해줘.
    형식: ### [YYYY-MM-DD]\n - 요약내용
    로그:
    ${logs}
  `;

  try {
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // 3. docs/HISTORY.md 파일 상단에 추가
    const historyPath = 'docs/HISTORY.md';
    const currentHistory = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '';
    fs.writeFileSync(historyPath, `${aiResponse}\n\n${currentHistory}`);

    console.log('HISTORY.md 갱신이 완료되었습니다.');
  } catch (error) {
    console.error('Gemini API 요청 실패:', error.message);
    process.exit(1);
  }
}

main();
