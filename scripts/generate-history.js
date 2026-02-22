import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  // 1. 최근 커밋 로그 가져오기 (마지막 태그 이후의 커밋들)
  const logs = execSync(
    'git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"- %s"'
  ).toString();

  if (!logs) return console.log('새로운 커밋이 없습니다.');

  // 2. Gemini에게 요약 요청
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `
    다음은 GitHub 커밋 로그들이다. 이를 바탕으로 채용 담당자가 보기 좋게
    기술적인 성과 위주로 HISTORY.md에 들어갈 릴리스 노트를 작성해줘.
    형식: ### [날짜] v버전명 \n - 요약내용
    로그:
    ${logs}
  `;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();

  // 3. docs/HISTORY.md 파일 상단에 추가
  const currentHistory = fs.readFileSync('docs/HISTORY.md', 'utf8');
  fs.writeFileSync('docs/HISTORY.md', `${aiResponse}\n\n${currentHistory}`);
}

main();
