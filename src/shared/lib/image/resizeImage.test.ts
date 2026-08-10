import { describe, expect, it } from 'vitest';
import { resizeImageFile, normalizeSvgDimensions } from '@/shared/lib/image/resizeImage';
import { TEXTS } from '@/shared/config/texts';

/** File.size는 읽기 전용이라 실제 큰 버퍼를 만들지 않고 원하는 크기로 흉내낸다 */
function fakeFile(name: string, type: string, sizeInBytes: number): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'size', { value: sizeInBytes });
  return file;
}

/** normalizeSvgDimensions는 file.text()로 실제 내용을 읽으므로 진짜 SVG 텍스트가 필요하다 */
function svgFile(name: string, svgText: string): File {
  return new File([svgText], name, { type: 'image/svg+xml' });
}

const MB = 1024 * 1024;

describe('resizeImageFile - 크기 상한', () => {
  it('원본이 30MB를 넘으면 포맷과 무관하게 즉시 에러를 던진다', async () => {
    const file = fakeFile('photo.jpg', 'image/jpeg', 31 * MB);

    await expect(resizeImageFile(file, 512)).rejects.toThrow(TEXTS.validation.imageTooLarge(30));
  });

  it('GIF가 15MB를 넘으면(30MB 미만이어도) 기본(댓글 이미지) 동작에서는 더 낮은 상한에 걸려 에러를 던진다', async () => {
    const file = fakeFile('avatar.gif', 'image/gif', 20 * MB);

    // options 없음 = skipGifResize 기본값 true (댓글 이미지 등 애니메이션을 지켜야 하는 호출부)
    await expect(resizeImageFile(file, 512)).rejects.toThrow(TEXTS.validation.imageTooLarge(15));
  });

  it('GIF가 15MB 이하면(기본 동작) 리사이즈 없이 원본 그대로 반환한다', async () => {
    const file = fakeFile('avatar.gif', 'image/gif', 10 * MB);

    const result = await resizeImageFile(file, 512);

    expect(result).toBe(file);
  });

  it('skipGifResize: false(아바타 등)면 GIF는 15MB 상한 없이 일반 리사이즈 경로를 탄다', async () => {
    // 아바타는 항상 작게 고정 크기로 표시되므로 애니메이션을 지킬 필요가 없다 - GIF도 jpg/png와
    // 동일하게 30MB 원본 상한만 적용받는다. 테스트 환경(jsdom)엔 createImageBitmap이 없어
    // 리사이즈 자체는 시도되지 않고 원본이 그대로 반환되는 기존 폴백 경로를 탄다.
    const file = fakeFile('avatar.gif', 'image/gif', 20 * MB);

    const result = await resizeImageFile(file, 512, { skipGifResize: false });

    expect(result).toBe(file);
  });

  it('SVG는 skipGifResize 옵션과 무관하게 항상 15MB 상한을 적용받는다', async () => {
    const file = fakeFile('avatar.svg', 'image/svg+xml', 20 * MB);

    await expect(resizeImageFile(file, 512)).rejects.toThrow(TEXTS.validation.imageTooLarge(15));
    await expect(resizeImageFile(file, 512, { skipGifResize: false })).rejects.toThrow(
      TEXTS.validation.imageTooLarge(15)
    );
  });
});

describe('normalizeSvgDimensions', () => {
  it('width가 퍼센트고 height가 없어도 viewBox가 있으면 절대 width/height를 주입한다', async () => {
    // mermaid.js가 내보내는 SVG의 전형적인 형태 - <img>로 불러오면 퍼센트 width가 참조할
    // 기준이 없어 intrinsic 크기를 못 구해 렌더링되지 않는 문제의 재현 케이스.
    const file = svgFile(
      'diagram.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 300 150"><rect/></svg>'
    );

    const result = await normalizeSvgDimensions(file);

    expect(result).not.toBe(file);
    const text = await result.text();
    expect(text).toContain('width="300"');
    expect(text).toContain('height="150"');
  });

  it('이미 명시적 width/height가 있으면 손대지 않고 원본을 그대로 반환한다', async () => {
    const file = svgFile(
      'icon.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect/></svg>'
    );

    const result = await normalizeSvgDimensions(file);

    expect(result).toBe(file);
  });

  it('viewBox도 없으면 계산할 방법이 없어 원본을 그대로 반환한다', async () => {
    const file = svgFile(
      'no-viewbox.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%"><rect/></svg>'
    );

    const result = await normalizeSvgDimensions(file);

    expect(result).toBe(file);
  });

  it('파싱 자체가 실패해도 예외 없이 원본을 그대로 반환한다', async () => {
    const file = svgFile('broken.svg', '<svg><rect width="100%"</svg>');

    const result = await normalizeSvgDimensions(file);

    expect(result).toBe(file);
  });

  it('SVG가 아닌 파일은 그대로 반환한다', async () => {
    const file = new File([], 'photo.png', { type: 'image/png' });

    const result = await normalizeSvgDimensions(file);

    expect(result).toBe(file);
  });
});
