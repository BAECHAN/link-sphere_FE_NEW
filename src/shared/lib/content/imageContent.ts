const URL_TOKEN_PATTERN = /^https?:\/\/[^\s]+$/;
const IMAGE_EXT_PATTERN = /\.(jpeg|jpg|gif|png|webp|avif|heic|heif)(\?.*)?$/i;

/**
 * 댓글 content 문자열을 "순수 텍스트"와 "이미지 전용 줄(기존 첨부 이미지)"로 분리한다.
 * 백엔드가 이미지를 항상 "한 줄에 URL 하나씩"으로 이어붙이므로(CommentService.buildFinalContent),
 * 줄 단위로 판단하는 것이 정확히 그 역변환이 된다. 문장 중간에 섞인 이미지 링크는 텍스트로 남긴다.
 */
export function splitContentImages(content: string): { text: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  const textLines: string[] = [];

  content.split(/\r\n|\r|\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && URL_TOKEN_PATTERN.test(trimmed) && IMAGE_EXT_PATTERN.test(trimmed)) {
      imageUrls.push(trimmed);
    } else {
      textLines.push(line);
    }
  });

  return { text: textLines.join('\n').trimEnd(), imageUrls };
}
