import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

// index.html의 테마 FOUC 방지 인라인 스크립트는 빌드 타임에 STORAGE_KEYS.THEME을 import할 수
// 없어 문자열을 직접 하드코딩한다. 이 테스트가 그 SSOT 균열을 방어한다 - 키가 바뀌면
// index.html이 조용히 낡는 대신 여기서 실패한다.
// vitest는 루트(레포/워크트리 루트)를 process.cwd()로 실행하므로 그 기준으로 경로를 잡는다.
const indexHtmlPath = join(process.cwd(), 'index.html');

describe('STORAGE_KEYS.THEME과 index.html 인라인 스크립트 동기화', () => {
  it('index.html이 STORAGE_KEYS.THEME과 동일한 키 문자열을 참조한다', () => {
    const indexHtml = readFileSync(indexHtmlPath, 'utf-8');

    expect(indexHtml).toContain(`'${STORAGE_KEYS.THEME}'`);
  });
});
