import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.

// 실제 런타임은 Jackson JsonInclude.ALWAYS라 lastUsedAt 키는 항상 있고 값이 null로 온다 —
// bookmark-folder.util.ts의 `!== null` 가드가 그걸 전제한다. 아래 재선언은 스펙에 nullable이
// 없던 때(springdoc이 Kotlin nullable을 required 여부로만 반영) FE 타입을 런타임에 맞게
// 넓히려고 둔 것이다. 지금은 스펙도 nullable: true를 표기해(openapi.json의 FolderResponse)
// 생성 타입이 이미 `lastUsedAt?: string | null`이라 재선언과 같은 모양이다(제거해도 무방하지만
// 유지 — docs/OPENAPI-CODEGEN.md §11).
export type BookmarkFolder = Omit<components['schemas']['FolderResponse'], 'lastUsedAt'> & {
  lastUsedAt?: string | null;
};

export type BookmarkFolderListResponse = Omit<
  components['schemas']['FolderListResponse'],
  'folders'
> & {
  folders: BookmarkFolder[];
};

export type BookmarkFoldersResponse = components['schemas']['BookmarkFoldersResponse'];
