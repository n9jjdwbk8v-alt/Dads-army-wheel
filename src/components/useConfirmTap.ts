import { useEffect, useState } from 'react';

/**
 * Two-tap confirmation for destructive buttons: the first tap arms a key, a second tap on the same key confirms.
 * It disarms itself after a few seconds. Popups like confirm() are blocked in some Home Screen apps and
 * embedded previews, so the check happens in the page instead.
 */
export const useConfirmTap = (ms = 4000) => {
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);

  /** Arms `key`, or returns true if it was already armed. */
  const tap = (key: string) => {
    if (armed === key) {
      setArmed(null);
      return true;
    }
    setArmed(key);
    return false;
  };

  return [armed, tap] as const;
};
