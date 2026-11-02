import { describe, expect, it } from 'vitest';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.contract';
import {
  createFolderBodyNameMax,
  updateFolderBodyNameMax,
} from '@/shared/api/generated/openapi.zod';

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수를 고칠 자리를 알린다
describe('폴더 이름 계약 상수 ≡ 스펙', () => {
  it.each([
    ['만들기', createFolderBodyNameMax],
    ['이름 바꾸기', updateFolderBodyNameMax],
  ])('%s 요청과 같은 상한이다', (_, max) => {
    expect(BOOKMARK_FOLDER_NAME_MAX_LENGTH).toBe(max);
  });
});
