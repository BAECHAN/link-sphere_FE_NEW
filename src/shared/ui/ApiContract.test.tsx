import { createRef, type FunctionComponent, type ReactElement, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { render, waitFor } from '@/test/utils';
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/shared/ui/atoms/alert-dialog';
import { Avatar } from '@/shared/ui/atoms/avatar';
import { Dialog, DialogDescription, DialogTitle } from '@/shared/ui/atoms/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/atoms/select';
import { Tooltip, TooltipProvider, TooltipTrigger } from '@link-sphere/ui/atoms/tooltip';

// 공용 UI 부품이 ref·className·나머지 속성을 어디로 넘기는지 고정한다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4).
// - atoms: 폴더를 훑어 내보낸 부품을 모두 그린다. 표에 적지 않은 새 부품도 단독으로 그려 검사한다.
// - elements·layouts: 부품마다 약속을 표에 적는다. 표에 없는 부품이 생기면 실패한다.
// 이 파일의 두 표가 부품별 계약의 정본이다 - 문서에는 옮겨 적지 않는다.

const MARKER_CLASS = 'api-contract-class';
const MARKER_ATTRIBUTE = 'data-api-contract';

/** 부품마다 속성 모양이 달라, 계약에 쓰는 속성만 넘길 수 있는 느슨한 타입으로 다룬다 */
type Part = FunctionComponent<Record<string, unknown>>;

type Wrap = (part: ReactElement) => ReactElement;

interface RenderRecipe {
  /** 단독으로 그릴 수 없는 부품을 감싸는 부모 */
  wrap?: Wrap;
  /** 그리는 데 꼭 필요한 속성 */
  props?: Record<string, unknown>;
}

function isPart(name: string, value: unknown): value is Part {
  const isFunction = typeof value === 'function';
  // forwardRef·memo로 만든 부품은 함수가 아니라 $$typeof를 가진 객체다
  const isWrappedComponent = typeof value === 'object' && value !== null && '$$typeof' in value;

  return /^[A-Z]/.test(name) && (isFunction || isWrappedComponent);
}

function collectParts(modules: Record<string, Record<string, unknown>>): Map<string, Part> {
  const parts = new Map<string, Part>();

  for (const [path, exported] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(exported)) {
      if (!isPart(name, value)) {
        continue;
      }

      if (parts.has(name)) {
        throw new Error(`같은 이름으로 내보낸 부품이 둘입니다: ${name} (${path})`);
      }

      parts.set(name, value);
    }
  }

  return parts;
}

function renderAlone(part: ReactElement): ReactElement {
  return part;
}

function FormHarness({ children }: { children: ReactNode }) {
  const form = useForm({ defaultValues: { field: '' } });

  return <FormProvider {...form}>{children}</FormProvider>;
}

const inForm: Wrap = (part) => <FormHarness>{part}</FormHarness>;

const inAlertDialog: Wrap = (part) => <AlertDialog open>{part}</AlertDialog>;

const inDialog: Wrap = (part) => <Dialog open>{part}</Dialog>;

const inMenu: Wrap = (part) => (
  <DropdownMenu open>
    <DropdownMenuTrigger>menu</DropdownMenuTrigger>
    <DropdownMenuContent>{part}</DropdownMenuContent>
  </DropdownMenu>
);

const inSelect: Wrap = (part) => (
  <Select open>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>{part}</SelectContent>
  </Select>
);

const inTooltipProvider: Wrap = (part) => <TooltipProvider>{part}</TooltipProvider>;

// Radix는 제목·설명이 없는 창을 그리면 접근성 경고를 낸다
const DIALOG_LABELS = (
  <>
    <DialogTitle>title</DialogTitle>
    <DialogDescription>description</DialogDescription>
  </>
);

const ALERT_DIALOG_LABELS = (
  <>
    <AlertDialogTitle>title</AlertDialogTitle>
    <AlertDialogDescription>description</AlertDialogDescription>
  </>
);

const noop = () => {};

// ───────────────────────────── atoms ─────────────────────────────

const NO_OWN_ELEMENT = '자기 DOM 요소가 없다(상태나 포털만 맡는다)';

/** 계약 밖으로 뺀 atoms와 그 이유. 여기 없는 부품은 모두 검사한다 */
const ATOMS_OUTSIDE_CONTRACT: Record<string, string> = {
  AlertDialog: NO_OWN_ELEMENT,
  AlertDialogPortal: NO_OWN_ELEMENT,
  Dialog: NO_OWN_ELEMENT,
  DialogPortal: NO_OWN_ELEMENT,
  DropdownMenu: NO_OWN_ELEMENT,
  DropdownMenuPortal: NO_OWN_ELEMENT,
  DropdownMenuSub: NO_OWN_ELEMENT,
  Select: NO_OWN_ELEMENT,
  Tooltip: NO_OWN_ELEMENT,
  TooltipProvider: NO_OWN_ELEMENT,
  AvatarImage:
    'jsdom은 이미지를 받아 오지 않아 Radix가 img를 그리지 않는다(@radix-ui/react-avatar 1.3.1 dist/index.mjs:123)',
  SelectValue:
    'Radix 부품을 그대로 내보낸 것인데 Radix가 className을 받지 않는다(@radix-ui/react-select 2.4.1 dist/index.mjs:258)',
  SelectScrollUpButton:
    'jsdom에는 스크롤 위치가 없어 Radix가 그리지 않는다(@radix-ui/react-select 2.4.1 dist/index.mjs:1019)',
  SelectScrollDownButton:
    'jsdom에는 스크롤 위치가 없어 Radix가 그리지 않는다(@radix-ui/react-select 2.4.1 dist/index.mjs:1054)',
  LinkThumbnail:
    'className이 맨 바깥 요소가 아니라 img로 간다. 맨 바깥 요소로 옮기고 img용 속성을 따로 받기로 했고(2026-11-23, docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5) 별도 PR에서 고친다',
  Toaster:
    '맨 바깥 요소를 sonner가 그린다. 단위 테스트는 sonner를 toast만 남긴 가짜로 바꿔(src/test/setup.ts) 그릴 수도 없다',
};

/** 단독으로 그릴 수 없거나 필수 속성이 있는 atoms를 그리는 법 */
const ATOM_RECIPES: Record<string, RenderRecipe> = {
  AlertDialogTrigger: { wrap: inAlertDialog },
  AlertDialogOverlay: { wrap: inAlertDialog },
  AlertDialogContent: { wrap: inAlertDialog, props: { children: ALERT_DIALOG_LABELS } },
  AlertDialogTitle: { wrap: inAlertDialog },
  AlertDialogDescription: { wrap: inAlertDialog },
  AvatarFallback: { wrap: (part) => <Avatar>{part}</Avatar> },
  DialogTrigger: { wrap: inDialog },
  DialogClose: { wrap: inDialog },
  DialogOverlay: { wrap: inDialog },
  DialogContentPanel: { wrap: inDialog, props: { children: DIALOG_LABELS } },
  DialogContent: { wrap: inDialog, props: { children: DIALOG_LABELS } },
  DialogTitle: { wrap: inDialog },
  DialogDescription: { wrap: inDialog },
  DropdownMenuTrigger: { wrap: (part) => <DropdownMenu>{part}</DropdownMenu> },
  DropdownMenuContent: { wrap: (part) => <DropdownMenu open>{part}</DropdownMenu> },
  DropdownMenuGroup: { wrap: inMenu },
  DropdownMenuItem: { wrap: inMenu },
  DropdownMenuCheckboxItem: { wrap: inMenu },
  DropdownMenuRadioGroup: { wrap: inMenu },
  DropdownMenuRadioItem: {
    wrap: (part) => inMenu(<DropdownMenuRadioGroup>{part}</DropdownMenuRadioGroup>),
    props: { value: 'a' },
  },
  DropdownMenuLabel: { wrap: inMenu },
  DropdownMenuSeparator: { wrap: inMenu },
  DropdownMenuShortcut: { props: { children: 'K' } },
  DropdownMenuSubTrigger: { wrap: (part) => inMenu(<DropdownMenuSub>{part}</DropdownMenuSub>) },
  DropdownMenuSubContent: {
    wrap: (part) =>
      inMenu(
        <DropdownMenuSub open>
          <DropdownMenuSubTrigger>sub</DropdownMenuSubTrigger>
          {part}
        </DropdownMenuSub>
      ),
  },
  FeaturedIcon: { props: { icon: Info } },
  LabeledDivider: { props: { children: 'or' } },
  SelectTrigger: { wrap: (part) => <Select>{part}</Select> },
  SelectContent: {
    wrap: (part) => (
      <Select open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        {part}
      </Select>
    ),
  },
  SelectGroup: { wrap: inSelect },
  SelectLabel: { wrap: (part) => inSelect(<SelectGroup>{part}</SelectGroup>) },
  SelectItem: { wrap: inSelect, props: { value: 'a', children: 'A' } },
  SelectSeparator: { wrap: inSelect },
  TooltipTrigger: { wrap: (part) => inTooltipProvider(<Tooltip>{part}</Tooltip>) },
  TooltipContent: {
    wrap: (part) =>
      inTooltipProvider(
        <Tooltip open>
          <TooltipTrigger>trigger</TooltipTrigger>
          {part}
        </Tooltip>
      ),
    props: { children: 'tip' },
  },
};

// 공용 UI 패키지(packages/ui)로 옮긴 부품도 같은 표로 검사한다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5)
const ATOMS = collectParts(
  import.meta.glob<Record<string, unknown>>(
    [
      './atoms/*.tsx',
      '../../../packages/ui/src/atoms/*.tsx',
      '!./atoms/*.stories.tsx',
      '!./atoms/*.test.tsx',
      '!../../../packages/ui/src/atoms/*.stories.tsx',
      '!../../../packages/ui/src/atoms/*.test.tsx',
    ],
    { eager: true }
  )
);

describe('atoms의 API 계약', () => {
  it('표에 적은 이름은 모두 실제로 내보낸 부품이다', () => {
    const listed = [...Object.keys(ATOMS_OUTSIDE_CONTRACT), ...Object.keys(ATOM_RECIPES)];

    expect(listed.filter((name) => !ATOMS.has(name))).toEqual([]);
  });

  const inContract = [...ATOMS].filter(([name]) => !(name in ATOMS_OUTSIDE_CONTRACT));

  it.each(inContract)('%s: ref·className·나머지 속성이 같은 요소에 닿는다', (name, Atom) => {
    const { wrap = renderAlone, props } = ATOM_RECIPES[name] ?? {};
    const ref = createRef<Element>();

    render(wrap(<Atom {...props} ref={ref} className={MARKER_CLASS} data-api-contract="" />));

    const byClass = document.querySelector(`.${MARKER_CLASS}`);
    const byAttribute = document.querySelector(`[${MARKER_ATTRIBUTE}]`);

    // 무엇이 닿지 않았는지 실패 출력에 한 번에 보이게 셋을 함께 비교한다
    expect({
      ref: ref.current !== null,
      className: byClass !== null,
      rest: byAttribute !== null,
    }).toEqual({ ref: true, className: true, rest: true });
    expect(byClass).toBe(ref.current);
    expect(byAttribute).toBe(ref.current);
  });
});

// ─────────────────────── elements · layouts ───────────────────────

type Reach =
  /** 대상 요소로 간다 - 아래 테스트가 고정한다 */
  | 'target'
  /** 받기는 하지만 대상이 아닌 요소로 간다 - 지금 동작을 적어 둘 뿐 고정하지 않는다 */
  | 'elsewhere'
  /** 받지 않는다 */
  | 'none';

interface AssemblyContract extends RenderRecipe {
  ref: Reach;
  rest: Reach;
  className: Reach;
  /** 대상 요소를 찾는 CSS 선택자. 없으면 부품이 그린 맨 바깥 요소다 */
  target?: string;
  /** 부품이 스스로 정해, 쓰는 쪽이 넘겨도 바뀌지 않는 속성과 그 값 */
  fixed?: Record<string, string>;
}

const ALL_TO_TARGET = { ref: 'target', rest: 'target', className: 'target' } as const;
const CLASS_NAME_ONLY = { ref: 'none', rest: 'none', className: 'target' } as const;
const NOTHING = { ref: 'none', rest: 'none', className: 'none' } as const;

/**
 * elements·layouts가 약속하는 것. 조립 부품은 여기 적힌 것만 약속한다 - 필요가 생기면 그 줄과 코드를 함께 바꾼다.
 */
const ASSEMBLY_CONTRACTS: Record<string, AssemblyContract> = {
  // 버튼·입력·창 패널 하나를 감싼 부품 - 셋 다 대상 요소로 간다
  ActionButton: {
    ...ALL_TO_TARGET,
    props: { label: 'label', onClick: noop },
    fixed: { type: 'button' },
  },
  ActionChip: {
    ...ALL_TO_TARGET,
    props: { label: 'label', onClick: noop },
    fixed: { type: 'button' },
  },
  EditButton: {
    ...ALL_TO_TARGET,
    props: { label: 'label', onClick: noop },
    fixed: { type: 'button', 'aria-label': 'label', title: 'label' },
  },
  FilterChip: {
    ...ALL_TO_TARGET,
    props: { label: 'label', isActive: false, onClick: noop, activeClassName: '' },
    fixed: { type: 'button', 'aria-pressed': 'false' },
  },
  ToggleButton: ALL_TO_TARGET,
  PasswordInput: { ...ALL_TO_TARGET, target: 'input' },
  SearchInput: { ...ALL_TO_TARGET, target: 'input' },
  SheetDialogContent: {
    ...ALL_TO_TARGET,
    target: '[role="dialog"]',
    wrap: inDialog,
    props: { isMobile: false, children: DIALOG_LABELS },
  },

  // 조립 부품 - className만 맨 바깥 요소로 간다
  CenteredSpinner: { ...CLASS_NAME_ONLY, props: { delay: 0 } },
  CharacterCount: { ...CLASS_NAME_ONLY, props: { current: 0, max: 10 } },
  DelayedFallback: { ...CLASS_NAME_ONLY, props: { delay: 0, children: 'loading' } },
  EmptyState: { ...CLASS_NAME_ONLY, props: { children: 'empty' } },
  ErrorState: { ...CLASS_NAME_ONLY, props: { children: 'error' } },
  FormAlert: { ...CLASS_NAME_ONLY, props: { children: 'alert' } },
  FormCheckbox: { ...CLASS_NAME_ONLY, wrap: inForm, props: { name: 'field', label: 'label' } },
  FormField: { ...CLASS_NAME_ONLY, wrap: inForm, props: { name: 'field' } },
  LoadMoreError: { ...CLASS_NAME_ONLY, props: { onRetry: noop } },
  MarkdownContent: { ...CLASS_NAME_ONLY, props: { content: 'text' } },
  TooltipWrapper: {
    ...CLASS_NAME_ONLY,
    wrap: inTooltipProvider,
    props: { content: 'tip', disabled: false, children: 'text' },
  },

  // className은 맨 바깥 요소로, 나머지 속성은 안쪽 입력 요소로 간다
  FormInput: {
    ref: 'none',
    rest: 'elsewhere',
    className: 'target',
    wrap: inForm,
    props: { name: 'field' },
  },
  FormInputPassword: {
    ref: 'none',
    rest: 'elsewhere',
    className: 'target',
    wrap: inForm,
    props: { name: 'field' },
  },

  // className이 맨 바깥 요소가 아니라 열렸을 때만 있는 메뉴(포털)로 간다
  KebabMenu: { ref: 'none', rest: 'none', className: 'elsewhere' },

  // 셋 다 받지 않는다
  AppErrorFallback: NOTHING,
  AsyncBoundary: NOTHING,
  AuthLayout: NOTHING,
  BackToTopButton: NOTHING,
  DropTargetOverlay: NOTHING,
  ErrorLayout: NOTHING,
  FormCheckboxGroup: NOTHING,
  GlobalAlertDialogs: NOTHING,
  GlobalImageViewer: NOTHING,
  ImageAttachmentButton: { ...NOTHING, props: { count: 0, maxCount: 1, onAttach: noop } },
  ImageAttachmentPreviews: { ...NOTHING, props: { previewUrls: ['blob:a'], onRemove: noop } },
  ImageViewer: NOTHING,
  RouteAlertDialogs: NOTHING,
};

const ASSEMBLIES = collectParts(
  import.meta.glob<Record<string, unknown>>(
    [
      './elements/**/*.tsx',
      './layouts/**/*.tsx',
      '../../../packages/ui/src/elements/**/*.tsx',
      '!./**/*.stories.tsx',
      '!./**/*.test.tsx',
      '!../../../packages/ui/src/**/*.stories.tsx',
      '!../../../packages/ui/src/**/*.test.tsx',
    ],
    { eager: true }
  )
);

describe('elements·layouts의 API 계약', () => {
  it('내보낸 부품이 모두 표에 있고, 표에는 없는 부품이 남아 있지 않다', () => {
    const exported = [...ASSEMBLIES.keys()].sort();

    expect(Object.keys(ASSEMBLY_CONTRACTS).sort()).toEqual(exported);
  });

  const promisingSomething = Object.entries(ASSEMBLY_CONTRACTS).filter(([, contract]) =>
    [contract.ref, contract.rest, contract.className].includes('target')
  );

  it.each(promisingSomething)('%s: 표에 적은 대로 대상 요소에 닿는다', async (name, contract) => {
    const Assembly = ASSEMBLIES.get(name) as Part;
    const { wrap = renderAlone, props, target: targetSelector } = contract;
    const promised = {
      ref: contract.ref === 'target',
      className: contract.className === 'target',
      rest: contract.rest === 'target',
    };
    const ref = createRef<Element>();
    // 약속한 것만 넘긴다 - 받지 않는 부품에 ref를 넘기면 React가 경고를 낸다
    const markers = {
      ...(promised.ref && { ref }),
      ...(promised.className && { className: MARKER_CLASS }),
      ...(promised.rest && { [MARKER_ATTRIBUTE]: '' }),
    };

    const { container } = render(wrap(<Assembly {...props} {...markers} />));

    // 지연 뒤에 나타나는 부품(CenteredSpinner·DelayedFallback)이 있어 기다린다
    const target = await waitFor(() => {
      const found = targetSelector
        ? document.querySelector(targetSelector)
        : container.firstElementChild;

      if (!found) {
        throw new Error(`대상 요소를 찾지 못했습니다: ${targetSelector ?? '맨 바깥 요소'}`);
      }

      return found;
    });

    expect({
      ref: ref.current === target,
      className: target.classList.contains(MARKER_CLASS),
      rest: target.hasAttribute(MARKER_ATTRIBUTE),
    }).toEqual(promised);
  });

  const fixingAttributes = Object.entries(ASSEMBLY_CONTRACTS).filter(([, contract]) =>
    Boolean(contract.fixed)
  );

  // 하이픈이 든 속성(aria-label 등)은 타입에서 빼도 JSX에서 타입 오류가 나지 않는다.
  // 덮어쓰기를 막는 것은 나머지 속성을 먼저 펼치는 순서라 그 순서를 여기서 고정한다
  it.each(fixingAttributes)(
    '%s: 스스로 정한 속성은 넘겨받은 값으로 바뀌지 않는다',
    (name, contract) => {
      const Assembly = ASSEMBLIES.get(name) as Part;
      const { wrap = renderAlone, props, fixed = {} } = contract;
      const attributes = Object.keys(fixed);
      const attempts = Object.fromEntries(attributes.map((attribute) => [attribute, 'overridden']));

      const { container } = render(wrap(<Assembly {...props} {...attempts} />));

      const target = container.firstElementChild;
      const actual = Object.fromEntries(
        attributes.map((attribute) => [attribute, target?.getAttribute(attribute)])
      );

      expect(actual).toEqual(fixed);
    }
  );
});
