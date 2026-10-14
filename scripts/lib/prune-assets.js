// 배포 후 S3에 쌓인 옛 해시 자산 중 지워도 되는 것을 고른다(scripts/prune-old-assets.js가 쓴다).
// 실제 S3 호출과 분리해 두어 선별 규칙만 단위 테스트로 고정한다(src/test/scripts/prune-assets.test.ts).
import dayjs from 'dayjs';

/**
 * 옛 자산을 이 기간만큼 남긴다 - 열린 탭이 옛 lazy 청크를 받을 시간(2026-10-14 사용자 결정, 7일).
 * 기준은 S3 업로드 시각, 즉 그 파일이 마지막으로 배포에 포함된 시각이다(배포마다 지금 빌드 파일을
 * 다시 올린다). 배포 간격이 7일을 넘으면 다음 배포 직후 직전 빌드 파일이 바로 대상이 된다.
 */
export const RETENTION_DAYS = 7;

/** 정리 대상 접두사. storybook/ 등 다른 워크플로가 올리는 파일은 건드리지 않는다 */
export const PRUNE_PREFIXES = ['assets/', 'fonts/'];

/**
 * 지워도 되는 객체 키를 고른다: 정리 대상 접두사이고, 지금 빌드(currentKeys)에 없고,
 * 마지막 업로드가 보존 기간보다 오래된 것.
 *
 * 날짜만 보지 않는 이유 - 배포는 지금 빌드 파일을 매번 다시 올려 업로드 시각을 갱신하지만, 어떤
 * 이유로 업로드를 건너뛴 파일이 있어도(예: sync --size-only) 지금 쓰는 파일은 지우지 않게 하는
 * 안전장치다. 지금 빌드에 있는 파일은 날짜와 상관없이 남긴다. 반대로 업로드를 건너뛴 옛 파일은
 * 빌드에서 빠지는 순간 바로 대상이 되므로, 정리 대상 접두사는 매 배포 다시 올려야 한다(deploy.yml).
 *
 * @param {{ Key: string, LastModified: string }[]} objects S3 list-objects-v2의 Contents
 * @param {Set<string>} currentKeys 지금 빌드의 dist/ 상대 경로(예: assets/js/index-abc.js)
 * @param {import('dayjs').ConfigType} now 기준 시각
 * @returns {string[]}
 */
export function selectPrunableKeys(objects, currentKeys, now) {
  const cutoff = dayjs(now).subtract(RETENTION_DAYS, 'day');

  return objects
    .filter(({ Key }) => PRUNE_PREFIXES.some((prefix) => Key.startsWith(prefix)))
    .filter(({ Key }) => !currentKeys.has(Key))
    .filter(({ LastModified }) => dayjs(LastModified).isBefore(cutoff))
    .map(({ Key }) => Key);
}
