# Portal upload packages

Build with `npm run package:<portal>`. Upload the matching ZIP to each developer portal.

| File | Platform | Upload |
|------|----------|--------|
| `emmind-itch.zip` | itch.io | [Dashboard](https://itch.io/dashboard) → Uploads → HTML → **Playable in browser** |
| `emmind-poki.zip` | Poki | [Poki for Developers](https://developers.poki.com/) |
| `emmind-crazygames.zip` | CrazyGames | [Developer Portal](https://developer.crazygames.com/) — Basic launch first |
| `emmind-gamepix.zip` | GamePix | [GamePix Developers](https://www.gamepix.com/developers) |

Last build: ~10.8 MB total (under CrazyGames 50 MB limit).

QA checklist: [docs/PORTAL_QA.md](../docs/PORTAL_QA.md)

Local test URLs before upload:

- itch: `http://localhost:5180/`
- Poki: `http://localhost:5180/?platform=poki`
- CrazyGames: `http://localhost:5180/?platform=crazygames`
- GamePix: `http://localhost:5180/?platform=gamepix`
