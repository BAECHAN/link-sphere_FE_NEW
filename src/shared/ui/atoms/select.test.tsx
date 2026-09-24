import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CLICK_GUARD_MS } from '@/shared/hooks/useClickGuard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/atoms/select';

function renderSelect(onOpenChange?: (open: boolean) => void) {
  renderWithProviders(
    <Select defaultValue="latest" onOpenChange={onOpenChange}>
      <SelectTrigger aria-label="sort">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="latest">Latest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
      </SelectContent>
    </Select>
  );

  return screen.getByRole('combobox', { name: 'sort' });
}

const pressKey = (element: Element, key: string) => {
  act(() => {
    fireEvent.keyDown(element, { key });
  });
};

// 모바일 실기기에서 "닫으려고 트리거를 다시 탭 → 닫혔다가 곧바로 다시 열림"이 보고됐다.
// 에뮬레이션으로는 재현되지 않아(탭이 HTML에 떨어짐) 키보드로 같은 "닫기 직후 열기 요청"
// 순서를 만들어 래퍼의 가드만 검증한다.
describe('Select — 닫힌 직후 재오픈 방지', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Enter로 열린다', () => {
    const trigger = renderSelect();

    pressKey(trigger, 'Enter');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('닫힌 직후의 열기 요청은 무시한다', () => {
    const trigger = renderSelect();

    pressKey(trigger, 'Enter');
    pressKey(screen.getByRole('listbox'), 'Escape');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CLICK_GUARD_MS - 100);
    });
    pressKey(trigger, 'Enter');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('기준 시간이 지난 뒤의 열기 요청은 반영한다', () => {
    const trigger = renderSelect();

    pressKey(trigger, 'Enter');
    pressKey(screen.getByRole('listbox'), 'Escape');

    act(() => {
      vi.advanceTimersByTime(CLICK_GUARD_MS);
    });
    pressKey(trigger, 'Enter');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('무시한 열기 요청은 소비자의 onOpenChange(true)를 부르지 않는다', () => {
    const onOpenChange = vi.fn();
    const trigger = renderSelect(onOpenChange);

    pressKey(trigger, 'Enter');
    pressKey(screen.getByRole('listbox'), 'Escape');
    pressKey(trigger, 'Enter');

    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});
