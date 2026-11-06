import { describe, it, expect } from 'vitest';
import { splitContentImages } from '@/shared/lib/content/imageContent';

const IMAGE_A = 'https://example.com/a.png';
const IMAGE_B = 'https://example.com/b.webp';

describe('splitContentImages', () => {
  it('BE가 본문 끝에 이어 붙인 이미지 줄을 텍스트와 나눈다', () => {
    expect(splitContentImages(`좋은 글이네요\n\n${IMAGE_A}\n${IMAGE_B}`)).toEqual({
      text: '좋은 글이네요',
      imageUrls: [IMAGE_A, IMAGE_B],
    });
  });

  it('문장 중간에 섞인 이미지 링크는 텍스트로 남긴다', () => {
    const content = `이 그림 ${IMAGE_A} 을 보세요`;

    expect(splitContentImages(content)).toEqual({ text: content, imageUrls: [] });
  });

  it('이미지 확장자로 끝나도 주소가 아닌 줄과, 이미지가 아닌 주소 줄은 텍스트로 남긴다', () => {
    const content = 'photo.png\nhttps://example.com/page';

    expect(splitContentImages(content)).toEqual({ text: content, imageUrls: [] });
  });

  it('앞뒤에 공백이 있는 이미지 줄도 꺼낸다', () => {
    expect(splitContentImages(`글\n  ${IMAGE_A}  `)).toEqual({
      text: '글',
      imageUrls: [IMAGE_A],
    });
  });

  it('줄바꿈을 LF로 맞춘다', () => {
    expect(splitContentImages(`첫 줄\r\n둘째 줄\r\n${IMAGE_A}`)).toEqual({
      text: '첫 줄\n둘째 줄',
      imageUrls: [IMAGE_A],
    });
  });

  it('닫힌 코드 블록 안 이미지 주소는 글자로 남고 첨부로 세지 않는다', () => {
    const content = `설명\n\`\`\`\n${IMAGE_A}\n\`\`\`\n끝`;

    expect(splitContentImages(content)).toEqual({ text: content, imageUrls: [] });
  });

  it('코드 블록 뒤에 이어 붙인 첨부 이미지만 꺼낸다', () => {
    const text = `\`\`\`\n${IMAGE_A}\n\`\`\``;

    expect(splitContentImages(`${text}\n\n${IMAGE_B}`)).toEqual({
      text,
      imageUrls: [IMAGE_B],
    });
  });

  it('코드 블록 둘 사이의 이미지 줄은 꺼내고 앞뒤 코드 블록은 그대로 둔다', () => {
    expect(splitContentImages(`\`\`\`a\`\`\`\n${IMAGE_A}\n\`\`\`b\`\`\``)).toEqual({
      text: '```a```\n```b```',
      imageUrls: [IMAGE_A],
    });
  });

  it('닫힌 코드 블록 안의 줄바꿈도 LF로 맞춘다', () => {
    expect(splitContentImages(`\`\`\`\r\n${IMAGE_A}\r\n\`\`\``)).toEqual({
      text: `\`\`\`\n${IMAGE_A}\n\`\`\``,
      imageUrls: [],
    });
  });

  it('닫히지 않은 코드 블록의 이미지 줄은 화면에 이미지로 그려지므로 첨부로 꺼낸다', () => {
    expect(splitContentImages(`\`\`\`\n${IMAGE_A}`)).toEqual({
      text: '```',
      imageUrls: [IMAGE_A],
    });
  });
});
