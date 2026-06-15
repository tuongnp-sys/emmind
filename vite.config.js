import { defineConfig } from 'vite';

const GAMEPIX_SDK =
  'https://gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js';
const GAMEPIX_TITLE = 'Emmind 7 Layers';

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

        const sdkTag =
          `  <script src="${GAMEPIX_SDK}" data-emmind-sdk="gamepix"></script>`;
        if (out.includes(GAMEPIX_SDK)) {
          return out;
        }
        return out.replace(
          /<meta name="viewport"[^>]*\/>/,
          `$&\n${sdkTag}`,
        );
      },
    },
  ],
});
