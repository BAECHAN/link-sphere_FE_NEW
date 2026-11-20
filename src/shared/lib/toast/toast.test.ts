import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast as sonnerToast } from 'sonner';
import { toast } from '@link-sphere/ui/lib/toast/toast';
import {
  INLINE_ACTION_CLASS_NAMES,
  STACKED_ACTION_CLASS_NAMES,
} from '@link-sphere/ui/lib/toast/toast-layout';
import { TEXTS } from '@/shared/config/texts';

// sonner는 src/test/setup.ts에서 모킹돼 있어, 래퍼가 sonner에 넘긴 인자를 그대로 확인할 수 있다
beforeEach(() => {
  vi.clearAllMocks();
});

describe('toast 문장 줄바꿈', () => {
  it('두 문장이면 문장 끝 공백을 줄바꿈으로 바꾼다', () => {
    toast.info(TEXTS.messages.info.sessionExpired);

    expect(sonnerToast.info).toHaveBeenCalledWith(
      '로그인이 만료됐어요.\n다시 로그인하면 이어서 이용할 수 있어요.',
      expect.anything()
    );
  });

  it('세 문장 이상이면 문장마다 바꾸고, 물음표로 끝난 문장도 바꾼다', () => {
    toast.error('정말 나갈까요? 입력한 내용이 사라져요. 다시 확인해주세요.');

    expect(sonnerToast.error).toHaveBeenCalledWith(
      '정말 나갈까요?\n입력한 내용이 사라져요.\n다시 확인해주세요.',
      expect.anything()
    );
  });

  it('한 문장이면 그대로 둔다', () => {
    toast.info(TEXTS.messages.info.switchedToOtherAccount);

    expect(sonnerToast.info).toHaveBeenCalledWith(
      TEXTS.messages.info.switchedToOtherAccount,
      expect.anything()
    );
  });

  it.each([
    ['한글 뒤가 아닌 마침표(닉네임 안내)', TEXTS.validation.nicknameCharset],
    ['소수점', '약 3.5분 뒤 다시 시도해주세요.'],
    ['URL 끝의 마침표', '주소는 https://linksphere.click. 이 주소로 접속해주세요.'],
    ['영어 문장', 'Request failed. Please retry.'],
  ])('%s는 건드리지 않는다', (_, message) => {
    toast.error(message);

    expect(sonnerToast.error).toHaveBeenCalledWith(message, expect.anything());
  });

  it('URL이 든 문장도 한글 뒤 마침표에서만 바꾼다', () => {
    toast.error(TEXTS.messages.error.postSubmit.urlInvalid);

    expect(sonnerToast.error).toHaveBeenCalledWith(
      '올바른 URL이 아니에요.\nhttp:// 또는 https://로 시작하는지 확인해주세요.',
      expect.anything()
    );
  });

  it('문자열이 아닌 메시지(ReactNode)는 그대로 넘긴다', () => {
    const node = createElement('span', null, '첫 문장이에요. 둘째 문장이에요.');

    toast(node);

    expect(sonnerToast).toHaveBeenCalledWith(node, expect.anything());
  });

  it('위치 정책과 호출자 옵션 병합은 그대로다', () => {
    toast.success(TEXTS.messages.success.signUpCompleted, { id: 'dedup' });

    expect(sonnerToast.success).toHaveBeenCalledWith(
      '가입을 완료했어요.\n메일함에서 인증 링크를 확인해주세요.',
      { position: 'bottom-center', id: 'dedup' }
    );
  });
});

// 버튼(action)이 달린 토스트의 배치는 호출부가 아니라 래퍼가 정한다(docs/FE-ARCHITECTURE.md §14 "버튼 배치")
describe('toast 버튼 배치', () => {
  const action = { label: TEXTS.bookmark.folder.viewAction, onClick: () => {} };

  it('버튼이 없으면 배치 옵션을 더하지 않는다', () => {
    toast.info(TEXTS.messages.info.sessionExpired, { id: 'no-action' });

    expect(sonnerToast.info).toHaveBeenCalledWith(expect.anything(), {
      position: 'top-center',
      id: 'no-action',
    });
  });

  it('버튼이 있고 문구가 한 줄이면 같은 줄 배치다 - 닫기 X를 끄고, 좁아서 안 들어가면 버튼만 내려가는 클래스를 입힌다', () => {
    toast.success(TEXTS.messages.success.bookmarkSavedTo('개발'), { action });

    expect(sonnerToast.success).toHaveBeenCalledWith(expect.anything(), {
      position: 'bottom-center',
      action,
      closeButton: false,
      classNames: INLINE_ACTION_CLASS_NAMES,
    });
  });

  it('버튼이 있고 문구가 두 문장이면 아래 줄 배치다 - 닫기 X는 그대로 둔다', () => {
    toast.info(TEXTS.messages.info.sessionExpired, { action });

    expect(sonnerToast.info).toHaveBeenCalledWith(expect.anything(), {
      position: 'top-center',
      action,
      classNames: STACKED_ACTION_CLASS_NAMES,
    });
  });

  it('버튼이 있고 설명이 있으면 문구가 한 문장이어도 아래 줄 배치다', () => {
    const description = TEXTS.messages.success.bookmarkRemovedWithLastFolderDescription;

    toast.success(TEXTS.messages.success.bookmarkRemoved, { description, action });

    expect(sonnerToast.success).toHaveBeenCalledWith(expect.anything(), {
      position: 'bottom-center',
      description,
      action,
      classNames: STACKED_ACTION_CLASS_NAMES,
    });
  });

  it('버튼이 있고 문구가 문자열이 아니면(줄 수를 알 수 없다) 아래 줄 배치다', () => {
    toast(createElement('span', null, '문구'), { action });

    expect(sonnerToast).toHaveBeenCalledWith(expect.anything(), {
      position: 'top-center',
      action,
      classNames: STACKED_ACTION_CLASS_NAMES,
    });
  });

  it('호출부는 배치를 고를 수 없다 - classNames·closeButton을 넘기면 타입 오류다', () => {
    // @ts-expect-error 배치 클래스는 래퍼가 정한다
    toast.error('문구', { classNames: { toast: 'flex' } });
    // @ts-expect-error 닫기 X 유무는 래퍼가 정한다
    toast.error('문구', { closeButton: false });

    expect(sonnerToast.error).toHaveBeenCalledTimes(2);
  });

  it('변수에 담아 넘긴 모양 옵션(타입이 못 막는다)은 버린다', () => {
    const smuggled = { action, closeButton: false, classNames: { toast: 'flex' } };

    toast.info(TEXTS.messages.info.sessionExpired, smuggled);

    expect(sonnerToast.info).toHaveBeenCalledWith(expect.anything(), {
      position: 'top-center',
      action,
      classNames: STACKED_ACTION_CLASS_NAMES,
    });
  });

  it('UNSAFE_classNames(shared/lib/toast 전용)는 배치 클래스 위에 합쳐 넘기고 sonner에는 그 이름으로 넘기지 않는다', () => {
    toast.error('제목', {
      description: '설명',
      action,
      UNSAFE_classNames: { title: 'custom-title' },
    });

    expect(sonnerToast.error).toHaveBeenCalledWith('제목', {
      position: 'top-center',
      description: '설명',
      action,
      classNames: { ...STACKED_ACTION_CLASS_NAMES, title: 'custom-title' },
    });
  });
});
