import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/comment.contract';
import {
  createCommentBodyImagesMax,
  createReplyBodyImagesMax,
  updateCommentBodyImagesMax,
} from '@/shared/api/generated/openapi.zod';
import { TEXTS } from '@/shared/config/texts';

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수와 안내 문구를 고칠 자리를 알린다
describe('댓글 계약 상수 ≡ 스펙', () => {
  it.each([
    ['등록', createCommentBodyImagesMax],
    ['답글', createReplyBodyImagesMax],
    ['수정', updateCommentBodyImagesMax],
  ])('%s 요청과 같은 이미지 개수 상한이다', (_, max) => {
    expect(MAX_COMMENT_IMAGES).toBe(max);
  });

  // 바이트 상한은 JSON Schema 키워드가 없어 BE가 x-max-bytes 확장으로 싣고, orval은 확장을 읽지 않는다 - 스펙을 직접 읽는다
  it('본문 바이트 상한이 스펙의 x-max-bytes와 같다', () => {
    const spec = JSON.parse(
      readFileSync(join(process.cwd(), 'src/shared/api/generated/openapi.json'), 'utf-8')
    ) as {
      components: {
        schemas: { CreateCommentRequest: { properties: { content: Record<string, unknown> } } };
      };
    };

    expect(spec.components.schemas.CreateCommentRequest.properties.content['x-max-bytes']).toBe(
      MAX_COMMENT_CONTENT_BYTES
    );
  });

  it('안내 문구의 "한글 N자"가 바이트 상한과 같다(한글 1자 = UTF-8 3바이트)', () => {
    const hangulChars = (MAX_COMMENT_CONTENT_BYTES / 3).toLocaleString('en-US');

    expect(TEXTS.validation.commentContentTooLong).toContain(`한글 ${hangulChars}자`);
  });
});
