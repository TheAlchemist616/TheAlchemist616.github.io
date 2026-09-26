// Stand-in for Twitch's extension helper, so the viewer runs on a plain web page.
//
// Same idea as dev/shim.js, but configured for the public test page: the relay
// is fixed, and the host page drives player context through postMessage.
// Override for a one-off test with ?server=https://host:port and ?runners=A,B.
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const config = {
    // Must be https: this page is https, so a plain-http relay would be blocked
    // as mixed content and look exactly like an offline server.
    server: params.get('server') || 'https://race.luncearnnburn.com:8889',
    feedLatency: Number(params.get('feedLatency') || 0.8),
    layout: 'side',
    runners: (params.get('runners') || 'runner 1,runner 2')
      .split(',')
      .map((name) => ({ name: name.trim() })),
  };

  const contextCallbacks = [];

  window.Twitch = {
    ext: {
      configuration: {
        broadcaster: { version: '1', content: JSON.stringify(config) },
        onChanged(cb) { setTimeout(cb, 0); },
        set() { /* viewers cannot change broadcaster config */ },
      },
      onAuthorized(cb) {
        setTimeout(() => cb({ channelId: 'test', clientId: 'test', token: 'test', userId: 'test' }), 0);
      },
      onContext(cb) { contextCallbacks.push(cb); },
      listen() { /* no broadcaster messages on a test page */ },
      send() {},
    },
  };

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'dev-context') {
      contextCallbacks.forEach((cb) => cb(e.data.context, Object.keys(e.data.context)));
    }
  });
  if (window.parent !== window) window.parent.postMessage({ type: 'dev-ready' }, '*');
})();
