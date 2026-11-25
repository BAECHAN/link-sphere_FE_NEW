// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(lighthouse-report.js와 함께 고친다)
export function isLhrFile(fileName: string): boolean;
