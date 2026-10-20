import { useCallback, useEffect, useRef, useState } from 'react';
import bgUrl from '../assets/chomp/bg.svg';
import darkUrl from '../assets/chomp/dark.svg';
import behindStickUrl from '../assets/chomp/behind-stick.svg';
import headUrl from '../assets/chomp/head.svg';
import stickUrl from '../assets/chomp/stick.svg';
import jawUrl from '../assets/chomp/jaw.svg';
import lettersUrl from '../assets/chomp/letters.svg';
import outlineHeadUrl from '../assets/chomp/outline-head.svg';
import outlineJawUrl from '../assets/chomp/outline-jaw.svg';
import outlineMouthUrl from '../assets/chomp/outline-mouth.svg';
import outlineStickUrl from '../assets/chomp/outline-stick.svg';
import './ChompLogo.css';

// The logo is 467 x 520 units; every layer below fills that box, so moves are given in those units.
const W = 467;
const H = 520;

const DURATION = 2100;
/** When the jaw slams shut, as a fraction of the run. */
const CHOMP = 0.26;

type Pose = { at: number; r?: number; dx?: number; dy?: number; sx?: number; sy?: number; easing?: string };

const SMOOTH = 'cubic-bezier(0.45, 0, 0.55, 1)';
const SLAM = 'cubic-bezier(0.6, 0, 1, 0.6)';
const RECOIL = 'cubic-bezier(0, 0.6, 0.4, 1)';

const keyframes = (poses: Pose[]): Keyframe[] =>
  poses.map(({ at, r = 0, dx = 0, dy = 0, sx = 1, sy = 1, easing = SMOOTH }) => ({
    offset: at,
    easing,
    transform: `translate(${(dx / W) * 100}%, ${(dy / H) * 100}%) rotate(${r}deg) scale(${sx}, ${sy})`
  }));

// Skull, beret and their yellow outline, pivoting at the neck.
const HEAD = keyframes([
  { at: 0 },
  { at: 0.11, r: -3, dy: -4 },
  { at: 0.21, r: -5, dy: -8, sx: 0.99, sy: 1.02, easing: SLAM },
  { at: CHOMP, r: 1.5, dy: 4, sx: 1.04, sy: 0.96, easing: RECOIL },
  { at: 0.31, r: 0.5, dy: 1, sx: 1.01, sy: 0.99 },
  { at: 0.38, r: 2 },
  { at: 0.48, r: -2 },
  { at: 0.58, r: 2 },
  { at: 0.66 },
  { at: 0.74, r: -1, dy: -1 },
  { at: 0.84, r: 0.3 },
  { at: 1 }
]);

// The jaw hinges at the back, then slides side to side for the grind.
const JAW_POSES: Pose[] = [
  { at: 0 },
  { at: 0.11, r: 3, dy: 5 },
  { at: 0.21, r: 7, dy: 10, easing: SLAM },
  { at: CHOMP, r: -1.5, dy: -2, easing: RECOIL },
  { at: 0.31 },
  { at: 0.38, r: 1.5, dx: -3, dy: 3 },
  { at: 0.48, r: 1.5, dx: 3, dy: 3 },
  { at: 0.58, r: 1.5, dx: -3, dy: 3 },
  { at: 0.66 },
  { at: 1 }
];
const JAW = keyframes(JAW_POSES);

// The dark inside of the mouth fills the gap as the jaw drops, and slides sideways with it in the grind.
// The stick is held in the teeth, so it simply moves with the jaw.
const MOUTH = keyframes(JAW_POSES.map(({ at, dx, easing }) => ({ at, dx, easing })));

type Shard = { x: number; y: number; angle: number; dist: number; spin: number; size: number; delay: number };

// Splinters burst from both corners of the mouth on the chomp; two crumbs drop during the grind.
const MOUTH_L = { x: 198, y: 352 };
const MOUTH_R = { x: 292, y: 338 };
const SHARDS: Shard[] = [
  { ...MOUTH_R, angle: -10, dist: 70, spin: 220, size: 1, delay: 0 },
  { ...MOUTH_L, angle: 195, dist: 64, spin: -260, size: 1, delay: 0 },
  { ...MOUTH_R, angle: 25, dist: 58, spin: -180, size: 0.85, delay: 20 },
  { ...MOUTH_L, angle: 160, dist: 76, spin: 200, size: 0.9, delay: 15 },
  { ...MOUTH_R, angle: 45, dist: 50, spin: 300, size: 0.7, delay: 35 },
  { ...MOUTH_L, angle: 215, dist: 52, spin: -320, size: 0.75, delay: 30 },
  { ...MOUTH_R, angle: -35, dist: 46, spin: 160, size: 0.65, delay: 45 },
  { ...MOUTH_L, angle: 120, dist: 24, spin: 140, size: 0.55, delay: (0.48 - CHOMP) * DURATION },
  { ...MOUTH_R, angle: 70, dist: 22, spin: -150, size: 0.5, delay: (0.58 - CHOMP) * DURATION }
];

// Short impact strokes either side of the head.
const IMPACTS = [
  { x: 112, y: 330, angles: [155, 180, 205] },
  { x: 358, y: 350, angles: [-25, 0, 25] }
].flatMap(({ x, y, angles }) => angles.map(angle => ({ x, y, angle })));

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The header logo. Once its layers are ready it bites the stick when the app opens and on every tap. */
const ChompLogo = () => {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const rigRef = useRef<HTMLSpanElement>(null);
  const notchRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);

  // Only swap the still logo for the moving one once every layer has loaded and decoded, so it never
  // shows half drawn. If any layer fails, the still logo simply stays.
  useEffect(() => {
    let cancelled = false;
    const layers = [...(rigRef.current?.querySelectorAll('img') ?? [])];
    Promise.all(layers.map(img => img.decode()))
      .then(() => !cancelled && layers.length > 0 && setReady(true))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const play = useCallback(() => {
    if (!ready || playing || reduceMotion()) return;
    setPlaying(true);
  }, [ready, playing]);

  // Runs the animations once the effect layers for this run are in the page.
  useEffect(() => {
    if (!playing) return;
    const notch = notchRef.current;
    const fx = fxRef.current;
    const rig = rigRef.current;
    if (!notch || !fx || !rig || typeof notch.animate !== 'function') {
      setPlaying(false);
      return;
    }
    const unit = rig.clientWidth / W;
    const chompAt = CHOMP * DURATION;
    // The yellow outline and the pieces are two copies of the same rig, moved in step.
    const move = (selector: string, frames: Keyframe[]) =>
      [...rig.querySelectorAll<HTMLElement>(selector)].map(el => el.animate(frames, { duration: DURATION }));
    const anims: Animation[] = [
      ...move('.chomp__head', HEAD),
      ...move('.chomp__jaw', JAW),
      ...move('.chomp__mouth', MOUTH),
      notch.animate(
        [
          { opacity: 0 },
          { opacity: 0, offset: CHOMP },
          { opacity: 1, offset: CHOMP + 0.01 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0 }
        ],
        { duration: DURATION }
      )
    ];
    fx.querySelectorAll<HTMLElement>('.chomp__shard').forEach((el, i) => {
      const s = SHARDS[i];
      const t = (s.angle * Math.PI) / 180;
      const x = Math.cos(t) * s.dist * unit;
      const y = Math.sin(t) * s.dist * unit;
      const fall = 46 * unit;
      anims.push(
        el.animate(
          [
            { transform: `translate(-50%, -50%) scale(${0.4 * s.size})`, opacity: 0 },
            { transform: `translate(calc(-50% + ${x * 0.15}px), calc(-50% + ${y * 0.15}px)) scale(${0.6 * s.size})`, opacity: 1, offset: 0.05, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' },
            { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${s.spin * 0.5}deg) scale(${s.size})`, opacity: 1, offset: 0.4, easing: 'cubic-bezier(0.5, 0, 1, 1)' },
            { transform: `translate(calc(-50% + ${x * 1.25}px), calc(-50% + ${y + fall}px)) rotate(${s.spin}deg) scale(${s.size})`, opacity: 0 }
          ],
          { duration: 760, delay: chompAt + s.delay, fill: 'both' }
        )
      );
    });
    fx.querySelectorAll<HTMLElement>('.chomp__impact').forEach((el, i) => {
      const { angle } = IMPACTS[i];
      anims.push(
        el.animate(
          [
            { transform: `rotate(${angle}deg) translateX(${2 * unit}px) scaleX(0.2)`, opacity: 0 },
            { transform: `rotate(${angle}deg) translateX(${6 * unit}px) scaleX(1)`, opacity: 1, offset: 0.3 },
            { transform: `rotate(${angle}deg) translateX(${22 * unit}px) scaleX(0.3)`, opacity: 0 }
          ],
          { duration: 300, delay: chompAt, easing: 'ease-out', fill: 'both' }
        )
      );
    });
    let live = true;
    Promise.all(anims.map(a => a.finished))
      .catch(() => undefined)
      .then(() => live && setPlaying(false));
    return () => {
      live = false;
      anims.forEach(a => a.cancel());
    };
  }, [playing]);

  // Bite once when the app opens.
  useEffect(() => {
    if (!ready || reduceMotion()) return;
    const timer = window.setTimeout(() => setPlaying(true), 600);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <button type="button" className={`hero__logo chomp${ready ? ' is-ready' : ''}`} aria-label="Dads Army" onClick={play}>
      <img className="chomp__still" src="./logo.svg" alt="" width={W} height={H} />
      <span className="chomp__rig" ref={rigRef} aria-hidden="true">
        <img className="chomp__layer" src={bgUrl} alt="" />
        {/* The yellow outline sits behind every piece and moves with each one, so it always wraps the
            whole figure and never splits where the pieces part. */}
        <span className="chomp__part chomp__head">
          <img className="chomp__layer" src={outlineHeadUrl} alt="" />
          <span className="chomp__part chomp__mouth">
            <img className="chomp__layer" src={outlineMouthUrl} alt="" />
          </span>
          <span className="chomp__part chomp__jaw">
            <span className="chomp__stick">
              <img className="chomp__layer" src={outlineStickUrl} alt="" />
            </span>
            <img className="chomp__layer" src={outlineJawUrl} alt="" />
          </span>
        </span>
        <span className="chomp__part chomp__head">
          <img className="chomp__layer" src={behindStickUrl} alt="" />
          <span className="chomp__part chomp__mouth">
            <img className="chomp__layer" src={darkUrl} alt="" />
          </span>
          <img className="chomp__layer" src={headUrl} alt="" />
          <span className="chomp__part chomp__jaw">
            <span className="chomp__stick">
              <img className="chomp__layer" src={stickUrl} alt="" />
              <span className="chomp__notch" ref={notchRef}>
                <svg viewBox="0 0 14 8">
                  <path d="M1 1l4 5 4-5 3 4" fill="none" stroke="#253a2d" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <img className="chomp__layer" src={jawUrl} alt="" />
          </span>
        </span>
        <span className="chomp__fx" ref={fxRef}>
          {playing &&
            SHARDS.map((s, i) => (
              <span key={`s${i}`} className="chomp__shard" style={{ left: pct(s.x, W), top: pct(s.y, H) }}>
                <svg viewBox="-16 -6 32 12">
                  <path d="M-13 -4.5L13 -1L10 4L-11 3Z" fill="#deeadd" stroke="#253a2d" strokeWidth="3" strokeLinejoin="round" />
                </svg>
              </span>
            ))}
          {playing &&
            IMPACTS.map((m, i) => (
              <span key={`i${i}`} className="chomp__impact" style={{ left: pct(m.x, W), top: pct(m.y, H) }} />
            ))}
        </span>
        <img className="chomp__layer" src={lettersUrl} alt="" />
      </span>
    </button>
  );
};

export default ChompLogo;
