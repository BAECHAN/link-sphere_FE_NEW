// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(pr-body.js와 함께 고친다)
export const REQUIRED_SECTIONS: { names: string[]; hint: string }[];
export function findPrBodyProblems(body: string | null | undefined, template: string): string[];
