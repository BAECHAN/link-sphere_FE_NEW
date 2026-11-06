// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(no-literal-a11y-name-rule.js와 함께 고친다)
import type { Rule } from 'eslint';

export const noLiteralA11yNameRule: Rule.RuleModule;
