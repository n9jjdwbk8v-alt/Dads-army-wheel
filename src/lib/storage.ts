import { useEffect, useState } from 'react';

export const usePersistentState = <T,>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked (private mode) — the app still works for this session.
    }
  }, [key, value]);

  return [value, setValue] as const;
};
