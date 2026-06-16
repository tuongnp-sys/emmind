# Portal QA — Emmind

Checklist before submitting to each host. Test builds with `npm run package:<portal>`.

**Full spec for New Agent:** [PORTAL_PLAYBOOK.md](./PORTAL_PLAYBOOK.md)  
**Battle-tested lessons (Emmind rejections, assets, workflow):** [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)

## Local test URLs

| Platform | URL |
|----------|-----|
| itch / local | `http://localhost:5180/` |
| Poki | `http://localhost:5180/?platform=poki` |
| CrazyGames | `http://localhost:5180/?platform=crazygames` |
| GamePix | `http://localhost:5180/?platform=gamepix` |

Portal mode hides auth, header, footer, and leaderboard. Guest user auto-login.

---

## itch.io

- [ ] Run `npm run package:itch` → `packages/emmind-itch.zip`
- [ ] ZIP root contains `index.html`
- [ ] Relative asset paths (`./assets/...`) load in iframe
- [ ] No console CORS / cross-origin errors
- [ ] Resize browser / embed — canvas scales
- [ ] File count &lt; 1000, total &lt; 500 MB (`measure:dist`)

Upload: project → Uploads → HTML → check “Playable in browser”.

---

## Poki

- [ ] `npm run package:poki`
- [ ] SDK loads (`poki-sdk.js`), `PokiSDK.init()` in console
- [ ] `gameLoadingFinished` after boot
- [ ] `gameplayStart` when run begins; `gameplayStop` on pause / end
- [ ] `commercialBreak` before **Meditate Again** (not first Start)
- [ ] Audio stops during ad; game loop paused
- [ ] Mobile portrait + landscape playable
- [ ] Incognito / private mode — no crash (storage try/catch)
- [ ] No external fonts/CDN in build (only portal SDK scripts)

---

## CrazyGames

- [ ] `npm run package:crazygames`
- [ ] SDK v3 init on `?platform=crazygames`
- [ ] `sdkGameLoadingStop`, gameplay start/stop events
- [ ] `happyTime` on layer ascend + enlightenment
- [ ] Midgame ad on restart after run ends
- [ ] Scores persist via `SDK.data` when on CrazyGames host
- [ ] Total download &lt; 50 MB (`npm run measure:dist`)

Basic launch: minimal SDK. Full launch: data + ads verified.

---

## GamePix

Reference: [GamePix SDK Bible](http://gpxprj.blob.core.windows.net/api/index.html)

**Submit order:** `package:gamepix` → `test:gamepix-embed` → **SDK Testing Toolkit** → dashboard upload → **Submit for review**.

- [ ] `npm run package:gamepix` → `packages/emmind-gamepix.zip`
- [ ] `gamepix.js` in `index.html` `<head>` with `data-emmind-sdk="gamepix"` (Network tab)
- [ ] `GamePix.game.gameLoading(0→100)` during boot
- [ ] `GamePix.game.gameLoaded(callback)` — menu + Start only after callback (`hostMenuReady`)
- [ ] No music before **Start Meditation** / before `gameLoaded`
- [ ] Console: no `GAMEPIX_LOADED_NOT_CALLED` errors
- [ ] `GamePix.on.pause` — gameplay, touch, and audio freeze
- [ ] `GamePix.on.resume` — game resumes correctly
- [ ] `GamePix.on.soundOff` / `soundOn` — mute and restore layer music
- [ ] Layer ascend: `interstitialAd()` **before** `ping('level_complete')` (avoids “Wait… resume” overlay)
- [ ] `GamePix.game.ping('game_over')` on run end (game over / victory / surrender)
- [ ] `GamePix.interstitialAd()` after **Game Over** or **Victory** → **Meditate Again** (restart)
- [ ] No interstitial on first **Start Meditation** or after **Surrender**
- [ ] Scores persist via `GamePix.localStorage` on GamePix host
- [ ] Mobile portrait + landscape playable
- [ ] SDK Testing Toolkit pass (upload ZIP before dashboard Submit)

---

## Audio assets

Place MP3 files under `public/assets/audio/` (see `public/assets/audio/README.md`).  
Game runs silently if files are missing; boot calls `gameLoaded` / `loadingFinished` before gameplay audio plays.

**Rule:** Always edit `public/assets/audio/`, never only `dist/` — rebuild copies from `public/`.

---

## Build commands

```bash
npm run build              # local / itch
npm run build:portal       # VITE_PORTAL=1
npm run measure:dist       # size report
npm run package:itch
npm run package:poki
npm run package:crazygames
npm run package:gamepix
```

---

## Submission (upload)

After QA passes, upload the ZIP from `packages/`:

| Host | ZIP file | Developer portal |
|------|----------|------------------|
| itch.io | `emmind-itch.zip` | [itch.io dashboard](https://itch.io/dashboard) → project → Uploads → HTML, enable **Playable in browser** |
| Poki | `emmind-poki.zip` | [Poki for Developers](https://developers.poki.com/) → submit build + control notes (desktop + touch) |
| CrazyGames | `emmind-crazygames.zip` | [CrazyGames Developer Portal](https://developer.crazygames.com/) → **Basic launch** first, then Full launch for ads/data |
| GamePix | `emmind-gamepix.zip` | [GamePix Developers](https://www.gamepix.com/developers) → upload HTML5 build; note full SDK integration |

Embed size for itch: 900×520 recommended, or full-width responsive.
