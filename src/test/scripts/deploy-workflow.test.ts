import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// FE 버킷의 og-thumbnails/는 BE가 쓰는 곳이다(줄인 og:image 사본, docs/plans/2026-11-25-og-thumbnail.md).
// 배포의 --delete 동기화가 이 접두사를 빼지 않으면 배포할 때마다 사본이 전부 지워진다.
const OG_THUMBNAILS_EXCLUDE = '--exclude "og-thumbnails/*"';

/** deploy.yml에서 `--delete`가 붙은 `aws s3 sync` 명령을 줄 이음(`\`)을 풀어 한 줄씩 돌려준다 */
function deletingSyncCommands(workflow: string): string[] {
  return workflow
    .replace(/\\\n\s*/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('aws s3 sync') && line.includes('--delete'));
}

describe('deploy.yml S3 업로드', () => {
  const workflow = readFileSync(
    path.resolve(__dirname, '../../../.github/workflows/deploy.yml'),
    'utf8'
  );
  const commands = deletingSyncCommands(workflow);

  it('--delete 동기화가 하나 이상 있다(없으면 아래 검사가 아무것도 보지 않는다)', () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  it('--delete 동기화는 모두 og-thumbnails/를 지우지 않는다', () => {
    for (const command of commands) {
      expect(command).toContain(OG_THUMBNAILS_EXCLUDE);
    }
  });
});
