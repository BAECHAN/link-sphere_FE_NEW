import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast as sonnerToast, type ExternalToast } from 'sonner';
import { showNoticeToast } from '@/shared/lib/toast/NoticeToast';
import { STACKED_ACTION_CLASS_NAMES } from '@baechan/ui/lib/toast/toast-layout';

// sonner는 src/test/setup.ts에서 모킹돼 있어, sonner에 넘어간 인자를 그대로 확인할 수 있다
beforeEach(() => {
  vi.clearAllMocks();
});

const VARIANTS = ['error', 'warning', 'success', 'info'] as const;

const TITLE = '제목이에요';
const DESCRIPTION = '첫 문장이에요. 둘째 문장이에요.';

/** 그 종류의 sonner 메서드에 마지막으로 넘어간 옵션 */
function lastOptions(variant: (typeof VARIANTS)[number]): ExternalToast {
  const options = vi.mocked(sonnerToast[variant]).mock.calls.at(-1)?.[1];

  if (!options) {
    throw new Error(`toast.${variant}가 호출되지 않았어요`);
  }

  return options;
}

describe('showNoticeToast', () => {
  it.each(VARIANTS)('%s 종류는 sonner의 같은 이름 메서드로 제목을 띄운다', (variant) => {
    showNoticeToast({ variant, title: TITLE, description: DESCRIPTION });

    expect(sonnerToast[variant]).toHaveBeenCalledTimes(1);
    expect(sonnerToast[variant]).toHaveBeenCalledWith(TITLE, expect.anything());
  });

  it.each(['error', 'warning'] as const)(
    '%s는 지속 시간을 넘기지 않으면 닫을 때까지 남는다',
    (variant) => {
      showNoticeToast({ variant, title: TITLE, description: DESCRIPTION });

      expect(lastOptions(variant).duration).toBe(Infinity);
    }
  );

  it.each(['success', 'info'] as const)(
    '%s는 지속 시간을 넘기지 않으면 sonner 기본값대로 사라진다',
    (variant) => {
      showNoticeToast({ variant, title: TITLE, description: DESCRIPTION });

      expect(lastOptions(variant)).not.toHaveProperty('duration');
    }
  );

  it('지속 시간을 넘기면 종류의 기본값보다 그 값을 쓴다', () => {
    showNoticeToast({ variant: 'error', title: TITLE, description: DESCRIPTION, duration: 8000 });
    showNoticeToast({
      variant: 'success',
      title: TITLE,
      description: DESCRIPTION,
      duration: Infinity,
    });

    expect(lastOptions('error').duration).toBe(8000);
    expect(lastOptions('success').duration).toBe(Infinity);
  });

  it('아이콘을 넘기면 그 아이콘을, 안 넘기면 종류의 기본 아이콘을 쓴다', () => {
    const icon = <svg data-testid="custom-icon" />;

    showNoticeToast({ variant: 'info', title: TITLE, description: DESCRIPTION, icon });
    showNoticeToast({ variant: 'error', title: TITLE, description: DESCRIPTION });

    expect(lastOptions('info').icon).toBe(icon);
    expect(lastOptions('error')).not.toHaveProperty('icon');
  });

  it('id와 버튼을 넘기면 그대로 전달하고, 안 넘기면 옵션에 넣지 않는다', () => {
    const action = { label: '다시 하기', onClick: () => {} };

    showNoticeToast({
      variant: 'error',
      title: TITLE,
      description: DESCRIPTION,
      id: 'notice:form',
      action,
    });
    showNoticeToast({ variant: 'info', title: TITLE, description: DESCRIPTION });

    expect(lastOptions('error')).toMatchObject({ id: 'notice:form', action });
    expect(lastOptions('info')).not.toHaveProperty('id');
    expect(lastOptions('info')).not.toHaveProperty('action');
  });

  it('설명은 문장마다 한 줄로 나눈다', () => {
    showNoticeToast({ variant: 'error', title: TITLE, description: DESCRIPTION });

    const lines = lastOptions('error').description as ReactNode[];

    expect(lines.every((line) => isValidElement(line))).toBe(true);
    expect(
      lines.map((line) => (line as ReactElement<{ children: string }>).props.children)
    ).toEqual(['첫 문장이에요.', '둘째 문장이에요.']);
  });

  it('버튼이 없어도 닫기 X 오른쪽 위·아이콘 제목 줄 배치와 제목·설명 글자 모양을 입힌다', () => {
    showNoticeToast({ variant: 'success', title: TITLE, description: DESCRIPTION });

    expect(lastOptions('success').classNames).toEqual({
      ...STACKED_ACTION_CLASS_NAMES,
      title: '!text-subsection-title',
      description: '!text-foreground',
    });
  });
});
