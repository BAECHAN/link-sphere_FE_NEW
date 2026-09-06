export const MAX_COMMENT_IMAGES = 5;

/**
 * 댓글 본문 상한(UTF-8 바이트). 한글 1자 = 3바이트이므로 한글 기준 약 2,000자.
 * CloudFront WAF(AWSManagedRulesCommonRuleSet의 SizeRestrictions_BODY, 기본값 그대로 유지 -
 * 커스텀 크기 룰은 CloudFront Pro 플랜 전용이라 이 계정에서 못 만든다)가 요청 바디
 * 8,192바이트 초과를 403(HTML)으로 반환해 앱 에러 처리를 못 타므로, 그 앞에서 막는 것이
 * 목적이다. 6,000바이트는 이미지 URL 5개(~650B)·JSON 봉투를 더해도 8,192B 벽에 여유 있게
 * 들어가도록 잡은 값이다. 상수를 바꾸면 안내 문구(`TEXTS.validation.commentContentTooLong`)의
 * "한글 2,000자" 표기도 함께 고쳐야 한다. BE `CommentService.MAX_COMMENT_CONTENT_BYTES`와 같은 값.
 */
export const MAX_COMMENT_CONTENT_BYTES = 6_000;
