# Dads Army · Team Picker

A team picker for the Dads Army ice hockey team. It instantly splits whoever turns up into **Lights** vs **Darks**, as evenly as possible on skill.

## How it works

1. **Roster** – add players and rate each 1–10 (drag the skill chip or tap it to type). Tick who's here tonight.
2. **Teams** – press **Split teams**. Team sizes are kept equal (one apart for an odd number), and among all such splits the app finds the one with the closest skill totals (exhaustive search via dynamic programming, `src/lib/teams.ts`). When several splits are equally balanced it picks one at random, so **Reshuffle** gives a different, equally fair line-up.
3. **Send to WhatsApp** shares a Lights vs Darks graphic (a 1080×1350 PNG drawn on a canvas, `src/lib/teamGraphic.ts`) through the phone's share sheet, or downloads it on desktop. The line-ups can also be copied as text. Ratings and totals are never shown on the teams screen or the graphic.

Players and the last split are saved in the browser (localStorage) on that device. There's no backend.

UI components come from [React Bits](https://reactbits.dev) (`src/components/reactbits/`): PixelSnow, SplitText, ShinyText, RubberSegment, SpringCheck, ScrubField, StarBorder, SpotlightCard and ClickSpark.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Turn it on once under **Settings → Pages → Source: GitHub Actions**.
