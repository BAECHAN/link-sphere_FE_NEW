/**
 * 비밀번호 길이 정책 - 서버(SignupRequest.password의 `@Size(min = 8, max = 64)`)와
 * passwordValidationSchema(auth.schema.ts:8-12)가 같은 값을 쓴다. 스키마는 최소 길이를 정규식
 * 안(`.{8,}`)에 품고 있어 이 상수를 직접 쓰지 않으므로, 둘이 어긋나지 않는지는
 * auth.util.test.ts의 차등 테스트가 보증한다.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/** 비밀번호 칸 아래 체크리스트(PasswordRequirementList)에 그리는 조건과 그 순서 */
export const PASSWORD_REQUIREMENTS = ['minLength', 'letter', 'digit', 'special'] as const;

export type PasswordRequirement = (typeof PASSWORD_REQUIREMENTS)[number];
