# Dads Army · Team Picker

A team picker for the Dads Army ice hockey team. It instantly splits whoever turns up into **Lights** vs **Darks**, as evenly as possible on skill.

## How it works

1. **Roster** – add players and rate each 1–10 (drag the skill chip or tap it to type). A rating of **0 means goalie**. Tick who's here tonight.
2. **Teams** – press **Split teams**. Goalies are shared out first, one per team where possible. Team sizes are kept equal (one apart for an odd number; a side with an extra goalie gets one fewer skater), and among all such splits of the skaters the app finds the one with the closest skill totals (exhaustive search via dynamic programming, `src/lib/teams.ts`). When several splits are equally balanced it prefers the one that keeps the fewest teammates together from the last few game nights (the most recent counts most), so teams get mixed up week to week; **Reshuffle** gives another equally fair line-up. The last split each day is remembered as that night's game.
3. **Send to WhatsApp** shares the line-up as a picture through the phone's share sheet, or downloads it on desktop. Choose a style from the mini previews under the picture: Rink, Matchday, Dossier, Night vision, Chalkboard, Comic, Honour board, or one of three animated styles sent as a looping GIF (Neon flickers on; Arena and Broadcast slide in). Animated styles show a play button on the preview. Styles live in `src/lib/graphicThemes.ts` and are drawn on a canvas (`src/lib/teamGraphic.ts`); GIFs open on the finished picture and are encoded with [gifenc](https://github.com/mattdesl/gifenc). The line-ups can also be copied as text. Ratings and totals are never shown on the teams screen or the picture.

**Game day** is for matches against other clubs and scrimmages, using the same roster:

- **Squad** – choose *Game* (titled "Team sheet") or *Scrimmage*, add the opponent, date, face-off time and rink, then tick who's available and set each player's position: forward, defence or goalie (goalies rated 0 start as G).
- **Lines** – pick a style: *Stacked* (best players together on line 1), *Balanced* (lines about equally strong) or *Mixed pairs* (each line has one stronger player with less experienced ones). The app builds forward lines of three (the best in each at centre), defence pairs, a starting goalie and backup, and lists anyone left over as spares (`src/lib/lines.ts`). The team sheet is drawn as a picture to send to WhatsApp, or copied as text (`src/lib/teamSheet.ts`).

**Backup** (bottom of the Roster tab) saves the roster and recent games as a JSON file via the share sheet or a download, and **Restore** loads one back.

Players and the last split are saved in the browser (localStorage) on that device. There's no backend.

The site has a woodland camo background generated in code (`src/lib/camo.ts`) and installs to a phone's Home Screen as **Dads Army** with the club logo as its icon.

UI components come from [React Bits](https://reactbits.dev) (`src/components/reactbits/`): ShinyText, RubberSegment, SpringCheck, ScrubField, StarBorder, Noise and ClickSpark.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy

Hosted on Vercel, which rebuilds and redeploys automatically on every push to `main` (Vite preset, output `dist/`).
