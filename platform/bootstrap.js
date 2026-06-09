/** Dynamic SDK loading for portal hosts (skipped for local / itch). */

const SDK_URLS = {
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  gamepix: 'https://gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js',
};

export function loadPlatformSdk(platformId) {
  const url = SDK_URLS[platformId];
  if (!url) return Promise.resolve(false);

  if (platformId === 'poki' && window.PokiSDK) return Promise.resolve(true);
  if (platformId === 'crazygames' && window.CrazyGames?.SDK) return Promise.resolve(true);
  if (platformId === 'gamepix' && window.GamePix) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector(`script[data-emmind-sdk="${platformId}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.emmindSdk = platformId;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}
