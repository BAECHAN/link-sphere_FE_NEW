Add BE 응답 타입(생성 타입 alias)과, 필요하면 Zod 요청/폼 검증 스키마를 새 엔티티에 추가한다.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <entity-name>`

Examples: `post tag`, `member address`, `notification setting`

Parse:

- Domain: first word
- Entity: remaining words (kebab-case → PascalCase for type names)

## 이 레포의 규약 — 응답 타입과 요청 검증을 분리한다

> **응답 DTO = BE OpenAPI 스펙에서 생성된 타입(`*.dto.ts`) / 요청·폼 검증 = Zod(`*.schema.ts`)**

과거엔 서버 응답 형태를 Zod로 손으로 옮겨적었다. 지금은 BE가 springdoc으로 공개하는
OpenAPI 스펙에서 `openapi-typescript`로 타입을 생성하고(`src/shared/api/generated/openapi.gen.ts`),
엔티티별 `.dto.ts`가 거기에 도메인 이름만 붙인다 — 손으로 옮겨적다 BE와 어긋나는 사고를
구조적으로 막기 위해서다(상세 배경: `docs/OPENAPI-CODEGEN.md`).

Zod는 **응답 파싱에 쓰지 않는다** — `apiClient`가 이미 제네릭 `T`로 받은 값을 그대로
반환하고, 어디서도 응답에 `.parse()`/`safeParse()`를 걸지 않는다. Zod는 오직
**사용자 입력**(생성/수정 폼, 검색 필터 등) 검증에만 쓴다.

## Before creating files

1. `pnpm codegen:fetch && pnpm codegen`을 돌려 `src/shared/api/generated/openapi.gen.ts`가
   최신인지 확인한다(BE에 새 엔드포인트/DTO가 이미 배포돼 있어야 한다)
2. `src/shared/api/generated/openapi.json`에서 이 엔티티의 BE 스키마 이름을 확인한다:
   `jq '.components.schemas | keys[]' src/shared/api/generated/openapi.json | grep -i <entity>`
3. 참고 파일: `src/entities/post/model/post.dto.ts`(override 2건 포함 — 가장 완전한 예시),
   `src/entities/category/model/category.dto.ts`(override 없는 가장 단순한 예시)

## File 1 — `src/entities/<entity>/model/<entity>.dto.ts` (응답 타입, 항상 만든다)

```typescript
import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
export type <Entity> = components['schemas']['<BE스키마이름>Response'];
```

BE의 nullable이 스펙에 정확히 반영 안 되는 경우(원시 타입 프로퍼티는 대부분 정확하지만,
`$ref`로 참조되는 중첩 객체 프로퍼티는 실측상 안 됨 — `docs/OPENAPI-CODEGEN.md` §시행착오
참고)나, BE가 enum class가 아니라 String을 써서 스펙에 enum이 안 실리는 경우, `Omit` +
intersection으로 override한다. 반드시 **BE 소스 파일:줄과 실제 런타임 확인 결과를 근거로
남긴다**(추측으로 좁히지 않는다):

```typescript
// role: BE가 enum class가 아니라 String으로 선언해(AuthDTO.kt:37) 스펙에 enum이 실리지
// 않는다. BE를 enum class로 바꾸기 전까지 FE에서 좁힌다.
export type Account = Omit<components['schemas']['AccountResponse'], 'role'> & {
  role: 'USER' | 'ADMIN';
};
```

재귀 타입(댓글 답글 등)이나 목록 응답의 `content`/`items` 필드에 override가 필요하면,
`Omit`은 최상위 키만 제외할 뿐 중첩 타입까지 다시 쓰지 않는다는 걸 기억한다 — 그 필드도
같이 override해야 한다(`src/entities/comment/model/comment.dto.ts`의 `replies`,
`src/entities/post/model/post.dto.ts`의 `content` 참고).

## File 2 — `src/entities/<entity>/model/<entity>.schema.ts` (요청·폼 검증, 필요할 때만)

생성/수정 폼이나 검색 필터처럼 **사용자 입력을 검증**해야 할 때만 만든다. 순수 조회
전용 엔티티(예: category)라면 이 파일은 필요 없다 — `.dto.ts`의 타입을 그대로 쓴다.

```typescript
import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

export const create<Entity>Schema = z.object({
  name: z.string().min(1, TEXTS.validation.nameRequired),
});

export type Create<Entity> = z.infer<typeof create<Entity>Schema>;
```

## Conventions to follow

- 응답 타입은 **절대** Zod로 손으로 옮겨적지 않는다 — `.dto.ts`에서 생성 타입을 alias한다
- `z.coerce.date()`를 쓰지 않는다 — BE 응답의 날짜 필드는 전부 ISO 문자열이고
  (`createdAt: string`), `apiClient`가 파싱하지 않으므로 실제 런타임도 문자열이다.
  표시할 때는 `dayjs(value)`나 `DateUtil`을 쓴다
- Zod의 `.nullable()`/`.optional()` 구분은 **폼 필드에만** 적용한다 — 응답 필드의
  null/undefined 여부는 생성 타입이 이미 스펙대로 표현한다
- override는 반드시 근거 주석(BE 파일:줄, 실측 결과)을 남긴다 — 이유 없이 좁히지 않는다
- 기존 엔티티에 필드를 추가하는 경우, `.schema.ts`가 이미
  `export type { <Entity> } from './<entity>.dto'`로 재수출하고 있다면 소비 파일의
  import 경로는 그대로 둔다(엔티티를 새로 만드는 경우는 소비 파일이 아직 없으므로
  `.dto.ts`를 직접 import해도 된다)

## Next steps

After creating the files, run:
`/add-entity-api <domain> <entity>` — to create the .api.ts, .keys.ts, and .queries.ts files
