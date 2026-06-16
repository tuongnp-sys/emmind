# GamePix submission — Emmind

**Namespace (fixed):** `emmind-7-layers`  
**Upload file:** `packages/emmind-gamepix.zip`  
**Dashboard:** [my.gamepix.com](https://my.gamepix.com)

---

## Game title (must match in-game `<title>` and start menu h2)

```
Emmind 7 Layers
```

Do **not** use `Emmind - 7 Layers of Ascent` on GamePix (namespace mismatch).

---

## Short description (100–500 chars)

```
Guide a meditator through 7 layers of ascension. Fill the green Practice bar and reach 80 percent Mindfulness to advance. Collect golden Scriptures for shields. Layer 1 move and jump. Layer 2 fly in four directions. Desktop arrows or WASD and Space. Mobile drag to move and tap to jump. A calm focus game with layered music and peaceful cosmic visuals.
```

---

## How to play

```
Arrow Left / A = Move left
Arrow Right / D = Move right
Space = Jump (Layer 1)
Arrow Up / W = Fly up (Layer 2+)
Arrow Down / S = Fly down (Layer 2+)
Click = Pulse (Mindfulness 30% or higher)
Pause = Pause game
Stop = End run
```

---

## Custom Session

**Title (max 35):**
```
guide
```

**Content (max 350):**
```
Fill the Practice bar and reach 80 percent Mindfulness to advance. Collect golden Scriptures for shields. Layer 1 move and jump. Layer 2 fly in four directions. Desktop use arrows or WASD and Space. Mobile drag to move and tap to jump. Stay calm and breathe.
```

---

## Form checkboxes

| Field | Value |
|-------|--------|
| SDK Integration | **Yes** |
| Desktop | Yes |
| Mobile | Yes |
| Orientation | Both |
| Main tag | Platformer |
| Engine | HTML5 |

---

## Assets

| Asset | Size | Path |
|-------|------|------|
| Icon | 256×256 | `packages/gamepix-marketing/icon-256.png` |
| Cover | 1360×850 | `packages/gamepix-marketing/cover-1360x850.png` |

Generate: `npm run build:gamepix-marketing` → `packages/gamepix-marketing/icon-256.png`, `cover-1360x850.png` (title **Emmind 7 Layers**)

Cover text should say **Emmind 7 Layers** if title text is baked in.

---

## Trailer

```
https://youtu.be/_JbD8JpLqHo
```

---

## Resubmit checklist (order matters)

### 1. Build and verify locally

```bash
npm run package:gamepix
npm run test:gamepix-embed
```

- [ ] ZIP `index.html`: `<title>Emmind 7 Layers</title>`
- [ ] ZIP contains `gamepix.js` in `<head>` with `data-emmind-sdk="gamepix"`
- [ ] No visible "gamepix" text during gameplay
- [ ] Start menu disabled until `gameLoaded` (boot finishes before Start is clickable)
- [ ] Layer ascend: `interstitialAd` before `ping` — no “Wait. Game will resume in 4 seconds”
- [ ] 800×450: play without page scroll

### 2. SDK Testing Toolkit (before dashboard Submit)

- [ ] my.gamepix.com → **SDK Testing Toolkit** → upload `emmind-gamepix.zip` → **pass**

### 3. Dashboard upload

- [ ] Upload `packages/emmind-gamepix.zip`
- [ ] Icon `packages/gamepix-marketing/icon-256.png` (if not already current)
- [ ] Cover `packages/gamepix-marketing/cover-1360x850.png` (if not already current)
- [ ] Dashboard title = **Emmind 7 Layers**
- [ ] SDK Integration = **Yes**
- [ ] **Submit for review** on entry `emmind-7-layers`

---

## itch link (optional)

```
https://tuongnp.itch.io/emmind
```
