/**
 * Inlined into GamePix build index.html immediately after static gamepix.js.
 * Literal GamePix.on.* + GamePix.game.gameLoaded for SDK Testing Toolkit.
 */
(function () {
  var bridge = {
    handlersBound: false,
    gameLoadedCalled: false,
    hostPaused: false,
    lang: 'en',
    _pause: null,
    _resume: null,
    _soundOn: null,
    _soundOff: null,

    defaultPause: function () {
      bridge.hostPaused = true;
      document.documentElement.classList.add('emmind-gpx-paused');
      document.body.style.pointerEvents = 'none';
    },

    defaultResume: function () {
      bridge.hostPaused = false;
      document.documentElement.classList.remove('emmind-gpx-paused');
      document.body.style.pointerEvents = '';
    },

    setHandlers: function (handlers) {
      bridge._pause = handlers && handlers.onPause ? handlers.onPause : null;
      bridge._resume = handlers && handlers.onResume ? handlers.onResume : null;
      bridge._soundOn = handlers && handlers.onSoundOn ? handlers.onSoundOn : null;
      bridge._soundOff = handlers && handlers.onSoundOff ? handlers.onSoundOff : null;
      bridge.bind();
    },

    bind: function () {
      if (!window.GamePix || !window.GamePix.on) return false;

      GamePix.on.pause = function () {
        bridge.defaultPause();
        if (bridge._pause) bridge._pause();
      };
      GamePix.on.resume = function () {
        if (bridge._resume) bridge._resume();
        bridge.defaultResume();
      };
      GamePix.on.soundOn = function () {
        if (bridge._soundOn) bridge._soundOn();
      };
      GamePix.on.soundOff = function () {
        if (bridge._soundOff) bridge._soundOff();
      };

      bridge.handlersBound = true;
      return true;
    },

    reportLoading: function (percent) {
      if (!window.GamePix || !window.GamePix.game) return;
      var n = Math.max(0, Math.min(100, Math.floor(percent)));
      GamePix.game.gameLoading(n);
    },

    callGameLoaded: function (onDone) {
      if (!window.GamePix || !window.GamePix.game || !window.GamePix.game.gameLoaded) {
        return false;
      }
      GamePix.game.gameLoading(100);
      GamePix.game.gameLoaded(function () {
        bridge.gameLoadedCalled = true;
        bridge.bind();
        if (window.GamePix.lang) {
          try {
            bridge.lang = GamePix.lang();
          } catch (e) {
            /* ignore */
          }
        }
        if (onDone) onDone();
      });
      return true;
    },

    fireOptionalProbe: function () {
      if (!bridge.gameLoadedCalled || !window.GamePix) return;
      try {
        if (GamePix.lang) bridge.lang = GamePix.lang();
        if (GamePix.updateLevel) GamePix.updateLevel(1);
        if (GamePix.updateScore) GamePix.updateScore(0);
      } catch (e) {
        /* ignore */
      }
    },
  };

  window.__emmindGamePixBridge = bridge;

  function onSdkReady() {
    bridge.bind();
    bridge.reportLoading(0);
  }

  function waitForSdk() {
    if (window.GamePix && window.GamePix.on) {
      onSdkReady();
      return;
    }
    var tag = document.querySelector('script[data-emmind-sdk="gamepix"]');
    if (tag && !tag.dataset.emmindBridgeHooked) {
      tag.dataset.emmindBridgeHooked = '1';
      tag.addEventListener('load', onSdkReady, { once: true });
      tag.addEventListener('error', function () {
        console.warn('[Emmind] gamepix.js failed to load');
      }, { once: true });
      if (window.GamePix) onSdkReady();
    }
    var deadline = Date.now() + 20000;
    (function poll() {
      if (window.GamePix && window.GamePix.on) {
        onSdkReady();
        return;
      }
      if (Date.now() < deadline) requestAnimationFrame(poll);
    })();
  }

  waitForSdk();

  var rebindDeadline = Date.now() + 20000;
  (function rebindPoll() {
    bridge.bind();
    if (bridge.handlersBound) return;
    if (Date.now() < rebindDeadline) requestAnimationFrame(rebindPoll);
  })();
})();
