# Dads Army · Team Picker

A team picker for the Dads Army ice hockey team. It instantly splits whoever turns up into **Lights** vs **Darks**, as evenly as possible on skill.

## How it works

1. **Roster** – add players and rate each 1–10 (drag the skill chip or tap it to type). A rating of **0 means goalie**. Tick who's here tonight.
2. **Teams** – press **Split teams**. Goalies are shared out first, one per team where possible. Team sizes are kept equal (one apart for an odd number; a side with an extra goalie gets one fewer skater), and among all such splits of the skaters the app finds the one with the closest skill totals (exhaustive search via dynamic programming, `src/lib/teams.ts`). When several splits are equally balanced it picks one at random, so **Reshuffle** gives a different, equally fair line-up.
3. **Send to WhatsApp** shares the line-up as an animated GIF (or a still PNG) through the phone's share sheet, or downloads it on desktop. Pick a style first: Rink, Matchday, Dossier, Chevrons or Night vision (`src/lib/graphicThemes.ts`). Pictures are drawn on a canvas (`src/lib/teamGraphic.ts`); the GIF opens on the finished line-up, replays a short intro, and is encoded with [gifenc](https://github.com/mattdesl/gifenc), storing only changed pixels per frame to keep it small.

Players and the last split are saved in the browser (localStorage) on that device. There's no backend.

The site has a woodland camo background generated in code (`src/lib/camo.ts`) and installs to a phone's Home Screen as **Dads Army** with the club logo as its icon.

UI components come from [React Bits](https://reactbits.dev) (`src/components/reactbits/`): ShinyText, RubberSegment, SpringCheck, ScrubField, StarBorder, SpotlightCard, Noise and ClickSpark.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy

Hosted on Vercel, which rebuilds and redeploys automatically on every push to `main` (Vite preset, output `dist/`).
