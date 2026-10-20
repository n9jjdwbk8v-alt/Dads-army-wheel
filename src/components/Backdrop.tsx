import { useMemo } from 'react';
import Noise from './reactbits/Noise';
import { CAMO_PALETTES, camoTile } from '../lib/camo';
import './Backdrop.css';

/** Fixed woodland-camo page background. */
export default function Backdrop() {
  // The tile shows 420px across, drawn at the screen's own sharpness (up to 3×).
  const tile = useMemo(() => {
    const scale = (420 / 480) * Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    return camoTile('woodland', scale).toDataURL('image/png');
  }, []);
  return (
    <div className="backdrop" aria-hidden>
      <div
        className="backdrop__camo"
        style={{ backgroundImage: `url(${tile})`, backgroundColor: CAMO_PALETTES.woodland[1] }}
      />
      <Noise opacity={0.07} blendMode="overlay" fps={0} />
      <div className="backdrop__shade" />
    </div>
  );
}
