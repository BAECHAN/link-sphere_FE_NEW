import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { renderWithProviders } from '@/test/utils';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';

const schema = z
  .object({ password: z.string().min(1, 'required'), confirm: z.string() })
  .refine((data) => data.password === data.confirm, { message: 'mismatch', path: ['confirm'] });

// 선례: FormInput.test.tsx의 Harness 패턴
function Harness({
  withDeps = true,
  hideConfirmError = false,
  onConfirmBlur,
}: {
  withDeps?: boolean;
  hideConfirmError?: boolean;
  onConfirmBlur?: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onSubmit',
  });
  const isConfirmTouched = form.getFieldState('confirm', form.formState).isTouched;

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormInputPassword name="password" label="pw" deps={withDeps ? ['confirm'] : undefined} />
        <FormInputPassword
          name="confirm"
          label="confirm"
          hideErrorMessage={hideConfirmError}
          onBlur={onConfirmBlur}
          belowInput={<p>below</p>}
        />
        <p data-testid="confirm-touched">{String(isConfirmTouched)}</p>
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  );
}

describe('FormInputPassword', () => {
  it('deps로 이은 필드는 제출 후 이 칸이 바뀌면 함께 다시 검증된다(확인 칸 에러가 남지 않는다)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByLabelText('pw'), 'abc');
    await user.type(screen.getByLabelText('confirm'), 'abd');
    await user.click(screen.getByRole('button', { name: 'submit' }));
    expect(await screen.findByText('mismatch')).toBeInTheDocument();

    // 확인 칸은 건드리지 않고 위 칸만 고쳐 두 값을 맞춘다
    await user.clear(screen.getByLabelText('pw'));
    await user.type(screen.getByLabelText('pw'), 'abd');

    expect(screen.queryByText('mismatch')).not.toBeInTheDocument();
  });

  it('deps가 없으면 위 칸을 고쳐도 확인 칸 에러가 남는다(deps가 막는 기존 동작)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness withDeps={false} />);

    await user.type(screen.getByLabelText('pw'), 'abc');
    await user.type(screen.getByLabelText('confirm'), 'abd');
    await user.click(screen.getByRole('button', { name: 'submit' }));
    await user.clear(screen.getByLabelText('pw'));
    await user.type(screen.getByLabelText('pw'), 'abd');

    expect(screen.getByText('mismatch')).toBeInTheDocument();
  });

  it('hideErrorMessage면 에러 문구는 그리지 않지만 에러 테두리와 belowInput은 그대로다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness hideConfirmError />);

    await user.type(screen.getByLabelText('pw'), 'abc');
    await user.type(screen.getByLabelText('confirm'), 'abd');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(screen.queryByText('mismatch')).not.toBeInTheDocument();
    expect(screen.getByLabelText('confirm')).toHaveClass('border-destructive');
    expect(screen.getByText('below')).toBeInTheDocument();
  });

  it('onBlur를 넘겨도 RHF touched 처리가 유지되고 넘긴 핸들러도 불린다', async () => {
    const user = userEvent.setup();
    const onConfirmBlur = vi.fn();
    renderWithProviders(<Harness onConfirmBlur={onConfirmBlur} />);

    await user.click(screen.getByLabelText('confirm'));
    await user.tab();

    expect(onConfirmBlur).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm-touched')).toHaveTextContent('true');
  });
});
