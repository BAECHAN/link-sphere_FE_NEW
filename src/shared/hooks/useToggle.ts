import { useCallback, useState } from 'react';

export function useToggle(initialValue: boolean = false) {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setValue(false);
  }, []);

  const open = useCallback(() => {
    setValue(true);
  }, []);

  return { value, toggle, close, open, setValue };
}
