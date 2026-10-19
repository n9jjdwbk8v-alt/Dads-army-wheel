import type { ReactNode } from 'react';

export type PatchTab<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
  /** A small count on the patch, and how a screen reader should say it. */
  badge?: { text: string; spoken: string };
};

type PatchTabsProps<T extends string> = {
  tabs: PatchTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tabs switch the page's section; a choice picks an option inside a panel (dark labels for a white panel). */
  mode?: 'tabs' | 'choice';
  'aria-label': string;
};

/** Options drawn as shield-shaped camo patches with a stencilled label: the section tabs, or a choice in a panel. */
export default function PatchTabs<T extends string>({
  tabs,
  value,
  onChange,
  mode = 'tabs',
  'aria-label': label
}: PatchTabsProps<T>) {
  const tabsMode = mode === 'tabs';
  return (
    <div
      className={tabsMode ? 'patches' : 'patches patches--choice'}
      role={tabsMode ? 'tablist' : 'radiogroup'}
      aria-label={label}
    >
      {tabs.map(t => (
        <button
          key={t.value}
          role={tabsMode ? 'tab' : 'radio'}
          aria-selected={tabsMode ? t.value === value : undefined}
          aria-checked={tabsMode ? undefined : t.value === value}
          className={t.value === value ? 'patch patch--on' : 'patch'}
          aria-label={t.badge ? `${t.label}, ${t.badge.spoken}` : undefined}
          onClick={() => onChange(t.value)}
        >
          <span className="patch__shield">
            {t.icon}
            {t.badge && (
              <span className="patch__badge" aria-hidden="true">
                {t.badge.text}
              </span>
            )}
          </span>
          <span className="patch__label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

const icon = (paths: ReactNode) => (
  <svg
    className="patch__icon"
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

/** Dog tags. */
export function RosterIcon() {
  return icon(
    <>
      <path d="M7 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M16 6.5h1a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-1" />
      <circle cx="9.5" cy="6" r="1" />
      <path d="M7.5 10h4M7.5 12.5h3" />
    </>
  );
}

/** Crossed sticks over a puck. */
export function TeamsIcon() {
  return icon(
    <>
      <path d="M5 3l11.5 14H21" />
      <path d="M19 3L7.5 17H3" />
      <ellipse cx="12" cy="20" rx="3" ry="1.2" />
    </>
  );
}

/** A pound coin. */
export function FeesIcon() {
  return icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9a2.5 2.5 0 0 0-5 0v7M8 16.5h7.5M8 12.5h5" />
    </>
  );
}

/** A calendar with an army star. */
export function GameDayIcon() {
  return icon(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M12 12.3l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none" />
    </>
  );
}

/** A trophy, for a proper game. */
export function GameIcon() {
  return icon(
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </>
  );
}

/** A whistle, for a scrimmage. */
export function ScrimmageIcon() {
  return icon(
    <>
      <path d="M15.2 12.5A6.5 6.5 0 1 1 9 7h12.5v5.5z" />
      <circle cx="9" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M13 7V4.5" />
    </>
  );
}
