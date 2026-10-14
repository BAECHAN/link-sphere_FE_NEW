// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(prune-assets.js와 함께 고친다)
import type { ConfigType } from 'dayjs';

export const RETENTION_DAYS: number;
export const PRUNE_PREFIXES: string[];
export function selectPrunableKeys(
  objects: { Key: string; LastModified: string }[],
  currentKeys: Set<string>,
  now: ConfigType
): string[];
