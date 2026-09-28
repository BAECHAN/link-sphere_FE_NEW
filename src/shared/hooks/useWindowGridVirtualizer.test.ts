import { describe, expect, it } from 'vitest';
import { chunkIntoRows, resolveColumnCount } from '@/shared/hooks/useWindowGridVirtualizer';

describe('resolveColumnCount', () => {
  const minColumnWidth = 330;
  const gap = 16;
  const maxColumns = 3;

  it('정확히 3열이 들어맞는 폭이면 3을 반환한다', () => {
    const width = 3 * minColumnWidth + 2 * gap;
    expect(resolveColumnCount(width, minColumnWidth, gap, maxColumns)).toBe(3);
  });

  it('경계보다 1px 좁으면 2를 반환한다', () => {
    const width = 3 * minColumnWidth + 2 * gap - 1;
    expect(resolveColumnCount(width, minColumnWidth, gap, maxColumns)).toBe(2);
  });

  it('maxColumns를 넘는 폭이어도 maxColumns로 clamp한다', () => {
    expect(resolveColumnCount(10000, minColumnWidth, gap, maxColumns)).toBe(maxColumns);
  });

  it('minColumnWidth보다 좁으면 1을 반환한다', () => {
    expect(resolveColumnCount(minColumnWidth - 1, minColumnWidth, gap, maxColumns)).toBe(1);
  });

  it('폭이 0이어도 1을 반환한다(음수·NaN 열 수 방지)', () => {
    expect(resolveColumnCount(0, minColumnWidth, gap, maxColumns)).toBe(1);
  });
});

describe('chunkIntoRows', () => {
  it('열 수로 나누어떨어지면 행마다 열 수만큼 들어간다', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('나머지가 있으면 마지막 행은 열 수보다 적게 들어간다', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd', 'e'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(chunkIntoRows([], 3)).toEqual([]);
  });

  it('열 수가 1이면 아이템마다 한 행이 된다', () => {
    expect(chunkIntoRows(['a', 'b'], 1)).toEqual([['a'], ['b']]);
  });

  it('열 수가 0 이하이면 빈 배열을 반환한다(무한 루프 방지)', () => {
    expect(chunkIntoRows(['a', 'b'], 0)).toEqual([]);
  });
});
