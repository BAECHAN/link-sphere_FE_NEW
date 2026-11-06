// 닫힌 코드 블럭(``` ... ```)과 나머지 텍스트를 분리
export function splitCodeBlocks(text: string): string[] {
  return text.split(/(```[\s\S]*?```)/g);
}

export function isClosedCodeBlock(segment: string): boolean {
  return segment.startsWith('```') && segment.endsWith('```') && segment.length > 6;
}
