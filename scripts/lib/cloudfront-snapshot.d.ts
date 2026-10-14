// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(cloudfront-snapshot.js와 함께 고친다)
export const SNAPSHOT_PATH: string;
export const FUNCTION_NAME_PREFIX: string;
export function findS3BucketNames(distributionConfig: {
  Origins?: { Items?: { DomainName: string }[] };
}): string[];
export function maskSensitive<T>(
  value: T,
  secrets?: { bucketNames?: string[]; distributionId?: string }
): T;
export function normalizeDistributionConfig(
  distributionConfig: Record<string, unknown>
): Record<string, unknown>;
export function summarizeWebAcl(webAcl: Record<string, unknown>): {
  Name: string;
  DefaultAction: unknown;
  Rules: unknown[];
};
export function buildSnapshot(input: {
  distributionId: string;
  distributionConfig: Record<string, unknown>;
  cachePolicies: Record<string, unknown>;
  originRequestPolicies: Record<string, unknown>;
  functions: {
    Name: string;
    EventType: string;
    Runtime: string;
    Comment: string;
    RepoFile: string | null;
    CodeMatchesRepo: boolean;
  }[];
  webAcl: Record<string, unknown> | null;
}): Record<string, unknown>;
export function diffSnapshots(expected: unknown, actual: unknown, path?: string): string[];
