import { z } from 'zod';

export const categoryOptionSchema = z.object({
  id: z.number({ message: '유효하지 않은 ID 형식입니다.' }),
  name: z.string().min(1, '카테고리 이름을 입력해주세요.'),
  slug: z.string().min(1, '카테고리 슬러그를 입력해주세요.'),
  sortOrder: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;
