import { describe, expect, it } from 'vitest';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.contract';
import { specNumber } from '@/test/openapi-spec';

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수를 고칠 자리를 알린다
describe('폴더 이름 계약 상수 ≡ 스펙', () => {
  it.each([
    ['만들기', 'createFolder'],
    ['이름 바꾸기', 'updateFolder'],
  ] as const)('%s 요청과 같은 상한이다', (_, operationId) => {
    expect(BOOKMARK_FOLDER_NAME_MAX_LENGTH).toBe(specNumber(operationId, 'name', 'maxLength'));
  });
});
