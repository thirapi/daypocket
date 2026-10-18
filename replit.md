# Pocket Calendar (DayPocket)

A responsive calendar and daily memory-capsule app. Fully local-first: entries and photos live in the browser (localStorage + IndexedDB), no backend.

## Run & Operate

- `npm run dev` — run the app (dev server, defaults to port 5173 and base `/`; override with `PORT` and `BASE_PATH` env vars, see vite.config.ts)
- `npm run typecheck` — typecheck
- `npm run build` — typecheck + production build (outputs to `dist/public`)
- `npm run preview` — preview the production build

## Stack

- npm, Node.js 24, TypeScript 5.9, Vite 7
- React 19, Tailwind CSS 4, Radix UI / shadcn components
- Persistence: localStorage + IndexedDB (photo blobs)

## Where things live

- `src/App.tsx` — app shell, state, storage keys
- `src/components/ui/` — shadcn/ui primitives
- `src/pages/`, `src/hooks/`, `src/lib/` — screens and helpers
- `screenshots/daypocket-reference.png` — public design reference (inspiration only, not owned by us)
- `.agents/memory/` — cross-session notes (brand/asset ownership rules)
- `.replit-artifact/artifact.toml` — Replit artifact config (dev run command, production build, static serve path)

## Architecture decisions

- Local-first by design: no API server, DB, or auth. All data stays on-device.
- Single npm project at repo root (was previously a pnpm workspace with Replit `artifacts/` layout).
- Photos are stored as blobs in IndexedDB DB `little-keeps-photo-store` (store `photos`), capped at 8 photos / 10 MB each.

## Product

Calendar view with per-day memory capsules: colored notes, wax-seal styles, and attached photos.

### Envelope flow

1. **Empty date cell** shows a small capsule; hover reveals a `+`. Clicking it opens the create form: title, a letter (note), up to 8 photos, envelope color (6 shades), and seal motif (star/flower/crescent/heart), with a live envelope preview.
2. **Save** pastes a proportionally correct envelope (8:5) into the cell with a slight per-date tilt (`tiltForKey`) so it looks hand-stuck, not stamped. A tiny **Edit** pill appears on hover at the cell's bottom-right corner and jumps straight to editing. (Touch devices hide the pill: the whole cell is the open target and Edit/Remove live in the reading veil, so the pill can't steal taps meant for the envelope.)
3. **Clicking a saved cell** opens a dark reading veil (`memory-overlay.veil`) holding just the sealed envelope, the date, and a "Tap the envelope to open" hint. Clicking the envelope plays `stage-opening`: the flap rotates open in 3D (`rotateX(-172deg)`), the seal fades/slides away, a letter peeks out, and after ~520ms the contents slip out from inside and fan out side by side like items held in a hand — the letter and the photo prints sit in one wrapping flex row (`.emerged-photos` uses `display: contents` so prints line up next to the letter), edges tucked under each other via negative margins (`margin-left: clamp(-26px, -2.6vw, -14px)`) and per-item tilts, hovered item rising to the front (`z-index`). No Edit/Remove buttons in the veil — Edit lives outside (cell corner pill, touch uses the letter detail instead) and Remove lives inside the edit form.
4. **Item details**: the letter is a torn notebook page — jagged edges via SVG `feTurbulence` + `feDisplacementMap` filters (`#torn-edge` / `#torn-edge-soft` defs in `App.tsx`), a postage stamp with the wax seal, and the body in Caveat handwriting on ruled lines with a red margin rule. Its detail view adds an **Edit this letter** button that jumps to the edit form. Each photo is a fresh Polaroid (white frame, thick foot with filename caption, per-print tilt via `--ptilt`, develop-from-white `photo-develop` fade-in); its detail is a large tilted Polaroid lightbox with an italic serif caption. Escape or backdrop click dismisses the detail first, then the veil.
5. Layout is fully fluid (`clamp`/`vh`-based typography and `clamp(64px, 12.5vh, 128px)` day cells, no page zoom) so the calendar fits desktop, laptop, and mobile screens.

## User preferences

- Use **npm**, not pnpm/yarn.
- Use `.agents/memory/` for durable notes worth remembering across sessions.

## Gotchas

- `PORT` and `BASE_PATH` env vars override the local defaults in `vite.config.ts` (Replit provides them; locally you can just run plain `npm run dev`).
- Do not copy the branding, logo, or assets from the reference site — visual structure only.
