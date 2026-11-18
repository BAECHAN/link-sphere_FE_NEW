// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(doc-index.js와 함께 고친다)
export interface DecisionEntry {
  date: string;
  title: string;
  key: string;
  anchor: string;
  status: string;
}

export interface PlanEntry {
  fileName: string;
  date: string;
  title: string;
  result: { prs: string[]; deviations: number; missing: number } | null;
  superseded: string;
}

export function toHeadingAnchor(heading: string, seen: Map<string, number>): string;
export function parseDecisions(markdown: string): DecisionEntry[];
export function findUnclassified(
  entries: DecisionEntry[],
  topics: Record<string, string>
): string[];
export function renderDecisionIndex(
  entries: DecisionEntry[],
  topics: Record<string, string>
): string;
export function parsePlan(fileName: string, markdown: string): PlanEntry | null;
export function renderPlanIndex(plans: PlanEntry[]): string;
