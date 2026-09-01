# Seed Packet Vault

A single-page heirloom-almanac for home gardeners: catalog every packet in the seed stash, spot what is expired or expiring this year, and know what to sow before it's too late.

## Features

- **Card grid** of seed packets styled like vintage packets — plant name, source, packed/expiration years, quantity remaining, and notes.
- **Filter by source** — bought / saved / swapped / gifted, with live counts that double as the stats breakdown.
- **Sort by expiration year** — soonest-first by default so you use up old seed before fresh.
- **Badges** — brick "Expired" ribbon for seed past its year, ochre "Expiring" ribbon for seed expiring this year.
- **Stats bar** — total packets, expiring-soon, expired, plus per-source counts; all announced to screen readers.
- **localStorage persistence** — the vault survives refresh; corrupt or unreadable saved data is discarded with a visible warning instead of a crash.
- **Validation** — inline field errors for missing names and bad year ranges; expiration can never precede the packet year.

## Stack

- React 19 + Vite + TypeScript (strict)
- Pure domain logic in `src/logic.ts` (no React), tested with the Node built-in test runner
- No backend, no login, no external data — everything stays in your browser

## Run

```bash
npm install
npm run dev        # dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
npm test           # node --test src/logic.test.ts
npm run typecheck  # tsc --noEmit
```
