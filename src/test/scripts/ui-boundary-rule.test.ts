import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: mutation-retry-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noAppImportInGenericUiRule } from '../../../scripts/lib/ui-boundary-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const CONST_SOURCE = '@/shared/config/const';
const CONST_ALLOWED = 'LOADING_INDICATOR_DELAY_MS, DOUBLE_CLICK_GUARD_MS';
const memberError = {
  messageId: 'member',
  data: { name: 'CommonUtil', allowed: 'CommonUtil.commaizeNumber' },
};

// RuleTester는 data를 주면 메시지의 자리표시자를 모두 채워 비교한다
function nameError(source: string, name: string, allowed: string) {
  return { messageId: 'name', data: { source, name, allowed } };
}

ruleTester.run('no-app-import-in-generic-ui', noAppImportInGenericUiRule, {
  valid: [
    // 외부 패키지와 공용 UI 안의 파일
    "import { useState } from 'react';",
    "import { X } from 'lucide-react';",
    "import { Button } from '@/shared/ui/atoms/button';",
    "import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';",
    // 공용 UI 패키지(packages/ui)도 앱 밖 패키지다 - 패키지로 옮긴 보조 모듈은 허용 목록에서 빠졌다
    "import { cn } from '@link-sphere/ui/lib/tailwind/utils';",
    "import { toast } from '@link-sphere/ui/lib/toast/toast';",
    // 통째로 허용한 보조 모듈
    "import { useMergedRef } from '@/shared/hooks/useMergedRef';",
    "import { ScrollUtil } from '@/shared/utils/scroll.util';",
    // 이름 단위로 허용한 것
    "import { LOADING_INDICATOR_DELAY_MS, DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';",
    "import { DOUBLE_CLICK_GUARD_MS as GUARD_MS } from '@/shared/config/const';",
    "import type { SelectOptionType } from '@/shared/types/common.type';",
    "import { CommonUtil } from '@/shared/utils/common.util'; CommonUtil.commaizeNumber(1);",
    "import { CommonUtil as Util } from '@/shared/utils/common.util'; const text = <p>{Util.commaizeNumber(count)}</p>;",
    // 이름이 비슷한 다른 패키지는 라우터가 아니다
    "import { something } from 'react-router-like';",
    // 경로를 알 수 없는 동적 import, 다시 내보내지 않는 export
    'const module = await import(path);',
    'export const value = 1;',
    "export { Button } from '@/shared/ui/atoms/button';",
  ],
  invalid: [
    // 앱 문구
    {
      code: "import { TEXTS } from '@/shared/config/texts';",
      errors: [{ messageId: 'module', data: { source: '@/shared/config/texts' } }],
    },
    // 타입 전용 import도 본다
    {
      code: "import type { ApiError } from '@/shared/types/api.type';",
      errors: [{ messageId: 'module' }],
    },
    // 허용 목록에 없는 훅·스토어·상위 레이어
    {
      code: "import { useBackClosableOverlay } from '@/shared/hooks/useBackClosableOverlay';",
      errors: [{ messageId: 'module' }],
    },
    {
      code: "import { useAuthStore } from '@/shared/store/auth.store';",
      errors: [{ messageId: 'module' }],
    },
    {
      code: "import { UiTextsProvider } from '@/app/providers/UiTextsProvider';",
      errors: [{ messageId: 'module' }],
    },
    // 허용한 경로와 앞부분만 같은 경로
    {
      code: "import { helper } from '@/shared/hooks/useMergedRef-extra';",
      errors: [{ messageId: 'module' }],
    },
    // 라우터
    {
      code: "import { Link } from 'react-router-dom';",
      errors: [{ messageId: 'router', data: { source: 'react-router-dom' } }],
    },
    {
      code: "import type { Location } from 'react-router';",
      errors: [{ messageId: 'router' }],
    },
    { code: "import { x } from 'react-router-dom/server';", errors: [{ messageId: 'router' }] },
    // 이름 단위로 허용한 파일의 다른 이름
    {
      code: "import { LOADING_INDICATOR_DELAY_MS, STALE_TIME } from '@/shared/config/const';",
      errors: [nameError(CONST_SOURCE, 'STALE_TIME', CONST_ALLOWED)],
    },
    {
      code: "import type { SelectOptionType, ApiResponse } from '@/shared/types/common.type';",
      errors: [nameError('@/shared/types/common.type', 'ApiResponse', 'SelectOptionType')],
    },
    // 파일 전체를 가져오는 import
    {
      code: "import * as constants from '@/shared/config/const';",
      errors: [nameError(CONST_SOURCE, '*', CONST_ALLOWED)],
    },
    {
      code: "import constants from '@/shared/config/const';",
      errors: [nameError(CONST_SOURCE, '*', CONST_ALLOWED)],
    },
    // 허용한 클래스의 다른 멤버, 클래스를 통째로 넘기는 자리
    {
      code: "import { CommonUtil } from '@/shared/utils/common.util'; CommonUtil.formatDate(value);",
      errors: [memberError],
    },
    {
      code: "import { CommonUtil } from '@/shared/utils/common.util'; CommonUtil['formatDate'](value);",
      errors: [memberError],
    },
    {
      code: "import { CommonUtil } from '@/shared/utils/common.util'; const util = CommonUtil;",
      errors: [memberError],
    },
    {
      code: "import { CommonUtil } from '@/shared/utils/common.util'; CommonUtil.commaizeNumber(1); CommonUtil.formatDate(value);",
      errors: [memberError],
    },
    // 동적 import와 다시 내보내기로 돌아가는 길
    {
      code: "const texts = await import('@/shared/config/texts');",
      errors: [{ messageId: 'module' }],
    },
    {
      code: "export { TEXTS } from '@/shared/config/texts';",
      errors: [{ messageId: 'module' }],
    },
    {
      code: "export type * from '@/shared/types/api.type';",
      errors: [{ messageId: 'module' }],
    },
    { code: "export * from 'react-router-dom';", errors: [{ messageId: 'router' }] },
    {
      code: "export { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';",
      errors: [nameError(CONST_SOURCE, '*', CONST_ALLOWED)],
    },
  ],
});
