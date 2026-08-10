type NavigateFn = (
  to: string,
  options?: { replace?: boolean; state?: unknown; preventScrollReset?: boolean }
) => void;

let _navigate: NavigateFn = (to) => {
  window.location.href = to;
};

export const NavigationService = {
  setNavigate(fn: NavigateFn) {
    _navigate = fn;
  },
  navigate(
    to: string,
    options?: { replace?: boolean; state?: unknown; preventScrollReset?: boolean }
  ) {
    _navigate(to, options);
  },
};
