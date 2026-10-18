import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { randomInt, type Player } from '../lib/draft';
import './Wheel.css';

export type WheelHandle = {
  /** Spins to a random slice and resolves with the player it lands on. */
  spin: (durationMs?: number) => Promise<Player>;
};

type WheelProps = {
  players: Player[];
  showSkill: boolean;
  ref?: Ref<WheelHandle>;
};

const SLICE_COLORS = [
  { fill: '#0f5132', text: '#ffffff' },
  { fill: '#ffffff', text: '#0f5132' },
  { fill: '#2e9e5b', text: '#ffffff' },
  { fill: '#dff3e6', text: '#0f5132' }
];

const R = 100;

const polar = (deg: number, r: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [R + r * Math.cos(rad), R + r * Math.sin(rad)];
};

const slicePath = (start: number, end: number) => {
  const [x1, y1] = polar(start, R - 2);
  const [x2, y2] = polar(end, R - 2);
  const large = end - start > 180 ? 1 : 0;
  return `M ${R} ${R} L ${x1} ${y1} A ${R - 2} ${R - 2} 0 ${large} 1 ${x2} ${y2} Z`;
};

const shortName = (name: string) => (name.length > 13 ? `${name.slice(0, 12)}…` : name);

export default function Wheel({ players, showSkill, ref }: WheelProps) {
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const rotationRef = useRef(0);
  const spinningRef = useRef(false);

  const seg = 360 / Math.max(players.length, 1);

  useImperativeHandle(
    ref,
    () => ({
      spin: (durationMs = 4200) =>
        new Promise<Player>((resolve, reject) => {
          if (spinningRef.current || !players.length) return reject(new Error('busy'));
          spinningRef.current = true;
          setWinner(null);

          const index = randomInt(players.length);
          const centre = index * seg + seg / 2;
          const jitter = (Math.random() - 0.5) * seg * 0.7;
          const current = rotationRef.current;
          // Land the chosen slice's centre (plus a little jitter) under the top pointer.
          const offset = (((-centre + jitter - current) % 360) + 360) % 360;
          const turns = durationMs > 2500 ? 6 : 3;
          const target = current + turns * 360 + offset;

          rotationRef.current = target;
          setDuration(durationMs);
          setRotation(target);

          window.setTimeout(() => {
            spinningRef.current = false;
            setWinner(players[index].id);
            resolve(players[index]);
          }, durationMs + 60);
        })
    }),
    [players, seg]
  );

  return (
    <div className="wheel">
      <div className="wheel__pointer" aria-hidden />
      <svg
        className="wheel__disc"
        viewBox={`0 0 ${R * 2} ${R * 2}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transitionDuration: `${duration}ms`
        }}
        role="img"
        aria-label={`Wheel with ${players.map(p => p.name).join(', ')}`}
      >
        <circle cx={R} cy={R} r={R} fill="#0f5132" />
        {players.length === 1 ? (
          <circle cx={R} cy={R} r={R - 2} fill={SLICE_COLORS[0].fill} />
        ) : (
          players.map((p, i) => {
            const c = SLICE_COLORS[i % SLICE_COLORS.length];
            return (
              <path
                key={p.id}
                d={slicePath(i * seg, (i + 1) * seg)}
                fill={c.fill}
                stroke="#0f5132"
                strokeWidth={0.6}
                className={winner === p.id ? 'wheel__slice wheel__slice--win' : 'wheel__slice'}
              />
            );
          })
        )}
        {players.map((p, i) => {
          const c = SLICE_COLORS[i % SLICE_COLORS.length];
          const mid = i * seg + seg / 2;
          return (
            <g key={p.id} transform={`rotate(${mid - 90} ${R} ${R})`}>
              <text
                x={R + R * 0.56}
                y={R}
                fill={c.text}
                className="wheel__label"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {shortName(p.name)}
                {showSkill && <tspan className="wheel__skill"> {p.skill}</tspan>}
              </text>
            </g>
          );
        })}
        <circle cx={R} cy={R} r={16} fill="#ffffff" stroke="#0f5132" strokeWidth={3} />
        <text x={R} y={R} className="wheel__hub" textAnchor="middle" dominantBaseline="central">
          DA
        </text>
      </svg>
    </div>
  );
}
