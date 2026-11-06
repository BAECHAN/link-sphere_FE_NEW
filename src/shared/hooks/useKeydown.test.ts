import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeydown } from '@/shared/hooks/useKeydown';

type KeyInit = KeyboardEventInit & { key: string };

function press(init: KeyInit, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);

  return event;
}

function mount<T extends HTMLElement>(element: T, parent: HTMLElement = document.body) {
  parent.appendChild(element);

  return element;
}

describe('useKeydown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('키 매칭', () => {
    it('일치하는 키를 누르면 이벤트와 함께 콜백을 호출하고 기본 동작을 막는다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));

      const event = press({ key: '/' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('대소문자를 구분하지 않고 키를 비교한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      press({ key: 'B' });
      expect(callback).toHaveBeenCalledTimes(1);

      const upper = vi.fn();
      renderHook(() => useKeydown({ key: 'K' }, upper));

      press({ key: 'k' });
      expect(upper).toHaveBeenCalledTimes(1);
    });

    it('다른 키를 누르면 콜백을 호출하지 않고 기본 동작도 막지 않는다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      const event = press({ key: 'c' });

      expect(callback).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('언마운트하면 더 이상 키 입력에 반응하지 않는다', () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useKeydown({ key: 'b' }, callback));

      unmount();
      press({ key: 'b' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('인자 변경', () => {
    it('콜백이 바뀌면 이후 키 입력에는 새 콜백만 호출한다', () => {
      const first = vi.fn();
      const second = vi.fn();
      const combo = { key: 'b' };
      const { rerender } = renderHook(({ cb }) => useKeydown(combo, cb), {
        initialProps: { cb: first },
      });

      rerender({ cb: second });
      press({ key: 'b' });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('키 조합이 바뀌면 이후에는 새 조합에만 반응한다', () => {
      const callback = vi.fn();
      const { rerender } = renderHook(({ key }) => useKeydown({ key }, callback), {
        initialProps: { key: 'b' },
      });

      rerender({ key: 'c' });
      press({ key: 'b' });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'c' });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('보조 키 (Windows/Linux)', () => {
    it('ctrlKey를 요구하면 Ctrl과 함께 눌렀을 때만 호출한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b', ctrlKey: true }, callback));

      press({ key: 'b' });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', ctrlKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('ctrlKey를 요구하지 않으면 Ctrl을 누른 입력은 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      press({ key: 'b', ctrlKey: true });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('altKey를 요구하면 Alt와 함께 눌렀을 때만 호출한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b', altKey: true }, callback));

      press({ key: 'b' });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', altKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('altKey를 요구하지 않으면 Alt를 누른 입력은 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      press({ key: 'b', altKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('shiftKey를 요구하면 Shift와 함께 눌렀을 때만 호출한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b', shiftKey: true }, callback));

      press({ key: 'b' });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', shiftKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('shiftKey를 요구하지 않으면 Shift를 누른 입력은 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      press({ key: 'b', shiftKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('여러 보조 키를 요구하면 모두 눌렀을 때만 호출한다', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeydown({ key: 'b', ctrlKey: true, altKey: true, shiftKey: true }, callback)
      );

      press({ key: 'b', ctrlKey: true, altKey: true });
      press({ key: 'b', ctrlKey: true, shiftKey: true });
      press({ key: 'b', altKey: true, shiftKey: true });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', ctrlKey: true, altKey: true, shiftKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('보조 키 (macOS)', () => {
    function mockMac() {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      );
    }

    it('ctrlKey 조합은 Command(metaKey)로 동작한다', () => {
      mockMac();
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b', ctrlKey: true }, callback));

      press({ key: 'b', ctrlKey: true });
      press({ key: 'b' });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', metaKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('ctrlKey를 요구하지 않으면 Command를 누른 입력은 무시하고 Ctrl은 무시하지 않는다', () => {
      mockMac();
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: 'b' }, callback));

      press({ key: 'b', metaKey: true });
      expect(callback).not.toHaveBeenCalled();

      press({ key: 'b', ctrlKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('입력 필드 포커스', () => {
    it('input에서 발생한 키 입력은 기본적으로 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const input = mount(document.createElement('input'));

      const event = press({ key: '/' }, input);

      expect(callback).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('textarea에서 발생한 키 입력은 기본적으로 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const textarea = mount(document.createElement('textarea'));

      press({ key: '/' }, textarea);

      expect(callback).not.toHaveBeenCalled();
    });

    it('contenteditable="true"인 요소에서 발생한 키 입력은 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      mount(editable);

      press({ key: '/' }, editable);

      expect(callback).not.toHaveBeenCalled();
    });

    it('contenteditable이 true가 아닌 요소에서는 단축키가 동작한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'false');
      mount(div);

      press({ key: '/' }, div);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('일반 요소에서 발생한 키 입력에는 단축키가 동작한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const button = mount(document.createElement('button'));

      press({ key: '/' }, button);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('이벤트 대상이 아니어도 입력 필드에 포커스가 있으면 무시한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const input = mount(document.createElement('input'));
      input.focus();

      press({ key: '/' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('입력 필드가 아닌 요소에 포커스가 있으면 단축키가 동작한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback));
      const button = mount(document.createElement('button'));
      button.focus();

      press({ key: '/' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('ignoreInputFocus가 false이면 입력 필드에서도 단축키가 동작한다', () => {
      const callback = vi.fn();
      renderHook(() => useKeydown({ key: '/' }, callback, { ignoreInputFocus: false }));
      const input = mount(document.createElement('input'));
      input.focus();

      press({ key: '/' }, input);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('targetRef', () => {
    it('포커스가 대상 요소 밖에 있으면 단축키를 무시한다', () => {
      const callback = vi.fn();
      const container = mount(document.createElement('div'));
      const outside = mount(document.createElement('button'));
      outside.focus();
      const targetRef = { current: container };
      renderHook(() => useKeydown({ key: 'b' }, callback, { targetRef }));

      press({ key: 'b' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('포커스가 대상 요소 내부에 있으면 단축키가 동작한다', () => {
      const callback = vi.fn();
      const container = mount(document.createElement('div'));
      const inside = mount(document.createElement('button'), container);
      inside.focus();
      const targetRef = { current: container };
      renderHook(() => useKeydown({ key: 'b' }, callback, { targetRef }));

      press({ key: 'b' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('대상 요소 내부라도 입력 필드에 포커스가 있으면 기본적으로 무시한다', () => {
      const callback = vi.fn();
      const container = mount(document.createElement('div'));
      const input = mount(document.createElement('input'), container);
      input.focus();
      const targetRef = { current: container };
      renderHook(() => useKeydown({ key: 'b' }, callback, { targetRef }));

      press({ key: 'b' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('ref가 아직 비어 있으면 포커스 위치와 무관하게 동작한다', () => {
      const callback = vi.fn();
      const outside = mount(document.createElement('button'));
      outside.focus();
      const targetRef = { current: null };
      renderHook(() => useKeydown({ key: 'b' }, callback, { targetRef }));

      press({ key: 'b' });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
