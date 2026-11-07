// BE 요청 본문과 같아야 하는 댓글 이미지 개수 상한(BE CommentLimits.MAX_IMAGES). 값은 손으로 두고
// comment.contract.test.ts가 스펙(openapi.json)의 값과 대조한다 - 런타임은 스펙을 싣지 않고
// 이 상수만 쓴다(docs/OPENAPI-CODEGEN.md §5-6).
// 본문 바이트 상한(MAX_COMMENT_CONTENT_BYTES)도 BE 값이지만 같은 WAF 대응 상수들과 함께 comment.const.ts에 두고, 대조는
// 같은 테스트가 한다.
export const MAX_COMMENT_IMAGES = 5;
