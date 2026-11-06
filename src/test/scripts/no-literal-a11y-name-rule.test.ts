import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: mutation-retry-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noLiteralA11yNameRule } from '../../../scripts/lib/no-literal-a11y-name-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const oneError = [{ messageId: 'literalName' }];
const twoErrors = [{ messageId: 'literalName' }, { messageId: 'literalName' }];

ruleTester.run('no-literal-a11y-name', noLiteralA11yNameRule, {
  valid: [
    // TEXTS 참조·함수 호출·변수는 값을 알 수 없어 통과한다
    '<span aria-label={TEXTS.ariaLabels.close} />',
    '<span aria-label={TEXTS.ariaLabels.likeWithCount(count)} />',
    '<span aria-label={isOpen ? TEXTS.a : TEXTS.b} />',
    '<span aria-label={label} />',
    '<span className="sr-only">{TEXTS.ariaLabels.close}</span>',
    '<span className="sr-only">{isOpen ? TEXTS.a : TEXTS.b}</span>',
    // 글자가 없는 값은 이름을 적은 게 아니다
    '<span aria-label="" />',
    '<span className="sr-only">{`${count}`}</span>',
    // 조건식의 조건은 이름이 아니다
    "<span aria-label={state === 'met' ? TEXTS.a : TEXTS.b} />",
    '<span className="sr-only">{state === \'met\' ? TEXTS.a : TEXTS.b}</span>',
    // 어떤 때는 화면에 보이는 글자라 no-hardcoded-hangul의 몫이다
    '<span className="empty:sr-only">Message</span>',
    '<span className="max-md:sr-only">Home</span>',
    // sr-only가 아닌 요소, 자식이 글자가 아닌 요소
    '<span className="text-sm">Visible</span>',
    '<Spinner className="sr-only" />',
    '<span className="sr-only"><Icon /></span>',
    '<span className="sr-only"><b>{TEXTS.ariaLabels.close}</b></span>',
    '<span className="sr-only">{isOpen && <b>{TEXTS.ariaLabels.close}</b>}</span>',
    // 객체의 키가 sr-only가 아니다
    "<span className={cn({ 'text-sm': isHidden })}>Visible</span>",
    // 이름이 아닌 속성
    '<span data-label="Loading" />',
    // 규칙 범위 밖임을 고정한다(규칙 머리 주석의 한계)
    '<button title="Close" />',
    // alt는 값을 알 수 없거나 글자가 없으면 통과한다
    '<img alt="" />',
    '<img alt={post.title} />',
    '<img alt={TEXTS.ariaLabels.attachmentImageAt(index + 1)} />',
    "<img alt={nickname ?? ''} />",
    // 객체의 alt: 도 마찬가지이고, 계산된 키·다른 키는 이미지 이름이 아니다
    '({ src: url, alt: TEXTS.ariaLabels.attachmentImage });',
    "({ src: url, alt: nickname ?? '' });",
    "({ [alt]: 'attachment' });",
    "({ src: 'attachment' });",
  ],
  invalid: [
    { code: '<span aria-label="Loading" />', errors: oneError },
    { code: '<span aria-label="불러오는 중" />', errors: oneError },
    { code: "<span aria-label={'Close'} />", errors: oneError },
    { code: "<span aria-label={isOpen ? 'Hide' : TEXTS.show} />", errors: oneError },
    { code: "<span aria-label={isOpen ? 'Hide' : 'Show'} />", errors: twoErrors },
    { code: "<span aria-label={label || 'Fallback'} />", errors: oneError },
    { code: '<span aria-label={`Like ${count}`} />', errors: oneError },
    { code: "<span aria-label={`${isOpen ? 'Hide' : 'Show'} menu`} />", errors: 3 },
    { code: '<span className="sr-only">Close</span>', errors: oneError },
    { code: '<AlertDialogTitle className="sr-only">Alert</AlertDialogTitle>', errors: oneError },
    { code: '<span className="focus:not-sr-only sr-only">Skip</span>', errors: oneError },
    { code: "<span className={'sr-only'}>Close</span>", errors: oneError },
    { code: "<span className={cn('sr-only', extra)}>Close</span>", errors: oneError },
    { code: "<span className={isHidden ? 'sr-only' : ''}>Close</span>", errors: oneError },
    { code: "<span className={isHidden && 'sr-only'}>Close</span>", errors: oneError },
    { code: "<span className={cn({ 'sr-only': isHidden })}>Close</span>", errors: oneError },
    { code: '<span className="sr-only"><b>Close</b></span>', errors: oneError },
    { code: '<span className="sr-only">{isOpen && <b>Close</b>}</span>', errors: oneError },
    { code: '<span className="sr-only">{isOpen ? <b>Close</b> : null}</span>', errors: oneError },
    { code: '<span className="sr-only"><><b>{\'Close\'}</b></></span>', errors: oneError },
    { code: '<span className={`sr-only ${extra}`}>Close</span>', errors: oneError },
    { code: "<span className=\"sr-only\">{isOpen ? 'Hide' : 'Show'}</span>", errors: twoErrors },
    { code: '<img alt="attachment" />', errors: oneError },
    { code: '<img alt="첨부 이미지" />', errors: oneError },
    { code: '<img alt={`Pasted preview ${index + 1}`} />', errors: oneError },
    { code: "<img alt={isOpen ? 'Hide' : TEXTS.show} />", errors: oneError },
    { code: "({ src: url, alt: 'attachment' });", errors: oneError },
    { code: '({ src: url, alt: `Pasted preview ${index + 1}` });', errors: oneError },
  ],
});
