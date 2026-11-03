import { describe, it, expect, vi } from 'vitest';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { renderWithProviders } from '@/test/utils';
import { FormInput } from '@/shared/ui/elements/form/FormInput';

// FormInput은 자체 useForm 없이 useFormContext로만 동작하므로, 실제 폼을 흉내 낸
// 최소 harness로 감싼다 - 선례: PostCreateBookmarkFolderField.test.tsx의 Harness 패턴.
function Harness({ required }: { required?: boolean }) {
  const form = useForm({ defaultValues: { url: '' } });

  return (
    <FormProvider {...form}>
      <FormInput name="url" label="URL" required={required} />
    </FormProvider>
  );
}

// 폼이 값을 watch하지 않을 때 입력칸이 몇 번 다시 커밋되는지 센다. Profiler의 onRender는 감싼 트리 안의
// 컴포넌트가 커밋할 때마다 불린다(https://react.dev/reference/react/Profiler)
function ProfiledHarness({
  onRender,
  enableClear,
}: {
  onRender: ProfilerOnRenderCallback;
  enableClear?: boolean;
}) {
  const form = useForm({ defaultValues: { url: '' } });

  return (
    <FormProvider {...form}>
      <Profiler id="form-input" onRender={onRender}>
        <FormInput name="url" label="URL" enableClear={enableClear} />
      </Profiler>
    </FormProvider>
  );
}

const requiredUrlSchema = z.object({ url: z.string().min(1, 'required') });

// 제출·reset·setValue·dirty를 함께 보는 harness - 루트가 isDirty를 읽어 리렌더되므로 커밋 수는 여기서 세지 않는다
function SubmitHarness({ enableClear }: { enableClear?: boolean }) {
  const form = useForm({
    resolver: zodResolver(requiredUrlSchema),
    defaultValues: { url: '' },
    mode: 'onSubmit',
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormInput name="url" label="URL" enableClear={enableClear} />
        <p data-testid="dirty">{String(form.formState.isDirty)}</p>
        <button type="button" onClick={() => form.reset({ url: 'https://reset.example' })}>
          reset
        </button>
        <button type="button" onClick={() => form.setValue('url', 'https://set.example')}>
          set
        </button>
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  );
}

describe('FormInput', () => {
  it('required가 true이면 라벨 옆에 aria-hidden 필수 표시(*)가 붙고 input에 required 속성이 붙는다', () => {
    const { container } = renderWithProviders(<Harness required />);

    const mark = container.querySelector('[aria-hidden="true"]');
    expect(mark).toHaveTextContent('*');

    const input = screen.getByRole('textbox', { name: 'URL' });
    expect(input).toBeRequired();
  });

  it('필수 표시가 aria-hidden이라 접근 가능한 이름은 마커 없이 라벨 그대로 유지된다', () => {
    renderWithProviders(<Harness required />);

    expect(screen.getByRole('textbox', { name: 'URL' })).toBeInTheDocument();
  });

  it('required가 없으면 필수 표시도 없고 input도 required가 아니다', () => {
    const { container } = renderWithProviders(<Harness />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'URL' })).not.toBeRequired();
  });

  it('폼이 값을 watch하지 않으면 입력해도 FormInput이 다시 커밋되지 않는다', async () => {
    const user = userEvent.setup();
    const onRender = vi.fn();
    renderWithProviders(<ProfiledHarness onRender={onRender} />);
    const commitsAfterMount = onRender.mock.calls.length;

    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'abc');

    expect(onRender.mock.calls.length - commitsAfterMount).toBe(0);
  });

  it('reset·setValue로 바꾼 값이 입력칸에 보인다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitHarness />);
    const input = screen.getByRole('textbox', { name: 'URL' });

    await user.click(screen.getByRole('button', { name: 'reset' }));
    expect(input).toHaveValue('https://reset.example');

    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(input).toHaveValue('https://set.example');
  });

  it('검증에 실패한 채 제출하면 그 입력칸에 포커스가 간다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitHarness />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('required')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'URL' })).toHaveFocus());
  });

  describe('enableClear', () => {
    // dirty는 기본값('')과 다른지로 정해진다 - 비우면 글자를 다 지운 것처럼 false로 다시 계산돼야 한다
    // (값만 바꾸는 setValue였다면 true가 남는다)
    it('입력하면 지우기 버튼이 보이고, 누르면 칸이 비워져 dirty가 다시 계산되며 버튼이 사라진다', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubmitHarness enableClear />);
      const input = screen.getByRole('textbox', { name: 'URL' });

      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

      await user.type(input, 'abc');
      expect(screen.getByTestId('dirty')).toHaveTextContent('true');

      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(input).toHaveValue('');
      expect(screen.getByTestId('dirty')).toHaveTextContent('false');
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('여러 글자를 입력해도 빈칸에서 값이 생길 때 한 번만 다시 커밋된다', async () => {
      const user = userEvent.setup();
      const onRender = vi.fn();
      renderWithProviders(<ProfiledHarness onRender={onRender} enableClear />);
      const commitsAfterMount = onRender.mock.calls.length;

      await user.type(screen.getByRole('textbox', { name: 'URL' }), 'abc');

      expect(onRender.mock.calls.length - commitsAfterMount).toBe(1);
    });

    // onSubmit 폼은 제출 전에 검증하지 않는다 - setValue의 shouldValidate처럼 바로 검증하면 여기서 에러가 뜬다
    it('제출하기 전에 지우기 버튼으로 비우면, 글자를 지울 때처럼 에러를 띄우지 않는다', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubmitHarness enableClear />);
      const input = screen.getByRole('textbox', { name: 'URL' });

      await user.type(input, 'abc');
      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(input).toHaveValue('');
      expect(screen.queryByText('required')).not.toBeInTheDocument();
    });

    it('제출한 뒤 필수 칸을 지우기 버튼으로 비우면, 글자를 지울 때처럼 바로 다시 검증된다', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubmitHarness enableClear />);

      await user.type(screen.getByRole('textbox', { name: 'URL' }), 'abc');
      await user.click(screen.getByRole('button', { name: 'submit' }));
      expect(screen.queryByText('required')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(await screen.findByText('required')).toBeInTheDocument();
    });
  });
});
