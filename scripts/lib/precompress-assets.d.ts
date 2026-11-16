// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(precompress-assets.js와 함께 고친다)
export const BROTLI_SUFFIX: string;

export function isPrecompressTarget(key: string): boolean;

export function findMissingPairs(keys: Iterable<string>): string[];
