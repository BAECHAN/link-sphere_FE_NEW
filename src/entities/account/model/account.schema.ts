import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

// 길이와 허용 문자를 하나의 정규식으로 합치면, 글자 수는 맞는데 허용되지 않는 문자가 섞였을 때도
// (예: 완성되지 않은 낱자모 "ㅎㅍㅊ...") 길이 안내 메시지가 떠서 실제 원인과 다른 메시지를 보게 된다.
export const nicknameValidationSchema = z
  .string()
  .min(2, TEXTS.validation.nicknameLength)
  .max(20, TEXTS.validation.nicknameLength)
  .regex(/^[a-zA-Z0-9가-힣_.-]*$/, TEXTS.validation.nicknameCharset);

export const emailValidationSchema = z.string().email(TEXTS.validation.emailRegex);

// ==================== 1. Domain Model Schema ====================

// 이 값(accountSchema)은 아직 post.schema.ts의 postSchema 구성(author: accountSchema.pick(...))에
// 쓰이고 있어 남겨둔다. 응답 타입 자체의 정본은 account.dto.ts(BE 스펙 생성)로 옮겼다 — post
// 마이그레이션(Phase 6) 때 이 값도 함께 정리한다.
export const accountSchema = z.object({
  id: z.string(),
  nickname: nicknameValidationSchema,
  image: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']),
});

// 수정 요청 — nickname 필수, image는 BE가 null로 반환할 수 있으므로 nullish
export const updateAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  image: z.string().nullish(),
});

// ==================== 2. DTO ====================

export type UpdateAccount = z.infer<typeof updateAccountSchema>;

// 기존 import 경로 호환 — 응답 타입은 dto.ts(BE 스펙 생성)에서 가져간다.
export type { Account } from '@/entities/account/model/account.dto';
