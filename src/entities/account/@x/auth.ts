// entities/auth가 참조하는 account의 공개 표면 (FSD @x 표기 — docs/FE-ARCHITECTURE.md 참고)
export {
  nicknameValidationSchema,
  emailValidationSchema,
} from '@/entities/account/model/account.schema';
export type { Account } from '@/entities/account/model/account.schema';
