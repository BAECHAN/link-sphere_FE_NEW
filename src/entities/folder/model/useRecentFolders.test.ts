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
  it('로딩 중에는 folders가 비어 있어도 데이터 도착 후 최근 폴더를 계산한다', () => {
    // 세 화면 모두 useFolderListQuery가 로딩 중일 땐 folders=[] 로 렌더된다.
    // 마운트 시점에 그 값을 굳히면 데이터가 도착해도 영원히 빈 채로 고정되는 버그가 생긴다.
    const folders = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isLoading }: { folders: Folder[]; isLoading: boolean }) =>
        useRecentFolders(folders, isLoading),
      { initialProps: { folders: [] as Folder[], isLoading: true } }
    );

    expect(result.current.recentFolders).toEqual([]);

    rerender({ folders, isLoading: false });

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

  it('데이터가 바뀌어도(재검증) 최초 스냅샷 이후로는 다시 계산하지 않는다', () => {
    // 원칙4: 열려 있는 동안 재정렬 금지 — refetch로 lastUsedAt이 달라져도 화면 순서는 고정.
    const initial = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({ folders, isLoading }: { folders: Folder[]; isLoading: boolean }) =>
        useRecentFolders(folders, isLoading),
      { initialProps: { folders: initial, isLoading: false } }
    );

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);

    // f1이 방금 저장돼 가장 최근이 됐다고 가정 — 세션이 안 바뀌면 무시돼야 한다.
    const updated = initial.map((f) =>
      f.id === 'f1' ? { ...f, lastUsedAt: new Date('2099-01-01') } : f
    );
    rerender({ folders: updated, isLoading: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);
  });

  it('sessionKey가 바뀌면(예: 모달 재오픈) 새로 스냅샷을 찍는다', () => {
    const initial = makeSixFoldersWithUsage();
    const { result, rerender } = renderHook(
      ({
        folders,
        isLoading,
        sessionKey,
      }: {
        folders: Folder[];
        isLoading: boolean;
        sessionKey: boolean;
      }) => useRecentFolders(folders, isLoading, sessionKey),
      { initialProps: { folders: initial, isLoading: false, sessionKey: true } }
    );

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f6', 'f5', 'f4']);

    const updated = initial.map((f) =>
      f.id === 'f1' ? { ...f, lastUsedAt: new Date('2099-01-01') } : f
    );
    // 세션이 바뀌면(모달 닫혔다 다시 열림) 새 데이터로 다시 스냅샷을 찍어야 한다.
    rerender({ folders: updated, isLoading: false, sessionKey: false });

    expect(result.current.recentFolders.map((f) => f.id)).toEqual(['f1', 'f6', 'f5']);
  });
});
