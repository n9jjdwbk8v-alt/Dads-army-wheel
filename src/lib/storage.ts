import { useEffect, useState } from 'react';

/** State saved to this phone. `revive` checks or upgrades what was saved before, falling back to `initial`. */
export const usePersistentState = <T,>(key: string, initial: T, revive?: (stored: unknown) => T | undefined) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const stored: unknown = JSON.parse(raw);
      return revive ? (revive(stored) ?? initial) : (stored as T);
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
