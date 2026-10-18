# Dads Army · Team Picker Wheel

A spinning-wheel team picker for the Dads Army ice hockey team. It splits whoever turns up into **Light** vs **Dark**, balanced by skill.

## How it works

1. **Roster** – add players and rate each 1–10 (drag the skill chip or tap it to type). Tick who's here tonight.
2. **Pick teams** – players who are ticked in are sorted by skill into tiers of four. For each tier the wheel spins to pick a player, and picks alternate snake-style (A B B A), with the team that's behind on total skill picking first. Each tier ends up two-and-two, so similar players land on opposite benches.
3. When the draft is done the app suggests the one swap that would narrow any remaining gap, and **Share teams** sends the line-ups to the group chat (or copies them).

Players and the last draft are saved in the browser (localStorage) on that device. There's no backend.

UI components come from [React Bits](https://reactbits.dev) (`src/components/reactbits/`): PixelSnow, SplitText, ShinyText, RubberSegment, SpringCheck, ScrubField, StarBorder, SpotlightCard, CountUp and ClickSpark. The wheel itself is a custom SVG (`src/components/Wheel.tsx`).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Turn it on once under **Settings → Pages → Source: GitHub Actions**.
