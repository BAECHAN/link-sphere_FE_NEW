import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { ChangePasswordForm } from '@/features/auth/password-change/ui/ChangePasswordForm';

// 로그인이 필요한 화면이라 브라우저 녹화로 확인하지 못해(2026-09-30), 체크리스트·확인 칸이
// 이 폼의 JSX에 실제로 연결됐는지를 렌더링으로 확인한다 - 판정 자체는
// usePasswordFieldsFeedback.test.tsx가 다룬다. 제출하지 않으므로 네트워크 요청은 없다.
const itemState = (label: string) => screen.getByText(label).closest('li')?.dataset.state;

describe('ChangePasswordForm', () => {
  it('새 비밀번호 칸에만 조건 체크리스트가 붙고, 입력하는 대로 충족으로 바뀐다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm />);

    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(itemState(TEXTS.auth.password.requirements.letter)).toBe('pending');

    await user.type(screen.getByLabelText(`${TEXTS.labels.newPassword}*`), 'ab1');

    expect(itemState(TEXTS.auth.password.requirements.letter)).toBe('met');
    expect(itemState(TEXTS.auth.password.requirements.digit)).toBe('met');
  });

  it('확인 칸이 새 비밀번호와 같아지면 일치 문구가 뜬다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm />);

    await user.type(screen.getByLabelText(`${TEXTS.labels.newPassword}*`), 'Abcdef1!');
    await user.type(screen.getByLabelText(`${TEXTS.labels.confirmPassword}*`), 'Abcdef1!');

    expect(screen.getByText(TEXTS.auth.password.confirmMatch)).toBeInTheDocument();
  });
});
