// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(manual-check.js와 함께 고친다)
export const LABEL: string;
export const STATUS_MARKER: string;
export const MIN_OBSERVATION_LENGTH: number;
export const REQUIRED_SECTIONS: { name: string; hint: string }[];

export interface ManualCheckStep {
  number: number;
  action: string;
  expectation: string;
  toRecord: string;
}

export interface ManualCheckComment {
  body: string | null;
  url: string;
  authorAssociation: string;
  userType: string;
}

export interface ManualCheckAnswer {
  number: number;
  verdict: '통과' | '실패';
  observation: string;
  build: string | null;
  url: string;
}

export interface ManualCheckEvaluation {
  status: 'malformed' | 'incomplete' | 'failed' | 'passed';
  bodyProblems: string[];
  steps: ManualCheckStep[];
  requiredBuild: string | null;
  answers: (ManualCheckAnswer | null)[];
  rejected: { url: string; reason: string }[];
  missing: number[];
  failed: number[];
}

export interface ManualCheckEvent {
  name: string;
  action: string;
  state: 'open' | 'closed';
  labelRemoved: boolean;
}

export interface ManualCheckActions {
  reopen: boolean;
  close: boolean;
  noteUnlabeled: boolean;
  updateStatus: boolean;
}

export function parseIssueBody(body: string | null | undefined): {
  problems: string[];
  requiredBuild: string | null;
  steps: ManualCheckStep[];
};
export function evaluateIssue(input: {
  body: string | null | undefined;
  comments: ManualCheckComment[];
  checkBuild: (typed: string, required: string) => string | null;
  checkRequiredBuild?: (required: string) => string | null;
}): ManualCheckEvaluation;
export function decideActions(
  evaluation: ManualCheckEvaluation,
  event: ManualCheckEvent
): ManualCheckActions;
export function renderStatusComment(
  evaluation: ManualCheckEvaluation,
  actions: ManualCheckActions,
  docsUrl?: string
): string;
export function renderUnlabeledNote(evaluation: ManualCheckEvaluation): string;
