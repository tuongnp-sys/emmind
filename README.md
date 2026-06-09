# Emmind — 7 Layers of Ascent (standalone)

HTML5 meditation game for **local play** and **portal upload** (itch.io, CrazyGames, Poki, GamePix).

Joymed (`d:\joymed\web_hoc_stripe`) is **never modified** — only read/copied via `npm run sync:joymed`.

## Run locally

```bash
cd d:\Emmind
npm install
npm run dev
```

Open http://localhost:5180 — enter a name, play. Scores save on this device (localStorage or CrazyGames cloud data).

## Deploy (GitHub + Vercel + Render)

| Host | URL |
|------|-----|
| **GitHub** | https://github.com/tuongnp-sys/emmind |
| **Vercel** | https://emmind.vercel.app |
| **Render** | https://emmind.onrender.com |

- **Vercel:** [`vercel.json`](vercel.json) — `npm run build` → `dist/`
- **Render:** [`render.yaml`](render.yaml) — static site, same build

Both hosts serve the standalone itch build (no portal SDK required for basic play).

### Portal simulation

- `?platform=local` — default, no SDK
- `?platform=poki` — Poki SDK + portal UX
- `?platform=crazygames` — CrazyGames SDK v3
- `?platform=gamepix` — GamePix SDK

## Build for portals

```bash
npm run build              # itch.io / standalone
npm run build:portal       # portal UX flag (VITE_PORTAL=1)
npm run measure:dist       # size check (CrazyGames 50 MB)
npm run package:itch       # packages/emmind-itch.zip
npm run package:poki
npm run package:crazygames
npm run package:gamepix
```

See [docs/PORTAL_QA.md](docs/PORTAL_QA.md) for per-host checklists.

## Platform layer

[`platform/`](platform/) adapters:

| File | Host |
|------|------|
| `local.js` | itch.io, dev |
| `poki.js` | Poki |
| `crazygames.js` | CrazyGames |
| `gamepix.js` | GamePix |
| `storage.js` | Safe persistence + CG data migration |
| `bootstrap.js` | Dynamic SDK script load |

## Sync mechanics from Joymed

```bash
npm run sync:joymed
```

Copies `background.js`, `player.js`, etc. Does **not** overwrite `main.js` or `session.js`.

## Portal checklist

- [x] Self-hosted fonts (no Google CDN) — `public/css/emmind.css`
- [x] `gameplayStart` / `gameplayStop` wired — `platform/` + `main.js`
- [x] SDK dynamic load — `platform/bootstrap.js`
- [x] Portal UX (guest play, minimal chrome) — `body.portal-mode`
- [x] `commercialBreak` on restart — `runCommercialBreak()` in `main.js`
- [x] Storage try/catch + CrazyGames data — `platform/storage.js`
- [x] Package scripts + QA doc — `scripts/`, `docs/PORTAL_QA.md`
- [x] Audio MP3 assets in `public/assets/audio/` — bg-layer 1–7, bg-music, sfx-* (see README in that folder)
- [x] Initial download verified under 50 MB (`npm run measure:dist` — ~10.8 MB, 21 files)
- [x] GamePix SDK — `gameLoaded` callback, `interstitialAd`, `ping`, `GamePix.localStorage`, script in `index.html`
- [ ] No external payment links
