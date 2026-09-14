import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom';
import { Suspense } from 'react';
import {
  useSearchParamsDraft,
  resetPendingSearchParams,
} from '@/shared/hooks/useSearchParamsDraft';

// 실제 앱의 "필터 변경 → 쿼리 키 변경 → suspend"(RouterProvider.tsx의 v7_startTransition +
// useSuspenseFetchPostListQuery)를 결정적으로 재현한다. 새 검색 문자열마다 별도 게이트를
// 만들고, resolve()를 부르기 전까지 그 렌더를 suspend시켜 "정지 구간"을 손으로 만든다.
interface Gate {
  promise: Promise<void>;
  resolve: () => void;
  resolved: boolean;
}

function createGate(): Gate {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  const gate: Gate = {
    promise,
    resolved: false,
    resolve: () => {
      gate.resolved = true;
      resolve();
    },
  };
  return gate;
}

function createGateRegistry() {
  const bySearch = new Map<string, Gate>();
  const inOrder: Gate[] = [];

  function getGate(search: string): Gate {
    let gate = bySearch.get(search);
    if (!gate) {
      gate = createGate();
      bySearch.set(search, gate);
      inOrder.push(gate);
    }
    return gate;
  }

  return { getGate, inOrder };
}

function Suspender({ getGate }: { getGate: (search: string) => Gate }) {
  const [searchParams] = useSearchParams();
  const gate = getGate(searchParams.toString());

  if (!gate.resolved) {
    throw gate.promise;
  }

  return null;
}

function FilterPanel() {
  const { searchParams, updateSearchParams, clearSearchParams } = useSearchParamsDraft();
  const navigate = useNavigate();

  return (
    <div>
      <div data-testid="filter">{searchParams.get('filter') ?? ''}</div>
      <button onClick={() => updateSearchParams((draft) => draft.set('filter', 'A'))}>set-a</button>
      <button
        onClick={() =>
          updateSearchParams((draft) => {
            const current = draft.get('filter');
            draft.set('filter', current ? `${current},B` : 'B');
          })
        }
      >
        add-b
      </button>
      <button onClick={() => clearSearchParams()}>clear</button>
      {/* 검색 파라미터는 그대로 두고 경로만 바꾼다 - 같은 게이트(이미 resolved)를 재사용해
          suspend 없이 즉시 커밋되므로, 이 클릭 하나로 location.key만 깨끗하게 바뀐다. */}
      <button onClick={() => navigate('/elsewhere')}>navigate-away</button>
    </div>
  );
}

function QueryPanel() {
  const { searchParams, updateSearchParams } = useSearchParamsDraft();

  return (
    <div>
      <div data-testid="q">{searchParams.get('q') ?? ''}</div>
      <button onClick={() => updateSearchParams((draft) => draft.set('q', 'keyword'))}>
        set-q
      </button>
    </div>
  );
}

/** 아직 안 풀린 게이트를 전부 열고, React가 그 커밋을 끝까지 처리하게 한다. */
async function releaseAllGates(gates: Gate[]) {
  await act(async () => {
    gates.filter((g) => !g.resolved).forEach((g) => g.resolve());
    await Promise.resolve();
  });
}

async function renderPanel(children: React.ReactNode, initialEntries: string[] = ['/']) {
  const { getGate, inOrder } = createGateRegistry();

  render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true }}>
      <Suspense fallback={<div data-testid="loading" />}>
        <Suspender getGate={getGate} />
        {children}
      </Suspense>
    </MemoryRouter>
  );

  // 최초 마운트 렌더도 Suspender를 거치므로, 화면이 뜬 상태에서 테스트를 시작하기 위해 먼저 연다.
  await releaseAllGates(inOrder);
  await screen.findByText('set-a');

  return { inOrder };
}

describe('useSearchParamsDraft', () => {
  afterEach(() => {
    resetPendingSearchParams();
  });

  it('정지 구간 없이 클릭하면 그대로 반영된다', async () => {
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(<FilterPanel />);

    await user.click(screen.getByText('set-a'));
    await releaseAllGates(inOrder);

    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('A'));
  });

  it('정지 구간(첫 조작이 아직 커밋 전) 안에서 이어 쓰면 누적된다', async () => {
    // usePostList.ts의 toggleFilter가 mutation으로 "우연히" 보장하던 것 —
    // 북마크한→내가작성한 연속 클릭이 둘 다 살아남아야 한다(실측 시나리오 A).
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(<FilterPanel />);

    await user.click(screen.getByText('set-a'));
    // 아직 커밋 전이라 이전 화면(필터 없음)이 유지된다
    expect(screen.getByTestId('filter')).toHaveTextContent('');

    await user.click(screen.getByText('add-b'));
    expect(screen.getByTestId('filter')).toHaveTextContent('');

    await releaseAllGates(inOrder);

    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('A,B'));
  });

  it('초기화 직후 정지 구간에 다른 조작을 해도 지운 값이 되살아나지 않는다', async () => {
    // 실측 시나리오 D — clearSearch 후 그 트랜지션이 아직 pending인 동안 칩을 클릭하면
    // 옛 mutate된 공유 객체를 계속 읽어 방금 지운 필터가 되살아나던 버그.
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(<FilterPanel />, ['/?filter=A']);

    await user.click(screen.getByText('clear'));
    await user.click(screen.getByText('add-b'));

    await releaseAllGates(inOrder);

    // 'A'가 되살아나지 않고, clear 이후의 add-b만 반영되어야 한다
    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('B'));
  });

  it('커밋된 뒤의 조작은 pending이 아니라 커밋된 URL을 기준으로 계산한다', async () => {
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(<FilterPanel />);

    await user.click(screen.getByText('set-a'));
    await releaseAllGates(inOrder);
    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('A'));

    await user.click(screen.getByText('add-b'));
    await releaseAllGates(inOrder);

    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('A,B'));
  });

  it('외부 navigate로 커밋되면(location.key 변경) pending이 폐기된다', async () => {
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(<FilterPanel />);

    await user.click(screen.getByText('set-a'));
    // 아직 커밋 전 — 정지 구간 안이라 이전 화면(필터 없음)이 유지된다
    expect(screen.getByTestId('filter')).toHaveTextContent('');

    // 검색 파라미터는 그대로인 다른 경로로 이동 — 즉시 커밋되어 location.key가 바뀐다.
    await user.click(screen.getByText('navigate-away'));

    // pending이 살아있었다면 이 클릭은 filter=A 위에 이어붙어 'A,B'가 됐을 것이다.
    // 폐기됐다면 커밋된 값(필터 없음) 기준으로 계산해 'B'만 남는다.
    await user.click(screen.getByText('add-b'));
    await releaseAllGates(inOrder);

    await waitFor(() => expect(screen.getByTestId('filter')).toHaveTextContent('B'));
  });

  it('서로 다른 훅 인스턴스도 같은 pending을 공유한다', async () => {
    // 실측 시나리오 E — BookmarkPage(folder/sort)와 useBookmarkSearch(q)처럼 서로 다른
    // useSearchParams() 인스턴스가 정지 구간 안에서 각자 조작해도 서로의 의도를 유실하지 않아야 한다.
    const user = userEvent.setup();
    const { inOrder } = await renderPanel(
      <>
        <FilterPanel />
        <QueryPanel />
      </>
    );

    await user.click(screen.getByText('set-a'));
    await user.click(screen.getByText('set-q'));

    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(screen.getByTestId('filter')).toHaveTextContent('A');
      expect(screen.getByTestId('q')).toHaveTextContent('keyword');
    });
  });
});
