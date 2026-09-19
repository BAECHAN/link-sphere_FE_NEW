import { beforeEach, describe, expect, it } from 'vitest';
import { loadVirtualSnapshot, saveVirtualSnapshot } from '@/shared/lib/virtual/virtual-snapshot';

const sampleItems = [{ key: 'post-1', index: 0, start: 0, end: 654, size: 654, lane: 0 }];

beforeEach(() => {
  sessionStorage.clear();
});

describe('saveVirtualSnapshot / loadVirtualSnapshot', () => {
  it('저장한 스냅샷을 같은 listId·locationKey·columnCount·count로 그대로 읽는다', () => {
    saveVirtualSnapshot('post-feed', 'abc123', {
      offset: 1200,
      columnCount: 3,
      count: 195,
      items: sampleItems,
    });

    const loaded = loadVirtualSnapshot('post-feed', 'abc123', 3, 195);

    expect(loaded).toEqual({
      offset: 1200,
      columnCount: 3,
      count: 195,
      items: sampleItems,
    });
  });

  it('저장한 적 없는 locationKey는 null을 반환한다', () => {
    expect(loadVirtualSnapshot('post-feed', 'never-saved', 3, 195)).toBeNull();
  });

  it('columnCount가 저장 시점과 다르면 null을 반환한다(브레이크포인트 변경)', () => {
    saveVirtualSnapshot('post-feed', 'abc123', {
      offset: 1200,
      columnCount: 3,
      count: 195,
      items: sampleItems,
    });

    expect(loadVirtualSnapshot('post-feed', 'abc123', 2, 195)).toBeNull();
  });

  it('count가 저장 시점과 다르면 null을 반환한다(글 등록·삭제로 목록 리셋)', () => {
    saveVirtualSnapshot('post-feed', 'abc123', {
      offset: 1200,
      columnCount: 3,
      count: 195,
      items: sampleItems,
    });

    expect(loadVirtualSnapshot('post-feed', 'abc123', 3, 10)).toBeNull();
  });

  it('listId가 다르면 서로 섞이지 않는다', () => {
    saveVirtualSnapshot('post-feed', 'abc123', {
      offset: 1200,
      columnCount: 3,
      count: 195,
      items: sampleItems,
    });

    expect(loadVirtualSnapshot('bookmark-all', 'abc123', 3, 195)).toBeNull();
  });

  it('오래된 스냅샷은 최근 8개를 넘으면 지워진다', () => {
    for (let i = 0; i < 9; i++) {
      saveVirtualSnapshot('post-feed', `key-${i}`, {
        offset: i,
        columnCount: 3,
        count: 195,
        items: sampleItems,
      });
    }

    // 가장 먼저 저장된 key-0은 지워지고, 이후 저장된 것들은 남아있다
    expect(loadVirtualSnapshot('post-feed', 'key-0', 3, 195)).toBeNull();
    expect(loadVirtualSnapshot('post-feed', 'key-8', 3, 195)).not.toBeNull();
  });
});
