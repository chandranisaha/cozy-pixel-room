// Shared helpers, config, event bus. Everything hangs off window.R.
window.R = window.R || {};
(function (R) {
  R.params = new URLSearchParams(location.search);
  R.debug = R.params.has('debug');

  // ---------- persistence ----------
  R.store = {
    get(k, d) {
      try { const v = localStorage.getItem('cozy.' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      const json = JSON.stringify(v);
      try { localStorage.setItem('cozy.' + k, json); } catch (e) {}
      if (R.store.onSet) R.store.onSet(k, json);
    },
  };

  // Lively's Duplicate mode runs one copy of the page per screen. js/sync.js passes each
  // copy's writes to the other through the helper, then calls the watchers for that key.
  R.instanceId = Math.random().toString(36).slice(2, 10);
  const watchers = {};
  R.store.watch = (k, fn) => (watchers[k] = watchers[k] || []).push(fn);
  R.store.fire = k => (watchers[k] || []).forEach(fn => { try { fn(R.store.get(k)); } catch (e) { console.error(e); } });

  // ---------- config (Lively properties override defaults) ----------
  R.cfg = Object.assign({
    lat: '', lon: '',
    tempUnit: 0,          // 0 = °C, 1 = °F
    focusMin: 25, breakMin: 5,
    angryAfterMin: 90,
    catUrl: 'claude://',
    streamUrl: '',
    musicVolume: 60,
    pixelScale: 0,        // 0 = auto
    showHud: true,
    calendarIcs: '',      // Google Calendar "secret address in iCal format"
    outlookIcs: '',       // Outlook calendar "publish calendar" ICS link
    photosAlbum: '',      // Google Photos shared album link (wall + memories drawer)
    vibeLights: true,     // room lights follow the music's genre + beat
  }, R.store.get('cfg', {}));

  // Called by Lively for each property on load and on every change.
  window.livelyPropertyListener = function (name, val) {
    R.cfg[name] = val;
    R.store.set('cfg', R.cfg);
    R.emit('cfg', { name, val });
  };

  // ---------- event bus ----------
  const handlers = {};
  R.on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
  R.emit = (ev, data) => (handlers[ev] || []).forEach(fn => {
    try { fn(data); } catch (e) { console.error(ev, e); }
  });

  // per-frame updaters: fn(dt, t)
  R.updaters = [];
  R.tick = fn => R.updaters.push(fn);

  // ---------- three helpers ----------
  R.nearest = t => {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  R.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
  };
  R.canvasTex = (w, h, draw) => {
    const [c, g] = R.canvas(w, h);
    draw(g, w, h);
    const t = R.nearest(new THREE.CanvasTexture(c));
    t.userData = { canvas: c, ctx: g };
    return t;
  };
  R.mat = (color, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, o));
  R.texMat = (map, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map }, o));
  R.glow = (color) => new THREE.MeshBasicMaterial({ color });

  R.box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  };
  R.group = (x = 0, y = 0, z = 0, parent) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (parent) parent.add(g);
    return g;
  };

  R.rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  R.lerp = (a, b, t) => a + (b - a) * t;
  R.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  R.damp = (a, b, k, dt) => R.lerp(a, b, 1 - Math.exp(-k * dt));

  // ---------- interaction registry ----------
  R.clickable = [];
  R.makeClickable = (obj, label, onClick) => {
    obj.userData.onClick = onClick;
    obj.userData.label = label;
    R.clickable.push(obj);
  };

  // ---------- assets ----------
  // Images referenced in assets/manifest.js. If tools/embed_assets.py was run,
  // window.EMBEDDED holds data URIs so WebGL can use them under file://.
  R.asset = p => (window.EMBEDDED && window.EMBEDDED[p]) || p;
  R.loadTex = (path, ok, fail) => {
    if (!path) { fail && fail(); return; }
    new THREE.TextureLoader().load(R.asset(path), t => ok(R.nearest(t)), undefined, () => fail && fail());
  };

  // ---------- toast ----------
  let toastTimer;
  R.toast = msg => {
    if (R.sync && R.sync.applying) return;     // the other screen's changes arrive silently
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2600);
  };

  // ---------- pop-up panel (crate, calendar, cat's letters, bin...) ----------
  // ---------- macOS-style genie: pours out of (and back into) the point you clicked ----------
  // R.lastClick is set by main.js on every click in the room.
  R.genie = function (el, src, open, done) {
    if (el._genie) cancelAnimationFrame(el._genie);
    const r = el.getBoundingClientRect();
    src = src || { x: r.left + r.width / 2, y: window.innerHeight };
    const sx = src.x - r.left, sy = src.y - r.top;
    const below = sy > r.height / 2;               // which edge gets sucked in
    const nearY = below ? r.height : 0;
    const T = (open ? 460 : 340) * (R.genieSlow || 1), t0 = performance.now(), N = 16;   // genieSlow: for testing
    const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    el.style.transformOrigin = sx + 'px ' + nearY + 'px';
    function frame(now) {
      const p = Math.min(1, (now - t0) / T);
      const k = 1 - (open ? ease(p) : 1 - ease(p));   // 0 = full window … 1 = inside the object
      const squeeze = Math.min(1, k * 2), slide = Math.max(0, k * 2 - 1);
      const left = [], right = [];
      for (let i = 0; i <= N; i++) {
        const f = i / N;                                // 0 = far edge … 1 = edge nearest the object
        const s = Math.min(1, Math.pow(f, 1.7) * squeeze + slide);
        const y = below ? f * r.height : (1 - f) * r.height;
        left.push(R.lerp(0, sx - 4, s).toFixed(1) + 'px ' + y.toFixed(1) + 'px');
        right.unshift(R.lerp(r.width, sx + 4, s).toFixed(1) + 'px ' + y.toFixed(1) + 'px');
      }
      el.style.clipPath = 'polygon(' + left.concat(right).join(',') + ')';
      el.style.transform = 'translateY(' + ((sy - nearY) * slide).toFixed(1) + 'px) scaleY(' + (1 - 0.97 * slide).toFixed(3) + ')';
      el.style.opacity = (1 - slide * slide * 0.8).toFixed(2);
      if (p < 1) el._genie = requestAnimationFrame(frame);
      else { el._genie = 0; el.style.clipPath = el.style.transform = el.style.opacity = ''; done && done(); }
    }
    frame(t0);
  };

  R.panel = function (title, build) {
    const el = document.getElementById('panel');
    el.querySelector('.ptitle').textContent = title;
    const body = el.querySelector('.pbody');
    body.textContent = '';
    build(body);
    const wasOpen = !el.hidden && !el._closing;
    el._closing = false;
    el.hidden = false;
    R.panelOpen = title;
    if (!wasOpen) { el._src = R.lastClick; R.genie(el.querySelector('.box'), el._src, true); }
    return body;
  };
  R.closePanel = () => {
    const el = document.getElementById('panel');
    R.panelOpen = null;
    if (el.hidden || el._closing) return;
    el._closing = true;
    R.genie(el.querySelector('.box'), el._src, false, () => { if (el._closing) { el.hidden = true; el._closing = false; } });
    R.emit('panel:close');
  };
  R.openLightbox_ = el => { el._src = R.lastClick; el._closing = false; el.hidden = false; R.genie(el.querySelector('.paper'), el._src, true); };
  R.closeLightbox = () => {
    const el = document.getElementById('lightbox');
    if (el.hidden || el._closing) return;
    el._closing = true;
    R.genie(el.querySelector('.paper'), el._src, false, () => { if (el._closing) { el.hidden = true; el._closing = false; } });
  };
  // tiny DOM builder: R.el('button', { text: 'hi', onclick }, child...)
  R.el = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') e.textContent = v;
      else if (k === 'cls') e.className = v;
      else if (k.startsWith('on')) e[k] = v;
      else e.setAttribute(k, v);
    }
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
  };

  // ---------- one shared audio context ----------
  let actx;
  R.ac = () => {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  };

  // links go through the helper (opens your real browser / Spotify / Explorer)
  R.openLink = url => {
    R.helper.call(R.helper.q('/open', { url }))
      .catch(() => { try { window.open(url, '_blank'); } catch (e) { R.toast('could not open ' + url); } });
  };

  // minutes → ms; in debug mode a "minute" is one second so timers are testable
  R.min = m => m * (R.debug ? 1000 : 60000);
})(window.R);
