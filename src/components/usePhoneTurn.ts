import { useEffect, useLayoutEffect, useState } from 'react';

/** A phone on its side (short and touch-driven); tablets and computers are left to rotate as normal. */
const SIDEWAYS = '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

/** Which way the phone has been turned, as far as the content goes: 'left' means its top is now on the left. */
type Turn = 'left' | 'right' | null;

const readTurn = (): Turn => {
  if (!matchMedia(SIDEWAYS).matches) return null;
  // iPhones report window.orientation (90 = turned anticlockwise, -90 = clockwise); others the screen angle.
  const legacy = (window as { orientation?: number }).orientation;
  const angle = typeof legacy === 'number' ? legacy : (screen.orientation?.angle ?? 90);
  return angle === -90 || angle === 270 ? 'right' : 'left';
};

/**
 * Keeps the app upright against the phone when it's turned sideways, as if rotation were locked: iPhones don't
 * let web apps lock it, so the page is turned back the other way (see the [data-turn] styles). While turned,
 * the app scrolls inside .spark-root, and the scroll position carries over both ways. Returns whether it's
 * turned.
 */
export const usePhoneTurn = () => {
  const [turn, setTurn] = useState<Turn>(readTurn);

  useEffect(() => {
    const update = () => setTurn(readTurn());
    const query = matchMedia(SIDEWAYS);
    query.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    screen.orientation?.addEventListener?.('change', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      screen.orientation?.removeEventListener?.('change', update);
    };
  }, []);

  useLayoutEffect(() => {
    if (!turn) return;
    const html = document.documentElement;
    const page = document.querySelector<HTMLElement>('.spark-root');
    // Read the position before turning: turning stops the page itself scrolling, which resets it.
    let top = window.scrollY;
    html.dataset.turn = turn;
    if (page) page.scrollTop = top;
    // Track the position as it scrolls: by the time this cleans up, the page may already have stopped being a
    // scroller (the styles switch as soon as the phone is upright) and lost it.
    const track = () => {
      if (html.dataset.turn) top = page?.scrollTop ?? top;
    };
    page?.addEventListener('scroll', track, { passive: true });
    return () => {
      page?.removeEventListener('scroll', track);
      delete html.dataset.turn;
      window.scrollTo(0, top);
    };
  }, [turn]);

  return turn !== null;
};
