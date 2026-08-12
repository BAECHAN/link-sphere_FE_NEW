import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRecentFolders } from '@/entities/folder/model/useRecentFolders';
import { Folder } from '@/entities/folder/model/folder.schema';

function makeFolder(overrides: Partial<Folder> & Pick<Folder, 'id'>): Folder {
  return {
    name: overrides.id,
    sortOrder: 0,
    bookmarkCount: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastUsedAt: undefined,
    ...overrides,
  };
}

// 폴더 6개(임계값) — id 순으로 오래된 것부터 최근 것까지 lastUsedAt 부여
function makeSixFoldersWithUsage(): Folder[] {
  return [1, 2, 3, 4, 5, 6].map((n) =>
    makeFolder({ id: `f${n}`, lastUsedAt: new Date(`2025-01-0${n}`) })
  );
}

describe('useRecentFolders', () => {
  it('페칭 중에는 folders가 비어 있어도 완료 후 최근 폴더를 계산한다', () => {
    // 세 화면 모두 useFolderListQuery가 로딩 중일 땐 folders=[] 로 렌더된다.
    // 마운트 시점에 그 값을 굳히면 데이터가 도착해도 영원히 빈 채로 고정되는 버그가 생긴다.
    const folders = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isFetching }: { folders: Folder[]; isFetching: boolean }) =>
        useRecentFolders(folders, isFetching),
      { initialProps: { folders: [] as Folder[], isFetching: true } }
    );

    expect(result.current.recentFolders).toEqual([]);

    rerender({ folders, isFetching: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);
  });

  it('폴더가 6개 미만이면 임계값 미달로 빈 배열을 반환한다', () => {
    const folders = [1, 2, 3, 4, 5].map((n) =>
      makeFolder({ id: `f${n}`, lastUsedAt: new Date(`2025-01-0${n}`) })
    );
    const { result } = renderHook(() => useRecentFolders(folders, false));

    expect(result.current.recentFolders).toEqual([]);
  });

  it('사용 이력이 있는 폴더가 3개 미만이면 폴더 총수가 많아도 빈 배열을 반환한다', () => {
    const folders = [
      makeFolder({ id: 'f1', lastUsedAt: new Date('2025-01-01') }),
      makeFolder({ id: 'f2', lastUsedAt: new Date('2025-01-02') }),
      makeFolder({ id: 'f3' }),
      makeFolder({ id: 'f4' }),
      makeFolder({ id: 'f5' }),
      makeFolder({ id: 'f6' }),
    ];
    const { result } = renderHook(() => useRecentFolders(folders, false));

    expect(result.current.recentFolders).toEqual([]);
  });

  it('구성이 확정된 뒤 folders만 바뀌면(낙관적 업데이트 등) 순서는 고정하되 각 폴더의 최신 필드는 반영한다', () => {
    // 원칙4: 열려 있는 동안 순서(공간기억)는 고정 — 하지만 bookmarkCount 같은 필드까지 얼리면
    // 게시글 삭제 후 상단 구획만 옛 숫자를 보여주는 버그가 된다. 스냅샷은 id 목록만 고정하고
    // 값은 항상 최신 folders에서 다시 조회해야 한다.
    const initial = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isFetching }: { folders: Folder[]; isFetching: boolean }) =>
        useRecentFolders(folders, isFetching),
      { initialProps: { folders: initial, isFetching: false } }
    );

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);

    // f1이 방금 저장돼 가장 최근이 됐고, f6은 게시글이 하나 삭제됐다고 가정.
    // isFetching은 그대로 false(예: 낙관적 setQueryData) — 순서는 안 바뀌어야 하지만
    // f6의 개수는 즉시 반영돼야 한다.
    const updated = initial.map((f) => {
      if (f.id === 'f1') {
        return { ...f, lastUsedAt: new Date('2099-01-01') };
      }
      if (f.id === 'f6') {
        return { ...f, bookmarkCount: 5 };
      }
      return f;
    });
    rerender({ folders: updated, isFetching: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);
    expect(result.current.recentFolders.find((f) => f.id === 'f6')?.bookmarkCount).toBe(5);
  });

  it('재방문 시 stale 캐시로 시작해도, refetch(isFetching false 전환) 완료 후의 최신 데이터로 스냅샷을 찍는다', () => {
    // 버그였던 지점: 재방문 시엔 캐시가 있어 isLoading이 곧장 false가 되고, 그 순간 옛 데이터로
    // 구성이 굳어버려 방금 저장한 폴더가 상단에 반영되지 않았다. isFetching 기준으로는 refetch가
    // 끝난 뒤에야 스냅샷을 찍으므로 최신 구성이 반영돼야 한다.
    const stale = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isFetching }: { folders: Folder[]; isFetching: boolean }) =>
        useRecentFolders(folders, isFetching),
      { initialProps: { folders: stale, isFetching: true } }
    );

    // refetch 진행 중 — 아직 아무것도 확정되지 않는다.
    expect(result.current.recentFolders).toEqual([]);

    // 방금 새 폴더 f7에 저장해 f7이 최신이 된 응답이 도착.
    const fresh = [...stale, makeFolder({ id: 'f7', lastUsedAt: new Date('2099-01-01') })];
    rerender({ folders: fresh, isFetching: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f7', 'f6', 'f5']);
  });

  it('sessionKey가 바뀌면(예: 모달 재오픈) 새로 스냅샷을 찍는다', () => {
    const initial = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({
        folders,
        isFetching,
        sessionKey,
      }: {
        folders: Folder[];
        isFetching: boolean;
        sessionKey: boolean;
      }) => useRecentFolders(folders, isFetching, sessionKey),
      { initialProps: { folders: initial, isFetching: false, sessionKey: true } }
    );

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);

    const updated = initial.map((f) =>
      f.id === 'f1' ? { ...f, lastUsedAt: new Date('2099-01-01') } : f
    );
    // 세션이 바뀌면(모달 닫혔다 다시 열림) 새 데이터로 다시 스냅샷을 찍어야 한다.
    rerender({ folders: updated, isFetching: false, sessionKey: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f1', 'f6', 'f5']);
  });

  it('스냅샷에 찍힌 폴더가 이후 삭제되면 결과에서 빠진다', () => {
    const initial = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isFetching }: { folders: Folder[]; isFetching: boolean }) =>
        useRecentFolders(folders, isFetching),
      { initialProps: { folders: initial, isFetching: false } }
    );

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);

    // f5 폴더가 삭제됨 — 목록에서 사라짐, isFetching은 계속 false(낙관적 반영 가정)
    const updated = initial.filter((f) => f.id !== 'f5');
    rerender({ folders: updated, isFetching: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f4']);
  });
});
