# Agent Handoff — HTML5 Portal Game (Emmind lessons)

**Paste this entire file into a new agent chat** together with [PORTAL_PLAYBOOK.md](./PORTAL_PLAYBOOK.md).  
Battle-tested from Emmind deployment through itch, GamePix resubmit, CrazyGames Basic, and Poki prep (as of June 2026).

For a shorter per-host checklist during packaging, see [PORTAL_QA.md](./PORTAL_QA.md).

---

## 1. Goal for a new agent

Build **portal-ready from week 1** — not “game done, then bolt on SDK.” One correct submit beats two reject cycles + ZIP rebuild + cover redo + 24h review wait.

**Proven ship order:**

```
itch (public) → GamePix (ZIP) → CrazyGames Basic (loose files) → Poki (when account provisioned)
```

---

## 2. Golden rules — day one

### Architecture

| Do | Why |
|----|-----|
| Vite `base: './'` | ZIP / iframe / subpath assets work |
| `platform/{poki,crazygames,gamepix,local}.js` + `?platform=` | Local test before upload |
| `VITE_PORTAL=1` for portal builds | Hide auth/header/footer; guest auto-login |
| One `npm run package:<portal>` per host | Never one ZIP for all portals |
| `localStorage` try/catch + host cloud save | Safari private / iframe no crash |

### Smooth gameplay + portal policy

| Rule | Violation |
|------|-----------|
| **No** music/SFX before user gesture | Autoplay policy fail |
| `gameLoaded` / `gameLoadingFinished` **before** interactive menu | GamePix/Poki auto-reject |
| **No ad on first Start**; GamePix ads on layer ascend + restart after game over/victory | Ad on first Start = reject |
| Portal pause → stop loop + audio + touch | QA requirement |
| **Separate portal viewport math** — not standalone desktop | GamePix 800×450 scroll = reject |

### Packaging (silent failures → blank game)

| Correct | Wrong |
|---------|-------|
| `index.html` at **ZIP root** | `dist/index.html` or `MyGame/index.html` wrapper |
| Windows: `tar -a -cf zip *` from `dist/` | `Compress-Archive` → backslashes → Linux extract breaks |
| CrazyGames: drag **loose files** from `dist/` | Upload ZIP → “Archive not supported” |

---

## 3. Each portal is different — do not copy-paste metadata

| | itch | GamePix | CrazyGames | Poki |
|---|------|---------|------------|------|
| Upload | ZIP | ZIP | **Loose files** | ZIP |
| Title | Free (`Emmind - 7 Layers of Ascent`) | **Must match namespace** (`Emmind 7 Layers`) | Form-specific | Form-specific |
| Iframe QA | 900×520 embed | **800×450, no page scroll** | Portal preview | Portal preview |
| SDK in HTML | None | **Static `<script gamepix.js>` in `<head>`** | Dynamic OK | Dynamic OK |
| Ads | None | `interstitialAd` on layer ascend + after Game Over/Victory → restart | Midgame on restart | `commercialBreak` on restart |
| Cover | 630×500 | 1360×850 + icon 256×256 | 3 sizes + video ≤20s | Per form |
| In-game language | Flexible | **100% English** | English | English |

**GamePix title (Emmind):** namespace `emmind-7-layers` is fixed → dashboard, `<title>`, start-menu `<h2>`, cover, and icon must all say **`Emmind 7 Layers`**. itch keeps the long title; **do not** use the itch title on GamePix.

**Marketing subtitles** (“Center Your Heart”, “A meditative ascent…”) are taglines only — **never** replace the game title in `<h2>`.

---

## 4. Real Emmind obstacles and how to avoid them

### A. GamePix rejection (two rounds — same four items)

| # | QA issue | Root cause | Required fix |
|---|----------|------------|--------------|
| 1 | Does not fit **800×450** iframe | Desktop `maxH = Math.max(480, …)`; HUD/stats/controls not subtracted | `isPortalMode` in `syncGameViewport()`, `measurePortalEmbedChrome()`, `body.portal-mode { overflow: hidden }` |
| 2 | Title ≠ namespace | Dashboard `Emmind 7 Layers` vs in-game em dash / “Center Your Heart” | `vite.config.js` injects GamePix title; `syncGamePixTitle()`; one string everywhere |
| 3 | SDK integration not detected | SDK loaded only at runtime via `bootstrap.js` | Inject `<script src="...gamepix.js">` when `VITE_PORTAL_TARGET=gamepix` |
| 4 | “gamepix” visible during gameplay | Build stamp `emmind-portal · gamepix` | Skip stamp in portal mode; CSS hide `#game-build-stamp` |

**Lesson:** Full-browser preview **does not** represent GamePix QA. Always test **800×450** and run `npm run test:gamepix-embed`.

### B. ZIP / SDK Testing Toolkit

- **Order:** `npm run package:gamepix` → **SDK Testing Toolkit** (upload same ZIP) → dashboard upload → **Submit for review**. Do not Submit before Toolkit pass.
- A complete SDK ZIP **does not** guarantee a visible demo ad. The toolkit checks **hooks fire correctly**, not ad creatives.
- **GamePix ad moments:** (1) after layer transition ends on ascend — `interstitialAd()` then `ping('level_complete')`; (2) **Meditate Again** after game over/victory. First Start and Surrender **never** show ads.

### C. GamePix marketing assets

| Failure | Cause | Fix |
|---------|-------|-----|
| Cover = flat dark blue + text only | Playwright `setContent` + `url('file://...')` does not load images | **Base64 data URI** embed PNGs in HTML |
| Cover shows old title “7 Layers of Ascent” | Reused itch cover with baked-in title | Gameplay collage + new title, or mask old title |
| Icon too dark, no gameplay | Sparse layer crop / heavy vignette | Live canvas capture (layer 1 or 3); higher brightness |

Script: `npm run build:gamepix-marketing` (run `npm run preview` first for live canvas capture).

### D. GamePix dashboard workflow

- **Save button greyed out** after Submit = form **locked** during “review within 24h” — normal, not a bug.
- Short description must be **100–500 characters**; Custom Session content must not contain `:` or `%`.
- Resubmit = upload new ZIP + icon + cover → **Submit for review**, not draft-only Save.

### E. YouTube / cross-portal branding

- One YouTube URL (`youtu.be/...`) is reused on itch, GamePix, and Poki.
- **No Replace video** on YouTube → old footage stays on the same URL; update **title + description + custom thumbnail** immediately.
- New footage = new Unlisted upload + update links on all portals **after** GamePix unlocks the form (post-review).
- Old itch trailer title does **not** block GamePix review if ZIP and in-game title are correct.

### F. GamePix rejection round 3 (SDK + level 2 wait)

| Issue | Fix |
|-------|-----|
| SDK flagged, not integrated | Portal menu only after `loadingFinished()`; `gamepix.js` static in ZIP `<head>` with `data-emmind-sdk="gamepix"` |
| “Wait. Game will resume in 4 seconds” at layer 2 | `ping('level_complete')` alone triggers SDK test pause — call `interstitialAd()` first on layer ascend, then ping |

**Implementation (Emmind):**

| Piece | Path / behavior |
|-------|-----------------|
| Defer portal menu | `initPortalSession()` does not show start overlay; `boot()` calls `enterMenuAfterLogin()` only after `loadingFinished()` |
| Lock Start until ready | `hostMenuReady` + `syncStartButtonState()` — disabled until `gameLoaded` |
| Layer ascend ad | `ascendLayer()` sets `pendingLevelCompletePing`; `finishLayerTransition()` → `runGamePixLevelCompleteAd()` → `commercialBreak()` then `pingLevelComplete()` |
| Restart ad | `beginNewRun()` → `runCommercialBreak()` when `lastRunEndState` is game over/victory |
| SDK inject | `vite.config.js` when `VITE_PORTAL_TARGET=gamepix` |

### G. Performance / smooth play

- Adaptive canvas DPR on mobile; avoid layout work every frame.
- Portal: subtract chrome before setting canvas height — prevents reflow and scroll.
- Audio: `AudioContext.resume()` on gesture; pause during ads and portal pause.
- No Google Fonts / analytics CDN in submission build — latency + policy risk.
- Run `npm run measure:dist` — CrazyGames < 50 MB; itch < 1000 files.

### H. CrazyGames and Poki (avoid repeat mistakes)

- CrazyGames Basic can reject vague metadata — desktop + mobile controls must be explicit; videos ≤ 20s.
- Poki account must be **provisioned by Poki** — self-signup often fails; keep `emmind-poki.zip` ready.

---

## 5. Pre-submit checklist (agent runs every time)

```bash
npm run package:<portal>
npm run measure:dist
npm run preview                    # separate terminal
# GamePix also (in order):
npm run test:gamepix-embed
npm run build:gamepix-marketing    # before uploading icon/cover
# Then: SDK Testing Toolkit on my.gamepix.com → upload ZIP → pass
```

**Manual verify:**

- [ ] Open ZIP → `index.html` at root; paths use `/` not `\`
- [ ] GamePix: `dist/index.html` contains `gamepix.js` in `<head>` (`data-emmind-sdk="gamepix"`)
- [ ] In-game title = dashboard title (GamePix: `Emmind 7 Layers`)
- [ ] No visible “gamepix” / “poki” text during gameplay
- [ ] GamePix 800×450: playable, **no page scroll**
- [ ] Start disabled until `gameLoaded`; menu appears only after boot finishes
- [ ] First Start: **no** ad; layer ascend: `interstitialAd` before `ping`; game over → restart: ad hook runs
- [ ] Console: no `GAMEPIX_LOADED_NOT_CALLED`
- [ ] 100% English in-game UI (GamePix)
- [ ] Icon/cover at exact pixel spec; title on assets matches

---

## 6. Emmind repo — where to read

| Task | Path |
|------|------|
| Full spec | `docs/PORTAL_PLAYBOOK.md` |
| Short checklist | `docs/PORTAL_QA.md` |
| GamePix copy-paste form | `packages/gamepix-submission.md` |
| SDK adapters | `platform/*.js` |
| Portal viewport, ads, title | `src/main.js` |
| GamePix SDK inject + build title | `vite.config.js` |
| ZIP packaging | `scripts/package-portal.mjs` |
| Automated embed QA | `scripts/test-gamepix-embed.mjs` |
| GamePix marketing assets | `scripts/build-gamepix-marketing.mjs` |

---

## 7. New agent must NOT

- Commit or push unless the user asks
- One build for all portals
- Use `Compress-Archive` on Windows for portal ZIPs
- Upload a ZIP to CrazyGames
- Hardcode all portal SDKs in `index.html` (exception: GamePix inject at build time only)
- Test only full-screen desktop
- Use the itch title on GamePix
- Generate marketing covers with `file://` URLs in Playwright
- Promise Poki self-service signup
- Panic because the SDK Toolkit shows no demo ad
- Edit the GamePix dashboard while status is “review within 24h”

---

## 8. One-line brief for a greenfield project

> Vite `base:'./'`, adapter per portal, portal mode in week 1, no ad on first Start, GamePix: menu after `gameLoaded`, `interstitialAd` on layer ascend + restart, static `gamepix.js` in ZIP, title matches namespace, fit 800×450, English UI, SDK Toolkit before Submit, Windows ZIP via `tar -a -cf`, CrazyGames = loose files, marketing PNGs via base64 in Playwright, test `?platform=` and `test:gamepix-embed`, itch first then GamePix, pre-write `packages/*-submission.md`.

---

## 9. GamePix ad timing (reference)

All ads go through `commercialBreak()` → `GamePix.interstitialAd()` in `platform/gamepix.js` (pause game/audio before call; resume in caller).

**A. Layer ascend** (`platformId === 'gamepix'` only)

1. `ascendLayer()` — does **not** call `pingLevelComplete` immediately; sets `pendingLevelCompletePing`.
2. Layer transition overlay runs (~2.2s).
3. `finishLayerTransition()` → `runGamePixLevelCompleteAd()` → `interstitialAd()` then `ping('level_complete')`.

Calling `ping` without `interstitialAd` first triggers GamePix review overlay: *“Wait. Game will resume in 4 seconds.”*

**B. Restart after run end**

`shouldRunCommercialBreak()` is true when `lastRunEndState` is `'gameover'` or `'victory'` (not `'surrender'`).  
User clicks **Meditate Again** → `beginNewRun()` → `runCommercialBreak()` before the new run.

**Never:** first **Start Meditation**, or **Surrender** back to menu.

---

*Derived from Emmind portal deployment. Complements [PORTAL_PLAYBOOK.md](./PORTAL_PLAYBOOK.md); use both when onboarding a new agent.*
