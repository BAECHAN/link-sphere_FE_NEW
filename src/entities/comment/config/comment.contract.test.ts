import { describe, expect, it } from 'vitest';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/comment.contract';
import { TEXTS } from '@/shared/config/texts';
import { specNumber } from '@/test/openapi-spec';

const COMMENT_WRITE_REQUESTS = [
  ['등록', 'createComment'],
  ['답글', 'createReply'],
  ['수정', 'updateComment'],
] as const;

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수와 안내 문구를 고칠 자리를 알린다
describe('댓글 계약 상수 ≡ 스펙', () => {
  it.each(COMMENT_WRITE_REQUESTS)('%s 요청과 같은 이미지 개수 상한이다', (_, operationId) => {
    expect(MAX_COMMENT_IMAGES).toBe(specNumber(operationId, 'images', 'maxItems'));
  });

  // 바이트 상한은 JSON Schema 키워드가 없어 BE가 x-max-bytes 확장으로 싣는다
  it.each(COMMENT_WRITE_REQUESTS)('%s 요청과 같은 본문 바이트 상한이다', (_, operationId) => {
    expect(MAX_COMMENT_CONTENT_BYTES).toBe(specNumber(operationId, 'content', 'x-max-bytes'));
  });

  it('안내 문구의 "한글 N자"가 바이트 상한과 같다(한글 1자 = UTF-8 3바이트)', () => {
    const hangulChars = (MAX_COMMENT_CONTENT_BYTES / 3).toLocaleString('en-US');

    expect(TEXTS.validation.commentContentTooLong).toContain(`한글 ${hangulChars}자`);
  });
});
