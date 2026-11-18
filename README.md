# Dialed

Dialed is an offline-first iPhone strength tracker that logs workouts in a few taps and remembers your exact setup: machine, seat position, cable height, bench notch. PRs and progress graphs only compare lifts done under identical conditions, so every number reflects real progress, not a changed setting.

## Status

Phase 1 (core foundation) is done:

- Installable PWA that works fully offline once loaded
- Four-tab navigation: Home, Train, Progress, Settings
- Theme settings: system, light or dark, plus 8 accent colors
- Training plans: create, edit, delete, and pick the active plan
- Gyms: create, edit, delete, with a per-gym weight unit and a built-in "Anywhere" location
- The full local database schema for every later phase

Next up is Phase 2: splits, workout templates, the exercise library and set logging.

## Stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16 (static export) + TypeScript |
| Styling | Tailwind CSS 4 |
| Storage | IndexedDB through Dexie 4, on the device only |
| Offline | Generated service worker that precaches the whole app |
| Hosting | Vercel Hobby (static files only) |

## Running it

```bash
npm install
npm run dev        # development server at http://localhost:3000
npm run build      # static export to out/ plus the service worker
npm start          # serve the production build locally
```

The service worker only registers in production builds, so offline behavior has to be tested with `npm run build && npm start`.

## Installing on iPhone

1. Deploy to Vercel by importing the repo. The default settings work.
2. Open the site in Safari.
3. Tap Share, then Add to Home Screen.
4. Launch Dialed from the Home Screen icon.

## Project layout

```
src/
  app/              Screens (one folder per route)
  components/       Shared UI: tab bar, sheet, list rows, buttons
  db/
    types.ts        The data model, documented field by field
    db.ts           Dexie schema and versioning
    seed.ts         First-launch setup (settings, Anywhere gym, built-in fields)
    actions.ts      All reads and writes used by the screens
  lib/
    configKey.ts    Canonical "same exercise, same setup" identity
    theme.ts        Accent colors and theme switching
scripts/
  generate-sw.mjs   Builds out/sw.js after next build
```

## Design rules worth knowing

- Two performances share PR history only when their configuration key matches: variation, weight interpretation, every setting, and (for machines and cables only) the gym and machine. Everything is keyed by ID, so renaming never breaks history.
- PRs and graphs are always computed from saved sets, never stored.
- Dates are local `YYYY-MM-DD` strings, so a late-night workout counts for the right day.
- Schema changes add a new `db.version(n)` block. Old blocks are never edited.

The full product spec lives in the Claude project for this app.
