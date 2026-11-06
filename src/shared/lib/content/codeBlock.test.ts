import { describe, it, expect } from 'vitest';
import { isClosedCodeBlock, splitCodeBlocks } from '@/shared/lib/content/codeBlock';

describe('splitCodeBlocks', () => {
  it('닫힌 코드 블록과 나머지 글자를 순서대로 나눈다', () => {
    expect(splitCodeBlocks('앞\n```\n코드\n```\n뒤')).toEqual(['앞\n', '```\n코드\n```', '\n뒤']);
  });
});

describe('isClosedCodeBlock', () => {
  it('앞뒤에 펜스가 있고 내용이 있으면 닫힌 코드 블록이다', () => {
    expect(isClosedCodeBlock('```코드```')).toBe(true);
  });

  it('내용 없이 백틱만 6개면 닫힌 코드 블록이 아니다', () => {
    expect(isClosedCodeBlock('``````')).toBe(false);
  });

  it('펜스가 한쪽에만 있으면 닫힌 코드 블록이 아니다', () => {
    expect(isClosedCodeBlock('긴 설명 문장 ```')).toBe(false);
    expect(isClosedCodeBlock('``` 긴 설명 문장')).toBe(false);
  });
});
