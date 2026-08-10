import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from '@/shared/lib/toast/toast';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { TEXTS } from '@/shared/config/texts';

/** File.size는 읽기 전용이라 실제 큰 버퍼를 만들지 않고 원하는 크기로 흉내낸다 */
function fakeFile(name: string, sizeInBytes = 1024): File {
  const file = new File([], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: sizeInBytes });
  return file;
}

const MB = 1024 * 1024;

describe('useImageAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('5장 초과 시 남은 슬롯만큼만 추가하고 초과 토스트를 띄운다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));

    act(() => {
      result.current.addFiles([
        fakeFile('a.png'),
        fakeFile('b.png'),
        fakeFile('c.png'),
        fakeFile('d.png'),
        fakeFile('e.png'),
        fakeFile('f.png'),
      ]);
    });

    // addFiles는 SVG 치수 정규화를 위해 파일마다 await를 거치는 비동기 함수라, 상태 반영은
    // 다음 마이크로태스크 이후에야 일어난다.
    await waitFor(() => expect(result.current.images).toHaveLength(5));
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageCountExceeded(5));
  });

  it('슬롯이 이미 꽉 찼으면 추가로 넣지 않는다', async () => {
    const { result } = renderHook(() => useImageAttachments({ maxCount: 2 }));

    act(() => {
      result.current.addFiles([fakeFile('a.png'), fakeFile('b.png')]);
    });
    await waitFor(() => expect(result.current.images).toHaveLength(2));

    act(() => {
      result.current.addFiles([fakeFile('c.png')]);
    });

    expect(result.current.images.map((f) => f.name)).toEqual(['a.png', 'b.png']);
  });

  it('초과 크기 파일만 제외하고 정상 크기 파일은 추가한다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));

    act(() => {
      result.current.addFiles([fakeFile('ok.png', 1 * MB), fakeFile('big.png', 31 * MB)]);
    });

    await waitFor(() => expect(result.current.images.map((f) => f.name)).toEqual(['ok.png']));
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageTooLarge(30));
  });

  it('reservedCount만큼 남은 슬롯이 줄어든다', async () => {
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5, reservedCount: 3 }));

    act(() => {
      result.current.addFiles([fakeFile('a.png'), fakeFile('b.png'), fakeFile('c.png')]);
    });

    await waitFor(() => expect(result.current.images).toHaveLength(2));
  });

  it('붙여넣기 경로도 addFiles와 동일하게 이미지만 추려 반영한다', async () => {
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));
    const file = fakeFile('pasted.png');
    const preventDefault = vi.fn();
    const clipboardEvent = {
      clipboardData: {
        items: [
          { type: 'image/png', getAsFile: () => file },
          { type: 'text/plain', getAsFile: () => null },
        ],
      },
      preventDefault,
    } as unknown as React.ClipboardEvent<HTMLTextAreaElement>;

    act(() => {
      result.current.handlePaste(clipboardEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(result.current.images).toEqual([file]));
  });

  it('드래그앤드롭은 이미지가 아닌 파일이 섞여 있어도 이미지만 반영하고, 드래그 상태를 정리하고, 이미지 아닌 파일에는 에러 토스트를 띄운다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));
    const file = fakeFile('dropped.png');
    const nonImageFile = new File([], 'doc.pdf', { type: 'application/pdf' });
    const preventDefault = vi.fn();
    const dropEvent = {
      dataTransfer: { files: [file, nonImageFile] },
      preventDefault,
    } as unknown as React.DragEvent<HTMLElement>;

    act(() => {
      result.current.handleDrop(dropEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.isDraggingOver).toBe(false);
    await waitFor(() => expect(result.current.images).toEqual([file]));
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageFileOnly);
  });

  it('드래그앤드롭으로 이미지가 아닌 파일만 놓으면 아무것도 추가하지 않고 에러 토스트를 띄운다', () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));
    const nonImageFile = new File([], 'notes.txt', { type: 'text/plain' });
    const dropEvent = {
      dataTransfer: { files: [nonImageFile] },
      preventDefault: vi.fn(),
    } as unknown as React.DragEvent<HTMLElement>;

    act(() => {
      result.current.handleDrop(dropEvent);
    });

    expect(result.current.images).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageFileOnly);
  });

  it('파일 선택 경로로 이미지가 아닌 파일이 들어와도 addFiles가 걸러내고 에러 토스트를 띄운다', () => {
    // accept="image/*"는 OS 파일창의 힌트일 뿐 강제가 아니므로, addFiles 자체가 최종 방어선이다.
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));
    const nonImageFile = new File([], 'doc.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.addFiles([nonImageFile]);
    });

    expect(result.current.images).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageFileOnly);
  });

  it('StrictMode에서도 크기 초과 에러 토스트가 정확히 한 번만 뜬다 (setState updater 부수효과 회귀 방지)', () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.addFiles([fakeFile('big.png', 31 * MB)]);
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageTooLarge(30));
  });

  it('StrictMode에서도 개수 초과 에러 토스트가 정확히 한 번만 뜬다 (setState updater 부수효과 회귀 방지)', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useImageAttachments({ maxCount: 2 }), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.addFiles([fakeFile('a.png'), fakeFile('b.png'), fakeFile('c.png')]);
    });

    await waitFor(() => expect(result.current.images).toHaveLength(2));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.imageCountExceeded(2));
  });

  /** window dragenter/dragleave는 실제 파일 드래그와 텍스트 드래그를 dataTransfer.types로 구분한다 */
  function dispatchWindowFileDragEvent(type: 'dragenter' | 'dragleave' | 'drop') {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'] } });
    window.dispatchEvent(event);
  }

  it('폼 영역 밖 뷰포트 어디든 파일 드래그가 들어오면 isDraggingOver가 true가 되고, 벗어나면 false로 돌아온다', () => {
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));

    expect(result.current.isDraggingOver).toBe(false);

    act(() => {
      dispatchWindowFileDragEvent('dragenter');
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      dispatchWindowFileDragEvent('dragleave');
    });
    expect(result.current.isDraggingOver).toBe(false);
  });

  it('뷰포트 드래그 중 실제로 드롭이 발생하면 isDraggingOver가 false로 정리된다', () => {
    const { result } = renderHook(() => useImageAttachments({ maxCount: 5 }));

    act(() => {
      dispatchWindowFileDragEvent('dragenter');
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      dispatchWindowFileDragEvent('drop');
    });
    expect(result.current.isDraggingOver).toBe(false);
  });
});
