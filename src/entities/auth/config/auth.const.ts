/** 비밀번호 칸 아래 체크리스트(PasswordRequirementList)에 그리는 조건과 그 순서 */
export const PASSWORD_REQUIREMENTS = ['minLength', 'letter', 'digit', 'special'] as const;

export type PasswordRequirement = (typeof PASSWORD_REQUIREMENTS)[number];
