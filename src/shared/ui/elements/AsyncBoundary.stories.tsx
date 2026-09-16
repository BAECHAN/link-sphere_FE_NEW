import type { Meta, StoryObj } from '@storybook/react';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';

// A component that suspends forever (simulates loading state)
const neverResolve = new Promise<never>(() => {});

function AlwaysLoading(): never {
  throw neverResolve;
}

// A component that throws on render (simulates error state)
function AlwaysError(): never {
  throw new Error('Something went wrong while fetching data.');
}

// A component that renders successfully
function SuccessContent() {
  return (
    <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
      Content loaded successfully!
    </div>
  );
}

const meta = {
  title: 'Shared/UI/Elements/AsyncBoundary',
  component: AsyncBoundary,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[200px] w-full border border-dashed border-muted-foreground rounded-lg p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    children: <></>,
  },
} satisfies Meta<typeof AsyncBoundary>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AsyncBoundary>
      <SuccessContent />
    </AsyncBoundary>
  ),
};

export const Loading: Story = {
  render: () => (
    <AsyncBoundary loadingFallback={<p className="text-muted-foreground">Loading...</p>}>
      <AlwaysLoading />
    </AsyncBoundary>
  ),
};

export const LoadingDefault: Story = {
  render: () => (
    <AsyncBoundary>
      <AlwaysLoading />
    </AsyncBoundary>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <AsyncBoundary>
      <AlwaysError />
    </AsyncBoundary>
  ),
};

export const CustomErrorFallback: Story = {
  render: () => (
    <AsyncBoundary
      errorFallback={({ error, resetErrorBoundary }) => (
        // destructive/10 틴트 배경 위에서는 text-destructive가 4:1로 WCAG AA
        // (4.5:1) 미달이었다(2026-09-16 a11y 게이트 실측) - 틴트를 걷어내고
        // 일반 배경 위 테두리로 바꾸니 4.76:1로 통과한다(직접 계산 확인).
        <div className="p-4 rounded-lg border">
          <p className="text-destructive font-medium">
            Custom error: {error instanceof Error ? error.message : String(error)}
          </p>
          <button onClick={resetErrorBoundary} className="mt-2 text-sm text-destructive underline">
            Try again
          </button>
        </div>
      )}
    >
      <AlwaysError />
    </AsyncBoundary>
  ),
};
