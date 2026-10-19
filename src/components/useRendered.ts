import { useEffect, useRef, useState } from 'react';

type Rendered = { key: string; blob: Blob; url: string };

/** Renders a blob whenever `key` changes (while enabled), keeping an object URL for it alive until replaced. */
export const useRendered = (key: string, enabled: boolean, render: () => Promise<Blob>) => {
  const [out, setOut] = useState<Rendered | null>(null);
  const renderRef = useRef(render);
  const urlRef = useRef('');
  useEffect(() => {
    renderRef.current = render;
  });
  useEffect(() => () => URL.revokeObjectURL(urlRef.current), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    renderRef.current().then(blob => {
      if (cancelled) return;
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setOut({ key, blob, url: urlRef.current });
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);
  return out;
};
