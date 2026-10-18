import { useMemo } from 'react';
import Noise from './reactbits/Noise';
import { CAMO_PALETTES, camoTile } from '../lib/camo';
import './Backdrop.css';

/** Fixed woodland-camo page background. */
export default function Backdrop() {
  const tile = useMemo(() => camoTile('woodland').toDataURL('image/png'), []);
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
