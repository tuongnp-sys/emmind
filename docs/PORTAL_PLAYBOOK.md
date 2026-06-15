# Portal Playbook — HTML5 Game First-Pass Approval

Single reference for building and submitting a **portal-ready** HTML5 game (itch.io, Poki, GamePix, CrazyGames).  
Derived from **Emmind** implementation. Copy this entire document into a new agent chat as the project spec.

**Lessons learned (rejections, marketing, dashboard quirks):** [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) — paste into new agent chat with this playbook.

For a shorter per-host checklist during packaging, see [PORTAL_QA.md](./PORTAL_QA.md).

---

## 0. One-line brief (paste to New Agent)

> Build HTML5 game with Vite `base: './'`, one adapter per portal (Poki / CrazyGames / GamePix), portal mode instant guest play, ads **only on restart** (never first Start), audio **after user gesture**, storage with try/catch plus SDK cloud save where claimed. Package ZIP with **forward slashes** (use `tar -a -cf` on Windows, never `Compress-Archive`). **CrazyGames uploads loose files from `dist/`**; itch / Poki / GamePix use ZIP. **GamePix**: fit **800×450 iframe** (no scroll), dashboard title = in-game title (ASCII `-`), inject `gamepix.js` script in GamePix ZIP for SDK scan. Generate marketing assets per portal size spec. Test `?platform=` before submit. Ship **itch first**, then GamePix + CrazyGames Basic; Poki after developer account is provisioned.

---

## 1. Architecture principles (build these on day one)

### 1.1 One codebase, multiple portals

- **Adapter pattern**: `platform/{local,poki,crazygames,gamepix}.js` + `platform/index.js` detects host or `?platform=...`.
- **Dynamic SDK load** via `platform/bootstrap.js` — do **not** hardcode portal SDKs in `index.html` for itch/local (avoids double-load and broken local tests). **Exception: GamePix** — inject `<script src="...gamepix.js">` at build time for `package:gamepix` only (`vite.config.js` + `VITE_PORTAL_TARGET=gamepix`); automated review may not detect runtime-only SDK load. `bootstrap.js` still loads the same URL and skips duplicate if `window.GamePix` exists.
- **Portal mode** (`VITE_PORTAL=1` or host detect): hide auth / header / footer / leaderboard; **guest auto-login**; instant play.
- **Build**: `base: './'` (Vite) — all assets **relative** (`./assets/...`), works in iframe / ZIP / subpath.

### 1.2 Packaging (critical — silent failures)

| Rule | Why |
|------|-----|
| `index.html` at **ZIP root** | Portals expect playable root |
| ZIP entries use **forward slashes** | Windows `Compress-Archive` writes backslashes → Linux extract breaks → **blank game** |
| Windows: `tar -a -cf out.zip *` from `dist/` | Spec-compliant paths |
| itch: **< 1000 files**, **< 500 MB** | Hard limits |
| CrazyGames initial: **< 50 MB** | Basic Launch automatic check |

### 1.3 No external dependencies in build (except portal SDKs)

- No Google Fonts, third-party analytics, extra CDN JS/CSS in submission build.
- Only official host SDKs (Poki CDN, CrazyGames SDK v3, GamePix blob), loaded when needed.

### 1.4 Safe storage

- Wrap `localStorage` in **try/catch** (Safari private mode, iframe).
- CrazyGames: `SDK.data` when form says “Data Module”.
- GamePix: `GamePix.localStorage`.
- Migrate local keys → cloud once after SDK init.

### 1.5 Audio (browser autoplay policy)

- **No** music/SFX before user gesture.
- `AudioContext.resume()` on Start / first tap.
- Call `loadingFinished` / `gameLoaded` **before** gameplay audio.
- Pause game loop + audio on portal pause and during ads.

### 1.6 Mobile + desktop from the start

- Desktop: keyboard + mouse. Mobile: touch (drag/tap), `visualViewport`, `100dvh` where needed.
- Declare **Both** orientations on portal forms when supported.
- Test in **host preview iframe**, not only full browser tab (desktop may scroll; mobile compact must fit).

---

## 2. SDK behavior matrix (implement exactly)

| Behavior | Poki | CrazyGames | GamePix |
|----------|------|------------|---------|
| Init | `PokiSDK.init()` | `CrazyGames.SDK.init()` | `GamePix` + `on` callbacks |
| Loading done | `gameLoadingFinished()` | `sdkGameLoadingStop()` | `gameLoading(0→100)` + `gameLoaded(cb)` |
| Run start | `gameplayStart()` | `gameplayStart()` | (pings; no generic start) |
| Pause / end | `gameplayStop()` | `gameplayStop()` | `GamePix.on.pause` / `resume` |
| Portal mute | — | only if **implemented** | `soundOff` / `soundOn` |
| Milestone | — | `happyTime()` | — |
| Progress | — | — | `ping('level_complete')`, `ping('game_over')` |
| Ads | `commercialBreak()` | `ad.requestAd('midgame')` | `interstitialAd()` |
| **Ad rule** | Only before **restart** after run end | Midgame on restart (Full verifies) | Only Game Over/Victory → **Meditate Again** |
| **Never ad on** | First **Start** | First **Start** | First **Start**, Surrender |
| Save | localStorage (+ try/catch) | `SDK.data` | `GamePix.localStorage` |

**Local test**

| Platform | URL |
|----------|-----|
| itch / local | `http://localhost:5180/` |
| Poki | `http://localhost:5180/?platform=poki` |
| CrazyGames | `http://localhost:5180/?platform=crazygames` |
| GamePix | `http://localhost:5180/?platform=gamepix` |

**Production preview**: `npm run build:portal` → `npm run preview` → `http://localhost:4173/?platform=...`

---

## 3. Per-platform requirements

### 3.1 itch.io (baseline — do first)

**Technical**

- ZIP: `index.html` at root, relative paths, < 1000 files, < 500 MB.
- Embed **900×520** recommended or responsive full-width.
- No portal SDK required; `npm run package:itch`.
- No crash on iframe resize.

**Metadata**

- Genre, tags, description, cover **630×500**, screenshots, YouTube trailer (Unlisted OK).
- AI disclosure if applicable.
- Upload → HTML → **Playable in browser**.

**QA**

- Start → audio after gesture.
- iPhone portrait; some Android landscape.
- Note: refresh after rotate if layout breaks.

---

### 3.2 Poki

**Account**: Early access — account must be **provisioned by Poki** (self-signup often fails).

**Technical**

- `npm run package:poki` with `VITE_PORTAL=1`.
- `PokiSDK.init()` → `gameLoadingFinished()` when menu ready.
- `gameplayStart` / `gameplayStop` tied to run + pause.
- `commercialBreak()` **only** before restart after game over/victory — **not** first Start.
- During ad: stop loop + audio.
- Incognito: no crash.
- No CDN except Poki SDK.

**Metadata**

- Desktop + mobile controls (explicit).
- Orientation notes.
- Check **web exclusivity** vs itch if contract applies.

**QA**

- First Start: no ad.
- Game Over → restart: ad runs.
- Portrait + landscape playable.

---

### 3.3 GamePix

**Upload**: **ZIP** (`packages/emmind-gamepix.zip`).

**Technical**

- `GamePix.game.gameLoading(n)` during boot.
- `GamePix.game.gameLoaded(callback)` — menu ready **after** callback only.
- **No** music before Start / before `gameLoaded`.
- No console `GAMEPIX_LOADED_NOT_CALLED`.
- `pause` / `resume`: freeze gameplay, touch, audio.
- `soundOff` / `soundOn`: mute restore.
- `ping('level_complete')`, `ping('game_over')`.
- `interstitialAd()` only on restart after game over/victory.
- `GamePix.localStorage` for scores.
- **Embed fit**: GamePix QA uses a **800×450 desktop iframe**. Entire game (canvas + HUD/stats/controls) must fit **without vertical scroll**. Portal builds need a dedicated viewport branch — do **not** reuse standalone desktop `maxH = Math.max(480, …)` (480px canvas overflows a 450px-tall iframe).
- **SDK visible to scanner**: GamePix build injects `<script src="https://gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js">` in `index.html` (see `vite.config.js`). Runtime-only load via `bootstrap.js` alone can fail automated “SDK integration” checks even when hooks work in preview.
- **Language**: In-game UI **100% English** on GamePix (no bilingual or Vietnamese overlay text).

**Form quirks**

- Title: allowed chars only — use `-` not em dash `—`, avoid `:`.
- **Title must match in-game**: dashboard title, `<title>`, and start-menu heading must be **identical** (e.g. `Emmind - 7 Layers of Ascent`). Do not use a different marketing line (e.g. “Center Your Heart”) as the primary in-game title — use it as subtitle only.
- Description: 100–500 chars, original, include controls.
- Main tag: **Platformer** (or Casual / Arcade).
- Allow distribution + Desktop + Mobile: **Yes**.
- Engine: **HTML5** / JavaScript.
- Icon **256×256**, cover **1360×850**.
- YouTube: Unlisted OK; dashboard preview may show “refused to connect” — link can still save.
- How to play: `key = action` format.
- FAQ: question ≤80 chars, answer ≤150 chars.

**QA**

- Full tab + **800×450 iframe preview** (no scrollbars).
- Mobile Both.
- After rejection fix: re-upload ZIP → **Submit for review** again (not draft-only save).

---

### 3.4 CrazyGames

**Upload (critical difference)**: **No ZIP** — drag-drop **all files** from `dist/` (or `packages/crazygames-upload/`). `index.html` at upload root, not inside a wrapper folder.

**Technical — Basic Launch**

- Download **< 50 MB** (automatic).
- `SDK.init()` → `sdkGameLoadingStop()`.
- `gameplayStart()` after user Start; `gameplayStop()` on pause/end.
- `happyTime()` on milestones.
- Midgame ad on restart (Full launch verifies ads + data).
- `SDK.data` if form claims Data Module — **must be implemented**.
- **No** external ads.
- **No** external login (Google/Facebook) — portal guest only.
- In-game Terms/Privacy: if absent, QA **N/A**, not Yes.
- Multiplayer: **off**; lobby fields empty.
- Orientation: **Both**. Fullscreen: **Yes**.

**Metadata — Details**

- Category from host list (e.g. **Adventure** if no Platformer).
- Tags: max 5. Description: **no HTML**.
- Controls: desktop + mobile required.
- Covers: **1920×1080**, **800×1200**, **800×800**.
- Videos: landscape + portrait **MP4/MOV, ≤ 20 s each**.
- Submit: tick Developer Terms + **PEGI 12+** (calm games qualify).

**Flow**

1. Upload files → QA (preview + Start gameplay) → Details → Submit.
2. Status **Awaiting review** — wait for email; do not re-upload unless feedback.

---

## 4. Marketing asset sizes

| Asset | itch.io | GamePix | CrazyGames |
|-------|---------|---------|------------|
| Cover | 630×500 | 1360×850 + icon 256×256 | 1920×1080 + 800×1200 + 800×800 |
| Screenshots | 4+ gameplay | as required | as required |
| Trailer | YouTube Unlisted | YouTube link | MP4 ≤20s ×2 (landscape + portrait) |
| Embed | 900×520 | **800×450 iframe** (desktop QA) | — |

**Emmind scripts**

```bash
npm run build:gamepix-marketing    # → packages/gamepix-marketing/
npm run build:crazygames-marketing # → packages/crazygames-marketing/
npm run capture:itch-marketing     # screenshots + itch cover
npm run capture:itch-trailer       # source MP4 for trims
```

---

## 5. Pre-submit QA workflow (all portals)

```
1. npm run package:<portal>     # CrazyGames: also copy dist → packages/crazygames-upload/
2. Verify: index.html at root, forward slashes, file count, size limits
3. npm run preview → ?platform=<portal>
4. Boot: no crash; SDK loading hooks fire
5. First Start: NO ad; audio after gesture
6. Play 30s: move, pause, resume
7. End run → restart: ad hook if applicable
8. Mobile: QR preview or device — Both orientations
9. Console: no blocking errors (favicon 404 is cosmetic)
10. Metadata + assets complete → Submit for review
```

---

## 6. Common first-pass failures (Emmind lessons)

| Mistake | Result | Prevention |
|---------|--------|------------|
| ZIP backslash paths (Windows) | Blank game on Linux hosts | `tar -a -cf`, not Compress-Archive |
| Upload ZIP to CrazyGames | “Archive not supported” | Drag-drop `dist/` files |
| Skip `gameLoaded` / `gameLoadingFinished` | GamePix/Poki auto-reject | Call after boot, before interactive menu |
| Music before Start | Policy fail | Gesture unlock only |
| Ad on first Start | Reject | Ads only on restart after run |
| External login on portal build | CrazyGames QA fail | Portal mode hides auth; guest only |
| Tick SDK features not coded | QA mismatch | Tick only what exists (e.g. CG SDK mute) |
| Invalid title chars (`—`, `:`) | Form reject | Use allowed charset |
| CrazyGames video > 20s | Upload reject | Trim trailer |
| Desktop iframe taller than viewport | Clipped UI / scroll in GamePix preview | Portal branch: subtract HUD/stats/controls; **no 480px canvas floor** in iframe; `body.portal-mode { overflow: hidden }` |
| Standalone desktop `maxH = Math.max(480, …)` in portal ZIP | GamePix 800×450 reject — canvas taller than iframe | Separate `isPortalMode` viewport math in `syncGameViewport()` |
| GamePix SDK only via dynamic `bootstrap.js` | “SDK integration” flag despite working preview | Inject `<script src="...gamepix.js">` in GamePix build HTML; keep `data-emmind-sdk="gamepix"` so bootstrap dedupes |
| Dashboard title ≠ in-game `<title>` / menu h2 | GamePix title mismatch reject | One string everywhere: ASCII `-`, same as namespace (e.g. `Emmind - 7 Layers of Ascent`) |
| Marketing subtitle as in-game h2 (“Center Your Heart”) | Title mismatch vs dashboard | Game title in `<h2>`; tagline in subtitle / portal CSS only |
| Non-English in-game text (e.g. bilingual layer-7 heading) | Policy / localization reject | 100% English for GamePix; remove secondary-language UI strings |
| Vague metadata controls | Reject | Desktop + mobile, `key = action` |

---

## 7. Recommended repo layout (greenfield)

```
project/
  index.html                 # no hardcoded portal SDKs
  vite.config.js             # base: './'; GamePix SDK inject when VITE_PORTAL_TARGET=gamepix
  platform/
    bootstrap.js             # dynamic SDK URLs
    index.js                 # detect host + adapter dispatch
    local.js | poki.js | crazygames.js | gamepix.js
    storage.js               # localStorage + SDK.data + GamePix.localStorage
  src/
    main.js                  # gameplayStart/Stop, commercialBreak, portal chrome
    audio.js                 # gesture unlock, pause on ad
  public/assets/audio/       # source of truth for MP3 (not dist/)
  scripts/
    package-portal.mjs       # per-portal ZIP; bsdtar on Windows
    build-gamepix-marketing.mjs
    build-crazygames-marketing.mjs
  docs/
    PORTAL_PLAYBOOK.md       # this file — full spec for New Agent
    PORTAL_QA.md             # short per-host checklist
  packages/
    emmind-itch.zip | emmind-poki.zip | emmind-gamepix.zip
    emmind-crazygames.zip    # reference ZIP; CG submit uses loose files
    crazygames-upload/       # copy of dist/ for drag-drop
    poki-submission.md       # copy-paste metadata templates
    itch-description.md
    *-marketing/             # generated covers/videos
```

**Build commands**

```bash
npm run build              # local / itch
npm run build:portal       # VITE_PORTAL=1
npm run measure:dist
npm run package:itch | poki | gamepix | crazygames
```

---

## 8. Agent workflow with non-expert user

1. **One portal per flow** — form fields with copy-paste text and char limits.
2. **Absolute paths** + PowerShell commands + “drag this file / these files”.
3. **Distinguish portal pages**: developer profile / payment ≠ game submit.
4. **After Submit** → wait for email; no re-upload unless rejected or change requested.
5. **itch public first** — reuse YouTube trailer link on GamePix/CrazyGames.
6. **Do not commit/push** unless user asks.

**Submit order (proven)**

```
itch (public, embed QA)
  → GamePix (ZIP + long form)
  → CrazyGames Basic (loose files + QA automation + 3 covers + 2×20s video)
  → Poki (after account; keep emmind-poki.zip + poki-submission.md ready)
```

---

## 9. Portal-first design (agent should default to this)

- Implement `platform/*` in **week 1**, not after “game done”.
- One `npm run package:<host>` per portal from day one.
- Document **CrazyGames ≠ ZIP** in README so nobody uploads `.zip` to CG.
- Pre-generate marketing folders per host — user should not resize in Paint at deadline.
- Pre-write `packages/<portal>-submission.md` with title, description, controls, SDK notes.

### Easy-to-miss code / form mismatches

| Item | Agent rule |
|------|------------|
| CrazyGames “SDK mute” checkbox | Tick **only** if `soundOff` wired to CrazyGames SDK |
| CrazyGames “Data Module” | Tick **Yes** only if `SDK.data` used in `storage.js` |
| GamePix `gameLoaded` | Menu must not accept input until callback runs |
| GamePix iframe 800×450 | Test at exact size; portal viewport must not force 480px min canvas height |
| GamePix title | `<title>`, start overlay `<h2>`, and dashboard form — **same string**, ASCII hyphen |
| GamePix SDK script in ZIP | `grep gamepix.js dist/index.html` after `npm run package:gamepix` |
| Ad timing | Unit-test mentally: first Start path never calls `commercialBreak` |
| AudioContext warning at load | Expected; reviewers care about post-Start audio |

### Polish that helps review (not blocking first submit)

- iOS: `recreateAudioContext`, silence keeper, `navigator.audioSession.type = 'playback'`.
- Android: adaptive DPR for canvas.
- Rotate: honest note in description (“refresh if layout breaks”).
- `public/favicon.ico` — removes harmless 404 noise in Console.

---

## 10. What New Agent must NOT do

- Commit or push without user request.
- One ZIP/build for all portals without `VITE_PORTAL` / adapter split.
- `Compress-Archive` on Windows for portal ZIPs.
- Long “AI-sounding” GamePix descriptions (form warns against copy/AI text).
- Over-engineer helpers or abstractions beyond adapter pattern.
- Panic over GamePix YouTube preview “refused to connect” if embed test on YouTube works.
- Promise Poki signup via email alone — early access + `developersupport@poki.com`.

---

## 11. Post-approval backlog (Emmind — does not block first review)

- ~~Desktop / iframe: subtract HUD + stats from viewport height~~ — **done** (`measurePortalEmbedChrome`, `body.portal-mode` layout; GamePix resubmit).
- iPhone landscape: re-run `syncGameViewport` on `orientationchange`.
- CrazyGames SDK audio mute hook if Full launch requires it.
- Add `packages/gamepix-submission.md` and `packages/crazygames-submission.md` mirroring `poki-submission.md`.
- Poki submit when developer account is active.

### 11.1 GamePix rejections (Emmind)

**Round 1–2 (iframe / title / SDK script / gamepix UI text)** — see table above in §6.

**Round 3 (SDK + level 2 wait message)**

| # | Issue | Fix |
|---|--------|-----|
| 1 | SDK flagged but not integrated | Portal menu/start only after `gameLoaded`; static `gamepix.js` in ZIP `<head>` |
| 2 | “Wait. Game will resume in 4 seconds” at layer 2 | Caused by `ping('level_complete')` without `interstitialAd` — defer ping until after `interstitialAd()` on layer ascend |

**Resubmit checklist**

```bash
npm run package:gamepix
# Verify:
#   dist/index.html contains gamepix.js script tag
#   title is "Emmind - 7 Layers of Ascent" (ASCII hyphen)
#   no Vietnamese / bilingual UI strings in index.html
```

Upload `packages/emmind-gamepix.zip` on my.gamepix.com → **Submit for review**.

---

## 12. Final submit confirmation template

- [ ] `index.html` at bundle root  
- [ ] Relative asset paths (`./`)  
- [ ] Portal mode: no external login, instant guest play  
- [ ] SDK init + loading-finished hooks  
- [ ] `gameplayStart` / `gameplayStop` wired to run state  
- [ ] Ads only on restart (never first Start)  
- [ ] Audio after user gesture; silent during ads and portal pause  
- [ ] Storage try/catch + cloud storage on host where claimed  
- [ ] Mobile Both + desktop tested in host preview  
- [ ] Bundle within host size / file limits  
- [ ] Metadata, covers, videos match portal spec  
- [ ] QA preview: Start gameplay exercised  
- [ ] Submit for review (not left in draft)  

---

## 13. Emmind reference implementation

| Area | Path |
|------|------|
| Platform adapters | `platform/*.js`, `platform/index.js`, `platform/bootstrap.js` |
| Portal chrome / gameplay hooks | `src/main.js` |
| Audio policy | `src/audio.js` |
| Cloud storage | `platform/storage.js` |
| Portal CSS | `public/css/emmind.css` (`body.portal-mode`, iframe embed layout) |
| Portal viewport | `src/main.js` (`measurePortalEmbedChrome`, `syncGameViewport` portal branch) |
| GamePix SDK in HTML | `vite.config.js` (`VITE_PORTAL_TARGET=gamepix`) |
| Packaging | `scripts/package-portal.mjs` (`VITE_PORTAL` + `VITE_PORTAL_TARGET`) |
| Quick QA checklist | `docs/PORTAL_QA.md` |
| Copy-paste Poki metadata | `packages/poki-submission.md` |

---

*Last updated from Emmind portal deployment (itch public; GamePix resubmit after iframe/title/SDK fixes; CrazyGames Basic rejected generic; Poki pending account). Use as the single paste spec for the next HTML5 portal game.*
