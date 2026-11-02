import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast as sonnerToast } from 'sonner';
import { toast } from '@/shared/lib/toast/toast';
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
