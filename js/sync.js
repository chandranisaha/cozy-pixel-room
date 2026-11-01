// Keeps the copies of the room on each screen in step. Lively's Duplicate mode runs one copy
// per screen, each in its own throwaway browser profile, so they can't share localStorage
// (and it's wiped whenever Lively restarts). The helper keeps the room's state instead:
// every R.store.set is pushed to it, and each copy polls for what the other one changed.
// Changes from the other screen are applied silently (no toasts, no animation), and sounds
// you trigger are replayed there too, because Lively only lets one screen make sound.
(function (R) {
  const Y = R.sync = { on: !R.debug || R.params.has('sync'), rev: 0, applying: false, ok: false };
  const LOCAL = new Set(['cfg', 'hudOpen', 'genres']);   // per screen
  const known = {}, pending = new Map();     // known: the last value this copy saw per key
  let flushT = 0;

  // you did something on this screen in the last few seconds (sounds are shared only then)
  R.lastInput = 0;
  ['pointerdown', 'pointerup', 'keydown', 'wheel'].forEach(t => window.addEventListener(t, () => (R.lastInput = Date.now()), true));
  R.userActive = () => Date.now() - R.lastInput < 4000;

  R.store.onSet = (k, json) => {
    if (!Y.on || Y.applying || LOCAL.has(k) || known[k] === json) return;
    known[k] = json; pending.set(k, json);
    clearTimeout(flushT); flushT = setTimeout(flush, 200);
  };
  function flush() {
    pending.forEach((json, k) => {
      R.helper.call(R.helper.q('/kv/set', { k, v: json, id: R.instanceId }), 5000).catch(() => { known[k] = null; });
    });
    pending.clear();
  }

  // a one-off happening (a sound, music starting) for the other screen
  R.share = (name, data) => {
    if (!Y.on || Y.applying) return;
    R.helper.call(R.helper.q('/ev', { name, data: JSON.stringify(data == null ? null : data), id: R.instanceId }), 3000).catch(() => {});
  };

  function apply(items, fire) {
    Y.applying = true;
    try {
      Object.keys(items).forEach(k => {
        const json = items[k];
        if (LOCAL.has(k) || known[k] === json) return;
        known[k] = json;
        try { localStorage.setItem('cozy.' + k, json); } catch (e) {}
        if (fire) R.store.fire(k);
      });
    } finally { Y.applying = false; }
  }

  function poll() {
    R.helper.call('/kv?since=' + Y.rev + '&id=' + R.instanceId, 4000).then(j => {
      Y.ok = true; Y.rev = j.rev;
      apply(j.items || {}, true);
      (j.events || []).forEach(e => {
        if (Date.now() - e.at > 3000) return;
        Y.applying = true;
        try { R.emit('remote:' + e.name, JSON.parse(e.data)); } catch (err) { console.error(err); } finally { Y.applying = false; }
      });
      setTimeout(poll, 600);
    }).catch(() => { Y.ok = false; setTimeout(poll, 5000); });
  }

  // Before the room is built: take the helper's state, and hand it ours if it had none.
  Y.hydrate = () => {
    if (!Y.on) return Promise.resolve();
    return R.helper.call('/kv?since=0&id=' + R.instanceId, 1500).then(j => {
      Y.ok = true; Y.rev = j.rev;
      const items = j.items || {};
      apply(items, false);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('cozy.')) continue;
        const k = key.slice(5);
        if (!(k in items) && !LOCAL.has(k)) R.store.onSet(k, localStorage.getItem(key));
      }
    }).catch(() => {}).finally(() => setTimeout(poll, 600));
  };
})(window.R);
