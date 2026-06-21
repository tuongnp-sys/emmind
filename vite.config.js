import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Official URL — GamePix automated scanner greps index.html for this string. */
const GAMEPIX_SDK_CDN =
  'https://gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js';
const GAMEPIX_TITLE = 'Emmind 7 Layers';

const gamePixInlineBridge = fs.readFileSync(
  path.join(__dirname, 'platform', 'gamepix-inline-bridge.js'),
  'utf8',
);

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5180,
    open: true,
  },
  plugins: [
    {
      name: 'emmind-portal-gamepix-sdk',
      transformIndexHtml(html) {
        if (process.env.VITE_PORTAL_TARGET !== 'gamepix') return html;

        let out = html.replace(
          '<title>Emmind - 7 Layers of Ascent</title>',
          `<title>${GAMEPIX_TITLE}</title>`,
        );
        out = out.replace(
          '<h2>Emmind - 7 Layers of Ascent</h2>',
          `<h2>${GAMEPIX_TITLE}</h2>`,
        );

        if (out.includes('data-emmind-gamepix-bridge')) {
          return out;
        }

        const sdkTag =
          `  <script src="${GAMEPIX_SDK_CDN}" data-emmind-sdk="gamepix"><\/script>`;
        const bridgeTag =
          `  <script data-emmind-gamepix-bridge>${gamePixInlineBridge}<\/script>`;

        return out.replace(
          /<meta name="viewport"[^>]*\/>/,
          `$&\n${sdkTag}\n${bridgeTag}`,
        );
      },
    },
  ],
});
