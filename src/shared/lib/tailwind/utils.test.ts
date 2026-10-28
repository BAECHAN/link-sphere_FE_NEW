import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn } from '@/shared/lib/tailwind/utils';

// globals.css @theme의 글자 크기 토큰(--text-t1, --text-micro 등). --text-*--line-height 같은 하위 변수는 뺀다.
// vitest는 레포(워크트리) 루트를 process.cwd()로 실행한다(storage-keys.test.ts와 같은 방식)
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8');
const textSizeTokens = [...globalsCss.matchAll(/--text-([a-z0-9]+(?:-[a-z0-9]+)*):/g)].map(
  (match) => match[1]
);

describe('cn()의 글자 크기 토큰 병합', () => {
  it('globals.css에서 글자 크기 토큰을 읽어 온다', () => {
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
