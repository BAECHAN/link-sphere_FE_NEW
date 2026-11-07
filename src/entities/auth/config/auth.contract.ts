// BE 요청 본문과 같아야 하는 비밀번호 길이(BE SignupRequest.password의 @Size(min = 8, max = 64)). 값은 손으로 두고
// auth.contract.test.ts가 스펙(openapi.json)의 값과 대조한다 - 런타임은 스펙을 싣지 않고
// 이 상수만 쓴다(docs/OPENAPI-CODEGEN.md §5-6).
//
// passwordValidationSchema(auth.schema.ts)는 최소 길이를 정규식 안(`.{8,}`)에 품고, 안내 문구를 나누려고 정규식을 둘로
// 나눠 둔다. 스키마가 스펙 규칙(길이 범위 + 패턴)과 같은 판정을 하는지는 auth.contract.test.ts의 차등 테스트가 보증한다.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
