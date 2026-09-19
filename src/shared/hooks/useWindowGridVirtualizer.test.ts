import { describe, expect, it } from 'vitest';
import { chunkIntoRows } from '@/shared/hooks/useWindowGridVirtualizer';

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
