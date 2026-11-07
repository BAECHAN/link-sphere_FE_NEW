// BE 요청 본문과 같아야 하는 닉네임 규칙(BE SignupRequest·UpdateAccountRequest의 @Size·@Pattern). 값은 손으로 두고
// account.contract.test.ts가 스펙(openapi.json)의 값과 대조한다 - 런타임은 스펙을 싣지 않고
// 이 상수만 쓴다(docs/OPENAPI-CODEGEN.md §5-6).
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_PATTERN = /^[a-zA-Z0-9가-힣_.-]*$/;
