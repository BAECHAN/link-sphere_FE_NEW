import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { ESTIMATED_IMAGE_URL_BYTES } from '@/entities/comment/config/const';

/**
 * 댓글 등록/수정 요청이 실제로 전송할 JSON 바디와 같은 모양을 만들어 그 UTF-8 바이트를
 * 잰다. content만 보는 MAX_COMMENT_CONTENT_BYTES 체크와 달리, 줄바꿈 등 JSON 이스케이프
 * 오버헤드와 이미지 URL 기여분까지 포함한 실제 전송량에 가깝다 - 이걸 손으로 계산(개행 개수
 * 세기, 배열 문법 바이트 계산)하는 대신 진짜 JSON.stringify 결과를 재는 쪽이 정확하고 유지보수하기 쉽다.
 *
 * pendingImageCount(File[], 아직 업로드 전)는 실제 URL을 알 수 없으므로
 * ESTIMATED_IMAGE_URL_BYTES 길이의 자리표시자 문자열로 대신한다.
 */
export function estimateCommentPayloadBytes(
  content: string,
  existingImageUrls: string[],
  pendingImageCount: number
): number {
  const placeholders = Array.from({ length: pendingImageCount }, () =>
    'x'.repeat(ESTIMATED_IMAGE_URL_BYTES)
  );
  const images = [...existingImageUrls, ...placeholders];
  return getUtf8ByteLength(JSON.stringify({ content, images }));
}
