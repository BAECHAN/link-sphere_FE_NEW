import { describe, expect, it } from 'vitest';
import { cn } from '@baechan/ui/lib/tailwind/utils';
import { TOKENS } from '@baechan/ui/tokens';

// 글자 크기를 정하는 토큰의 이름: 눈금(text-t1 등)과 역할 토큰의 글자 크기 부분(text-micro 등). 줄 높이·두께 같은 하위 값은
// 뺀다. 토큰 원본에서 만든 전체 목록(src/generated/tokens.gen.ts)에서 직접 고른다 - cn()이 읽는 이름 목록
// (TEXT_SIZE_TOKEN_NAMES)을 그대로 쓰면 그 목록이 토큰을 빠뜨려도 여기서 걸리지 않는다
const textSizeTokens = TOKENS.filter(
  (token) => token.group === 'font-size' || (token.group === 'text' && token.part === 'font-size')
).map((token) => token.name);

describe('cn()의 글자 크기 토큰 병합', () => {
  it('토큰 목록에서 글자 크기 토큰을 읽어 온다', () => {
    expect(textSizeTokens).toContain('t1');
    expect(textSizeTokens).toContain('micro');
    expect(textSizeTokens).not.toContain('micro--line-height');
  });

  // 토큰을 추가하고 utils.ts 등록을 빠뜨리면 여기서 실패한다
  it.each(textSizeTokens)('text-%s를 글자 크기로 보고 앞의 기본 크기를 지운다', (token) => {
    expect(cn('text-sm', `text-${token}`)).toBe(`text-${token}`);
  });

  it('토큰 뒤에 오는 색 클래스가 토큰을 지우지 않는다', () => {
    expect(cn('text-micro md:text-sm', 'text-destructive')).toBe(
      'text-micro md:text-sm text-destructive'
    );
  });

  it('토큰이 앞의 색 클래스를 지우지 않는다', () => {
    expect(cn('text-muted-foreground', 'text-screen-title')).toBe(
      'text-muted-foreground text-screen-title'
    );
  });

  it('같은 변형(md:) 안에서만 크기를 바꾼다', () => {
    expect(cn('text-base md:text-sm', 'md:text-screen-title')).toBe(
      'text-base md:text-screen-title'
    );
  });
});
