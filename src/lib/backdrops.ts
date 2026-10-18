export type BackdropKind = 'woodland' | 'digital' | 'radar' | 'topo';

export const BACKDROPS: { value: BackdropKind; label: string }[] = [
  { value: 'woodland', label: 'Woodland' },
  { value: 'digital', label: 'Digital' },
  { value: 'radar', label: 'Radar' },
  { value: 'topo', label: 'Topo map' }
];
