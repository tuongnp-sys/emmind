# Poki submission — Emmind

**Upload file:** `packages/emmind-poki.zip` (~10.5 MB)

**Register:** [Poki for Developers](https://developers.poki.com/)

**Local test:** `npm run preview` → `http://localhost:4173/?platform=poki`  
Console: PokiSDK init + `gameLoadingFinished` after boot.

---

## Game title

Emmind — 7 Layers of Ascent

## Short description

A calm meditative platformer: ascend through 7 layers of mind, collect golden Scriptures, and reach enlightenment. Mobile-friendly drag controls.

## Full description

Guide a meditator through 7 ascending layers of consciousness. Fill the green Practice bar and reach 80% Mindfulness to advance each layer. Collect bright golden Scriptures for shields and Mindfulness. From Layer 2 onward, fly in all four directions. Three gentle reminders invite the player to pause and breathe.

This is a focus game, not a frenzy — smooth controls, layered music, and a peaceful cosmic aesthetic.

## Controls (paste into Poki control notes)

**Desktop**
- Move: Arrow keys or WASD
- Jump (Layer 1): Space
- Fly up/down (Layer 2+): Arrow Up/Down or W/S
- Pulse (Mindfulness ≥ 30%): Click / Pulse button
- Pause: Pause button on screen

**Mobile**
- Move: Drag anywhere on the play area — character follows finger 1:1
- Jump (Layer 1): Quick tap on play area, or Jump button
- Fly (Layer 2+): Drag in any direction
- Pulse: Pulse button when available
- Pause: Pause button

**Orientation (tested)**
- iPhone: best in **portrait**; refresh if layout breaks after rotation
- Some Android devices: best in **landscape**

## Category / tags

Casual, Platformer, Relaxing, Meditation, Single-player

## SDK (built in)

- `PokiSDK.init()` — SDK from Poki CDN on host; `?platform=poki` for local test
- `gameLoadingFinished()` after boot
- `gameplayStart()` / `gameplayStop()` on run / pause / end
- `commercialBreak()` before **Meditate Again** only (not first Start)
- Audio + game loop pause during ads

## QA before submit

- [ ] ZIP root has `index.html`
- [ ] Desktop Chrome: loads and plays
- [ ] Mobile: drag move works
- [ ] First Start: no ad
- [ ] After game over → Meditate Again: ad hook runs
- [ ] No extra third-party scripts in HTML (only dynamic Poki SDK)

## Links

- itch.io: https://tuongnp.itch.io/emmind
- Trailer: https://youtu.be/_JbD8JpLqHo
