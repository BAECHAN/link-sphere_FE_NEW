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

// 위와 같은 이유로 cn()이 읽는 목록(DURATION_TOKEN_NAMES 등)이 아니라 전체 목록에서 고른다
const durationTokens = TOKENS.filter((token) => token.group === 'duration').map(
  (token) => token.name
);
const easeTokens = TOKENS.filter((token) => token.group === 'timing-function').map(
  (token) => token.name
);

describe('cn()의 시간·곡선 토큰 병합', () => {
  it('토큰 목록에서 시간·곡선 토큰을 읽어 온다', () => {
    expect(durationTokens).toContain('d4');
    expect(easeTokens).toContain('easing');
  });

  // 토큰을 추가하고 utils.ts 등록을 빠뜨리면 여기서 실패한다. 앞에 두는 것은 다른 토큰이다 - Tailwind 기본 이름을 적으면
  // Tailwind가 이 파일에서 그 이름을 찾아 쓰지 않는 규칙을 CSS에 만든다
  const another = (names: string[], token: string) => names.find((name) => name !== token);

  it.each(durationTokens)('duration-%s가 앞의 시간 클래스를 지운다', (token) => {
    expect(cn(`duration-${another(durationTokens, token)}`, `duration-${token}`)).toBe(
      `duration-${token}`
    );
  });

  it.each(easeTokens)('ease-%s가 앞의 곡선 클래스를 지운다', (token) => {
    expect(cn(`ease-${another(easeTokens, token)}`, `ease-${token}`)).toBe(`ease-${token}`);
  });

  it('쓰는 쪽이 넘긴 시간·곡선이 부품의 것을 덮는다', () => {
    expect(cn('transition-all duration-d4 ease-easing', 'duration-d6 ease-sheet')).toBe(
      'transition-all duration-d6 ease-sheet'
    );
  });

  it('시간과 곡선은 서로 지우지 않는다', () => {
    expect(cn('duration-d4', 'ease-enter')).toBe('duration-d4 ease-enter');
  });
});

// 위와 같은 이유로 cn()이 읽는 목록(SHADOW_TOKEN_NAMES)이 아니라 전체 목록에서 고른다
const shadowTokens = TOKENS.filter((token) => token.group === 'shadow').map((token) => token.name);

describe('cn()의 그림자 토큰 병합', () => {
  it('토큰 목록에서 그림자 토큰을 읽어 온다', () => {
    expect(shadowTokens).toEqual(['s1', 's2', 's3', 's4']);
  });

  // 등록을 빠뜨리면 tailwind-merge 3.7.0은 shadow-s1 등을 그림자 색으로 분류해, 그림자를 없애는 shadow-none과 둘 다 남긴다
  // (이미지 보기가 대화상자의 그림자를 shadow-none으로 없앤다. ImageViewer.tsx)
  it.each(shadowTokens)('shadow-%s와 shadow-none은 뒤에 온 쪽만 남는다', (token) => {
    expect(cn(`shadow-${token}`, 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-none', `shadow-${token}`)).toBe(`shadow-${token}`);
  });
});

// 위와 같은 이유로 cn()이 읽는 목록(SPACING_TOKEN_NAMES)이 아니라 전체 목록에서 고른다
const spacingTokens = TOKENS.filter((token) => token.group === 'spacing').map(
  (token) => token.name
);
// 숫자 간격 클래스는 조각을 이어 만든다. 글자 그대로 적으면 예제 앱의 Tailwind가 이 파일에서 찾아 쓰지 않는 규칙을 만든다
const numericGap = (step: number) => ['gap', step].join('-');

describe('cn()의 역할 간격 토큰 병합', () => {
  it('토큰 목록에서 역할 간격 토큰을 읽어 온다', () => {
    expect(spacingTokens).toEqual(['between-chips']);
  });

  // 등록을 빠뜨리면 tailwind-merge 3.7.0은 간격을 px과 숫자로만 알아 gap-<이름>을 간격으로 보지 않고, 앞의 숫자 간격과 둘 다 남긴다
  it.each(spacingTokens)('gap-%s와 숫자 간격은 뒤에 온 쪽만 남는다', (token) => {
    expect(cn(numericGap(2), `gap-${token}`)).toBe(`gap-${token}`);
    expect(cn(`gap-${token}`, numericGap(3))).toBe(numericGap(3));
  });
});
