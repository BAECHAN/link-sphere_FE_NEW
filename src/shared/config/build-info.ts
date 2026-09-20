/**
 * 이 번들이 빌드된 커밋. vite.config.ts의 define(__BUILD_INFO__)으로 빌드타임에 박힌다 -
 * "지금 이 탭이 실행 중인 코드"를 뜻하며, 새로고침 전까지 바뀌지 않는다.
 * 서버에 지금 올라가 있는 빌드는 /version.json이 따로 답한다(BuildInfoUtil 참고).
 *
 * builtAt·runNumber는 여기 없다 - 그 값들은 빌드마다 달라져서 번들에 박으면
 * 무변경 재배포에도 entry 청크 해시가 바뀌고, useAppVersionCheck가 이를
 * 새 배포로 오판해 열려 있던 탭을 전부 리로드한다.
 *
 * typeof 가드가 필요하다: vitest.config.ts에는 이 define이 없어 테스트 실행 시
 * __BUILD_INFO__가 ReferenceError로 터진다. 프로덕션 빌드에서는 esbuild가
 * typeof 분기를 접어 오버헤드가 없다.
 */
const BUILD_INFO: { sha: string; ref: string; mode: string } =
  typeof __BUILD_INFO__ === 'undefined'
    ? { sha: 'unknown', ref: 'unknown', mode: 'test' }
    : __BUILD_INFO__;

export { BUILD_INFO };
