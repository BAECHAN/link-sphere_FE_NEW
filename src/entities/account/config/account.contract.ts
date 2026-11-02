// BE 요청 본문과 같아야 하는 닉네임 규칙(BE SignupRequest·UpdateAccountRequest의 @Size·@Pattern). 값은 손으로 두고
// account.contract.test.ts가 스펙에서 생성한 상수(openapi.zod.ts)와 대조한다 - 생성 파일을 런타임에 import하면 그 안의
// zod.object(...) 호출 때문에 zod-vendor가 첫 화면 청크에 실린다(docs/OPENAPI-CODEGEN.md §5-6).
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_PATTERN = /^[a-zA-Z0-9가-힣_.-]*$/;
