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

/**
 * 댓글 요청의 실제 전송 바이트(JSON.stringify({content, images}), UTF-8) 상한.
 * MAX_COMMENT_CONTENT_BYTES는 content 원본 글자수만 재기 때문에, 줄바꿈이 많은 글(JSON
 * 이스케이프로 \n이 2바이트가 됨)이나 이미지를 여러 장 붙인 경우엔 원본 바이트로는
 * 상한 밑인데도 실제 전송량은 WAF의 8,192바이트 벽을 넘을 수 있다(2026-09-06 실사용자
 * 재현: 짧은 줄이 매우 많은 글). 7,500은 그 벽 대비 약 700바이트 여유를 둔 값 -
 * `estimateCommentPayloadBytes`로 실제 전송될 JSON과 같은 모양을 만들어 재므로
 * 이스케이프·배열 문법 오버헤드까지 정확히 반영된다.
 */
export const MAX_COMMENT_PAYLOAD_BYTES = 7_500;

/**
 * 아직 업로드 전(File)이라 실제 URL을 모르는 이미지 1장의 전송 바이트 추정치.
 * 실제 URL 형식은 `<supabaseUrl>/storage/v1/object/public/comments/<uuid>.<ext>` -
 * 실측 150~160바이트대라 여유를 두고 200으로 잡는다.
 */
export const ESTIMATED_IMAGE_URL_BYTES = 200;
