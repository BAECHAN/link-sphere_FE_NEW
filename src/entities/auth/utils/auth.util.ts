import { PASSWORD_REQUIREMENTS, type PasswordRequirement } from '@/entities/auth/config/auth.const';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/entities/auth/config/auth.contract';
import { ApiError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';

/** met: 충족(초록 ✓) / unmet: 못 채운 채로 칸을 벗어났거나 제출함(빨강 ✗) / pending: 아직 입력 중(회색 ○) */
export type PasswordRequirementState = 'met' | 'unmet' | 'pending';

/** 미완성이 아니라 규칙 위반이라 입력 즉시 알리는 입력 */
export type PasswordViolation = 'nonAscii' | 'tooLong';

/** 비밀번호 확인 칸 아래 한 줄 - none이면 아무것도 표시하지 않는다 */
export type PasswordConfirmStatus = 'none' | 'match' | 'mismatch' | 'required';

const REQUIREMENT_TESTS: Record<PasswordRequirement, (value: string) => boolean> = {
  minLength: (value) => value.length >= PASSWORD_MIN_LENGTH,
  letter: (value) => /[a-zA-Z]/.test(value),
  digit: (value) => /[0-9]/.test(value),
  // 출력 가능 ASCII(0x20~0x7E) 중 영숫자가 아닌 문자(공백 포함). 스키마의 `[^a-zA-Z0-9]`와 달리
  // 한글·이모지를 특수문자로 치지 않는다 - 치면 한글을 칠 때 ✓와 ASCII 위반 문구가 동시에 뜬다.
  // ASCII만 허용하는 조건 아래서는 두 판정이 같은 집합이라 전체 통과 여부는 스키마와 동일하다.
  special: (value) => /[\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(value),
};

export class PasswordUtil {
  /** 체크리스트 조건별 충족 여부 */
  static checkRequirements(value: string): Record<PasswordRequirement, boolean> {
    return {
      minLength: REQUIREMENT_TESTS.minLength(value),
      letter: REQUIREMENT_TESTS.letter(value),
      digit: REQUIREMENT_TESTS.digit(value),
      special: REQUIREMENT_TESTS.special(value),
    };
  }

  /** 비ASCII를 65자 초과보다 먼저 본다 - 둘 다 해당하면 고칠 방법이 더 분명한 쪽을 알린다 */
  static findViolation(value: string): PasswordViolation | null {
    if (/[^\x20-\x7E]/.test(value)) {
      return 'nonAscii';
    }

    if (value.length > PASSWORD_MAX_LENGTH) {
      return 'tooLong';
    }

    return null;
  }

  /** passwordValidationSchema와 같은 판정 - 둘이 같은지는 auth.util.test.ts가 검사한다 */
  static isValid(value: string): boolean {
    return (
      PASSWORD_REQUIREMENTS.every((requirement) => REQUIREMENT_TESTS[requirement](value)) &&
      PasswordUtil.findViolation(value) === null
    );
  }

  /**
   * 못 채운 조건을 언제 빨강으로 바꿀지 정한다 - 입력 중엔 충족만 알리고(reward early), 칸을
   * 한 번 벗어났거나 제출한 뒤에만 지적한다(punish late). 빈 칸을 지나가기만 한 경우는 아직
   * 아무것도 안 쓴 상태라 지적하지 않는다.
   */
  static resolveRequirementStates(
    value: string,
    { isTouched, isSubmitted }: { isTouched: boolean; isSubmitted: boolean }
  ): Record<PasswordRequirement, PasswordRequirementState> {
    const met = PasswordUtil.checkRequirements(value);
    const shouldFlagUnmet = isSubmitted || (isTouched && value !== '');
    const toState = (isMet: boolean): PasswordRequirementState => {
      if (isMet) {
        return 'met';
      }

      return shouldFlagUnmet ? 'unmet' : 'pending';
    };

    return {
      minLength: toState(met.minLength),
      letter: toState(met.letter),
      digit: toState(met.digit),
      special: toState(met.special),
    };
  }

  /**
   * 확인 칸 판정(docs/AUTH.md "비밀번호 입력 피드백" 판정 표). 일치는 판정 가능해지는 즉시
   * 초록으로 보여주고, 불일치는 글자 수가 비밀번호만큼 되거나 칸을 벗어나야 보여준다.
   * isLatched는 불일치를 한 번 보여줬다는 뜻 - 그 뒤엔 고치는 동안 매 글자 다시 판정한다.
   */
  static resolveConfirmStatus({
    password,
    confirm,
    isFocused,
    isLatched,
    isSubmitted,
  }: {
    password: string;
    confirm: string;
    isFocused: boolean;
    isLatched: boolean;
    isSubmitted: boolean;
  }): PasswordConfirmStatus {
    if (confirm === '') {
      return isSubmitted ? 'required' : 'none';
    }

    if (!isSubmitted && password === '') {
      return 'none';
    }

    const canJudge = isSubmitted || isLatched || !isFocused || confirm.length >= password.length;

    if (!canJudge) {
      return 'none';
    }

    return confirm === password ? 'match' : 'mismatch';
  }
}

/** 가입 실패 원인 - 화면에 머물렀으면 message 토스트, 떠났으면 원인별 안내와 버튼(useSignUp) */
export interface SignUpSubmitErrorResolution {
  reason: 'duplicateNickname' | 'duplicateEmail' | 'failed';
  message: string;
}

export class SignUpUtil {
  /**
   * 가입 요청 실패를 원인별로 나눈다. ApiError가 아닌 실패(오프라인·CORS·DNS 등 네트워크 자체 실패)도 반드시
   * failed로 돌려준다 - 빠지면 버튼만 다시 활성화되고 아무 안내 없이 조용히 실패한다.
   */
  static resolveSubmitError(error: unknown): SignUpSubmitErrorResolution {
    if (!(error instanceof ApiError)) {
      return { reason: 'failed', message: TEXTS.messages.error.accountCreateFailed };
    }

    if (error.code === SERVER_ERROR_CODE.DUPLICATE_NICKNAME) {
      return { reason: 'duplicateNickname', message: TEXTS.messages.error.nicknameDuplicate };
    }

    if (error.status === 409) {
      return {
        reason: 'duplicateEmail',
        message: TEXTS.messages.error.accountCreateFailedDuplicateAccount,
      };
    }

    return { reason: 'failed', message: TEXTS.messages.error.accountCreateFailed };
  }
}
