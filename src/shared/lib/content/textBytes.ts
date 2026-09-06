// 카운터가 키 입력마다 렌더에서 호출되므로 인코더는 모듈 스코프에서 한 번만 만든다.
const encoder = new TextEncoder();

export function getUtf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}
