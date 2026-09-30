import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderWithProviders } from '@/test/utils';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { TEXTS } from '@/shared/config/texts';
import {
  passwordResetConfirmSchema,
  type PasswordResetConfirm,
} from '@/entities/auth/model/auth.schema';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';
import { PasswordRequirementList } from '@/entities/auth/ui/PasswordRequirementList';
import { PasswordConfirmMessage } from '@/entities/auth/ui/PasswordConfirmMessage';

const DEFAULT_VALUES: PasswordResetConfirm = { token: 'tok', newPassword: '', confirmPassword: '' };
const PW = 'Abcdef1!';

// 실제 폼(ConfirmPasswordResetForm.tsx)과 같은 연결 - 스키마도 실제 것을 쓴다
function Harness() {
  const form = useForm<PasswordResetConfirm>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });
  const feedback = usePasswordFieldsFeedback(form, {
    password: 'newPassword',
    confirm: 'confirmPassword',
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormInputPassword
          name="newPassword"
          label={TEXTS.labels.newPassword}
          {...feedback.passwordInputProps}
          belowInput={<PasswordRequirementList {...feedback.requirementListProps} />}
        />
        <FormInputPassword
          name="confirmPassword"
          label={TEXTS.labels.confirmPassword}
          {...feedback.confirmInputProps}
          belowInput={<PasswordConfirmMessage {...feedback.confirmMessageProps} />}
        />
        <p data-testid="rhf-confirm-error">{form.formState.errors.confirmPassword?.message}</p>
        <button type="submit">submit</button>
        <button type="button" onClick={() => form.reset(DEFAULT_VALUES)}>
          reset
        </button>
      </form>
    </FormProvider>
  );
}

const passwordInput = () => screen.getByLabelText(TEXTS.labels.newPassword);
const confirmInput = () => screen.getByLabelText(TEXTS.labels.confirmPassword);
const itemState = (label: string) => screen.getByText(label).closest('li')?.dataset.state;
const allItemStates = () =>
  Object.values(TEXTS.auth.password.requirements).map((label) => itemState(label));

describe('usePasswordFieldsFeedback', () => {
  it('처음엔 네 조건이 모두 회색이고 확인 칸 문구도 없다', () => {
    renderWithProviders(<Harness />);

    expect(allItemStates()).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(screen.queryByText(TEXTS.auth.password.confirmMatch)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();
  });

  it('입력 중엔 충족만 초록이 되고, 칸을 벗어난 뒤에야 못 채운 조건이 빨강이 된다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), 'ab1');
    expect(allItemStates()).toEqual(['pending', 'met', 'met', 'pending']);
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'false');

    await user.tab();
    expect(allItemStates()).toEqual(['unmet', 'met', 'met', 'unmet']);
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('빈 비밀번호 칸을 지나가기만 하면 빨강이 되지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(passwordInput());
    await user.tab();

    expect(allItemStates()).toEqual(['pending', 'pending', 'pending', 'pending']);
  });

  it('한글은 칸을 벗어나기 전이라도 바로 알리고, 특수문자로 치지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), 'ab1한');

    expect(screen.getByText(TEXTS.validation.passwordAsciiOnly)).toBeInTheDocument();
    expect(itemState(TEXTS.auth.password.requirements.special)).toBe('pending');
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('확인 칸은 짧은 동안 조용하다가 글자 수가 같아지면 판정하고, 불일치 뒤엔 고치는 동안 매 글자 판정한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), PW);
    await user.type(confirmInput(), 'Abcdef1');
    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();

    await user.type(confirmInput(), '?');
    expect(screen.getByText(TEXTS.validation.passwordMismatch)).toBeInTheDocument();
    expect(confirmInput()).toHaveAttribute('aria-invalid', 'true');

    // 지워서 다시 짧아져도 불일치를 계속 보여준다
    await user.type(confirmInput(), '{Backspace}');
    expect(screen.getByText(TEXTS.validation.passwordMismatch)).toBeInTheDocument();

    await user.type(confirmInput(), '!');
    expect(screen.getByText(TEXTS.auth.password.confirmMatch)).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();
  });

  it('확인 칸을 짧은 채로 벗어나면 불일치를 알린다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), PW);
    await user.type(confirmInput(), 'Abc');
    await user.tab();

    expect(screen.getByText(TEXTS.validation.passwordMismatch)).toBeInTheDocument();
  });

  it('빈 확인 칸을 지나간 뒤 다시 와서 첫 글자를 쳐도 바로 불일치가 뜨지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), PW);
    await user.click(confirmInput());
    await user.tab();
    await user.type(confirmInput(), 'A');

    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();
  });

  it('제출 전: 확인 칸 밖에서 비밀번호를 고쳐 두 값이 같아지면 바로 일치로 바뀐다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), PW);
    await user.type(confirmInput(), 'Abcdef1?');
    expect(screen.getByText(TEXTS.validation.passwordMismatch)).toBeInTheDocument();

    await user.clear(passwordInput());
    await user.type(passwordInput(), 'Abcdef1?');

    expect(screen.getByText(TEXTS.auth.password.confirmMatch)).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();
  });

  it('제출 후: 비밀번호만 고쳐도 확인 칸 문구와 RHF 에러가 함께 풀린다(L.L. Bean 사례 방지)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), PW);
    await user.type(confirmInput(), 'Abcdef1?');
    await user.click(screen.getByRole('button', { name: 'submit' }));
    expect(screen.getByTestId('rhf-confirm-error')).toHaveTextContent(
      TEXTS.validation.passwordMismatch
    );

    await user.clear(passwordInput());
    await user.type(passwordInput(), 'Abcdef1?');

    expect(screen.getByText(TEXTS.auth.password.confirmMatch)).toBeInTheDocument();
    expect(screen.getByTestId('rhf-confirm-error')).toBeEmptyDOMElement();
  });

  it('빈 채로 제출하면 두 칸 모두 입력 안내가 뜨고 네 조건이 모두 빨강이며, 문구는 한 번씩만 그린다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(allItemStates()).toEqual(['unmet', 'unmet', 'unmet', 'unmet']);
    // 비밀번호 칸 1 + 확인 칸 1 - FormField의 RHF 에러 문구는 숨겨져 겹치지 않는다
    // (하네스의 rhf-confirm-error 확인용 줄은 세지 않는다)
    const shown = screen
      .getAllByText(TEXTS.validation.passwordRequired)
      .filter((el) => el.dataset.testid !== 'rhf-confirm-error');
    expect(shown).toHaveLength(2);
    expect(screen.queryByText(TEXTS.validation.passwordRegex)).not.toBeInTheDocument();
  });

  it('form.reset 뒤엔 처음 상태로 돌아간다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(passwordInput(), 'ab1');
    await user.type(confirmInput(), 'x');
    await user.click(screen.getByRole('button', { name: 'submit' }));
    await user.click(screen.getByRole('button', { name: 'reset' }));

    expect(allItemStates()).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(screen.queryByText(TEXTS.validation.passwordMismatch)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTS.validation.passwordRequired)).not.toBeInTheDocument();
  });

  it('입력칸이 체크리스트와 문구 줄을 aria-describedby로 가리키고, 항목엔 스크린리더용 상태가 붙는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const describedBy = passwordInput().getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(describedBy).toHaveLength(2);
    expect(document.getElementById(describedBy[1] ?? '')?.tagName).toBe('UL');
    expect(confirmInput()).toHaveAttribute('aria-describedby');

    await user.type(passwordInput(), 'abcdefgh');
    const minLengthItem = screen
      .getByText(TEXTS.auth.password.requirements.minLength)
      .closest('li');
    expect(minLengthItem).toHaveTextContent(TEXTS.ariaLabels.passwordRequirementMet);
    const digitItem = screen.getByText(TEXTS.auth.password.requirements.digit).closest('li');
    expect(digitItem).toHaveTextContent(TEXTS.ariaLabels.passwordRequirementUnmet);
  });
});
