export const MAX_COMMENT_IMAGES = 5;

/**
 * 댓글 본문 상한(UTF-8 바이트). 한글 1자 = 3바이트이므로 한글 기준 약 4,000자.
 * CloudFront WAF가 요청 바디 크기(16KB)로 403(HTML)을 반환해 앱 에러 처리를 못 타므로,
 * 그 앞에서 막는 것이 목적이다. 상수를 바꾸면 안내 문구(`TEXTS.validation.commentContentTooLong`)의
 * "한글 4,000자" 표기도 함께 고쳐야 한다. BE `CommentService.MAX_COMMENT_CONTENT_BYTES`와 같은 값.
 */
export const MAX_COMMENT_CONTENT_BYTES = 12_000;
