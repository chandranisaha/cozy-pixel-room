// Client for the optional local helper (helper/cozy-helper.ps1) that does what a
// wallpaper can't: desktop icons, Sticky Notes, opening links, launching Claude, the brief.
// Every call carries the token from helper/token.js (written by the helper on first run).
(function (R) {
  const H = R.helper = { base: 'http://127.0.0.1:' + (R.params.get('helperPort') || 38917), ok: false, state: null };

  H.call = function (path, timeout = 2500) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    const url = H.base + path + (path.includes('?') ? '&' : '?') + 't=' + (window.COZY_TOKEN || '');
    return fetch(url, { signal: ctl.signal, cache: 'no-store' })
      .then(r => {
        H.ok = true;                              // it answered, even if with an error
        return r.json().then(j => { if (!r.ok) throw new Error(j.error || r.status); return j; });
      }, e => {
        // our own timeout means it's busy with something slow (Spotify, cover art), not gone
        if (!(e && e.name === 'AbortError')) H.ok = false;
        throw e.name === 'AbortError' ? new Error('the helper is busy, try again in a moment') : e;
      })
      .then(j => { if (j && 'iconsVisible' in j) H.state = j; return j; })
      .finally(() => clearTimeout(t));
  };

  // query-string helper: R.helper.q('/open', { url })
  H.q = (path, params) => path + '?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

  H.ping = () => H.call('/state').then(j => { R.emit('helper:state', j); return j; }).catch(() => null);
  H.ping();
  setInterval(H.ping, 10000);
})(window.R);
