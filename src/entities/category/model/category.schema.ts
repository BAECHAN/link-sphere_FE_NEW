import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

// 이 값(categoryOptionSchema)은 아직 post.schema.ts의 postSchema 구성에 쓰이고 있어
// 남겨둔다. 응답 타입 자체의 정본은 category.dto.ts(BE 스펙 생성)로 옮겼다 — post
// 마이그레이션(Phase 6) 때 이 값도 함께 정리한다.
export const categoryOptionSchema = z.object({
  id: z.number({ message: TEXTS.validation.invalidIdFormat }),
  name: z.string().min(1, TEXTS.validation.categoryNameRequired),
});

// 기존 import 경로 호환 — category.api.ts 등이 이 경로에서 응답 타입을 가져간다.
export type { CategoryOption } from '@/entities/category/model/category.dto';
