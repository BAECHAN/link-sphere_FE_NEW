# Frontend Architecture Documentation

## 1. React Query Configuration

### `queryClient.ts`

The application uses a centralized `QueryClient` instance configured in `src/shared/lib/react-query/config/queryClient.ts`.

#### Global Configuration

- **Stale Time**: 3 minutes (`3 * 60 * 1000`)
- **GC Time**: 5 minutes (`5 * 60 * 1000`)
- **Retry**: 1 retry on failure
- **Refetch**: On window focus and mount

## 2. Error Handling Strategy

The application implements a layered error handling strategy to balance user experience and developer control.

### Global Error Handling

Global error handlers are defined in `mutationCache` and `queryCache` within `queryClient.ts`.

- **API Errors (`ApiError`)**:
  - Automatically logged to the console with detailed error data.
  - Displays a generic "Server Error" message to the user via toast notification for security and UX consistency.
- **Unknown Errors**:
  - Logged to the console.
  - Displays a generic error message via toast.

### Manual Error Handling (`manualErrorHandling`)

There are cases where a specific feature requires custom error handling logic (e.g., form validation errors from the server that need to set form focus). In these cases, you can bypass the global error handler.

#### How to Use

Add `manualErrorHandling: true` to the `meta` option of your mutation or query.

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: {
    manualErrorHandling: true, // Disables global toast error
  },
  onError: (error) => {
    // Implement custom error handling logic here
    if (error instanceof ApiError && error.status === 409) {
      form.setError('email', { message: 'Already exists' });
    }
  },
});
```

### Custom Error Messages

You can also provide a custom error message via `meta` without disabling the global handler entirely.

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: {
    errorMessage: 'Failed to update profile. Please try again.',
  },
});
```

## 3. Toast Notifications (Sonner)

The application uses [Sonner](https://sonner.emilkowal.ski/) for toast notifications, integrated with the global error handling system.

- **System Errors**: Automatically triggered by the global error handler.
- **Success Messages**: Can be automatically triggered by adding `successMessage` to `meta`.

```typescript
const { mutate } = useMutation({
  mutationFn: updateProfile,
  meta: {
    successMessage: 'Profile updated successfully!',
  },
});
```
