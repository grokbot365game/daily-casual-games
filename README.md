# daily-casual-games

One casual browser game per day.

The site is published with GitHub Pages from the `main` branch root:

https://grokbot365game.github.io/daily-casual-games/

Day 9: [スキマぬけ — Gap Dash](https://grokbot365game.github.io/daily-casual-games/games/2026-10-04-gap-dash/)

Day 8: [合図よみ — Signal Read](https://grokbot365game.github.io/daily-casual-games/games/2026-10-03-signal-read/)

Day 7: [あわせタップ — Match Tap](https://grokbot365game.github.io/daily-casual-games/games/2026-10-02-match-tap/)

Day 6: [ねむねむすいこみ — Sleepy Soft Suck](https://grokbot365game.github.io/daily-casual-games/games/2026-10-01-soft-suck/)

Day 5: [ねむねむまくら積み — Sleepy Pillow Stack](https://grokbot365game.github.io/daily-casual-games/games/2026-09-30-pillow-stack/)

Day 4: [ねむねむほし貯金 — Sleepy Star Bank](https://grokbot365game.github.io/daily-casual-games/games/2026-09-29-star-bank/)

Day 3: [ねむねむ窓ふき — Sleepy Window Wipe](https://grokbot365game.github.io/daily-casual-games/games/2026-09-28-window-wipe/)

Day 2: [うたた寝タッチ — Doze Touch](https://grokbot365game.github.io/daily-casual-games/games/2026-09-27-doze-touch/)

Day 1: [ねむねむ羊 — Sleepy Sheep Count](https://grokbot365game.github.io/daily-casual-games/games/2026-09-26-sleepy-sheep/)

## Layout

- `index.html` — gallery of daily games
- `games/YYYY-MM-DD-slug/index.html` — that day's playable game

## How to add each day's game

1. Pick a date and a short slug, then create a folder:

   `games/YYYY-MM-DD-short-slug/`

   Example: `games/2026-09-27-rainy-cat/`

2. Put the playable page at `games/YYYY-MM-DD-short-slug/index.html`.

   Keep every asset path relative to that folder (`./sprites/cat.png`, `style.css`). Do not use root-absolute paths such as `/sprites/cat.png`. GitHub Pages serves this project at `/daily-casual-games/`, so a leading slash would leave the project site.

3. Add a listing on the gallery in `index.html`:

   ```html
   <a href="games/YYYY-MM-DD-short-slug/index.html">Game title</a>
   ```

4. Commit and push to `main`. Pages rebuilds from the repository root. The new game is then at:

   `https://grokbot365game.github.io/daily-casual-games/games/YYYY-MM-DD-short-slug/`

`.nojekyll` is in the repo root so Pages serves these files as a plain static site.
