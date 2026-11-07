// The tape drawer, in the record cabinet under the turntable.
//  · mixtapes: each cassette is an ambience layer (rain, fireplace, café, typing, birds, waves,
//    night). Click a tape to play it, slide to mix; they layer under your music. The mix is saved.
//  · sticker book: every finished focus session the cat finds a pixel sticker. Stick your
//    favourites onto the cabinet (up to 6).
(function (R) {
  const TAPES = [
    { id: 'rain', name: 'rainy window', side: 'A', make: 'rain', c: '#9ec5e8', d: '#5b86b8', vol: 0.7 },
    { id: 'fire', name: 'crackly fireplace', side: 'A', make: 'fire', c: '#f4a27a', d: '#c0603e', vol: 0.8 },
    { id: 'cafe', name: 'corner café', side: 'B', make: 'cafe', c: '#e4c49a', d: '#a57a4a', vol: 0.55 },
    { id: 'keys', name: 'clacky keyboard', side: 'B', make: 'keys', c: '#c3b2f0', d: '#7d66c2', vol: 0.5 },
    { id: 'birds', name: 'morning birds', side: 'A', make: 'birds', c: '#b5e0a6', d: '#5e9a52', vol: 0.9 },
    { id: 'waves', name: 'sleepy waves', side: 'B', make: 'waves', c: '#9adbd8', d: '#3f9894', vol: 0.8 },
    { id: 'night', name: 'crickets & city', side: 'A', make: 'crickets', c: '#8d88c8', d: '#4a4590', vol: 0.8 },
    { id: 'brown', name: 'cozy brown noise', side: 'B', make: 'brown', c: '#f2a6c0', d: '#b8577e', vol: 0.45 },
  ];

  // ---------- stickers: 10×10 pixel art. o = outline ----------
  const PAL = { o: '#2b2140', K: '#2f2a38', W: '#fbf6ec', G: '#7fcf6a', g: '#3f8a3a', P: '#f29aaa', R: '#ff6b6b', r: '#a83246',
    Y: '#ffd04a', y: '#c98a1a', B: '#6aa0d8', N: '#7d66c2', F: '#f4a259', T: '#d9824a', s: '#c9c9d9', C: '#8a5a3a', k: '#1c1824', E: '#a8e06a' };
  const STICKERS = [
    { id: 'cat', name: 'tuxedo cat', px: ['..o....o..', '.oKo..oKo.', '.oKKooKKo.', 'oKKKKKKKKo', 'oKEKWWKEKo', 'oKKKWWKKKo', 'oKKWWWWKKo', '.oKWPPWKo.', '..oWWWWo..', '...oooo...'] },
    { id: 'heart', name: 'big heart', px: ['..........', '.oo...oo..', 'oRRo.oRRo.', 'oRWRoRRRo.', 'oRRRRRRRo.', '.oRRRRRo..', '..oRRRo...', '...oRo....', '....o.....', '..........'] },
    { id: 'star', name: 'gold star', px: ['....o.....', '...oYo....', '...oYo....', 'ooooYYoooo', 'oYYYYYYYYo', '.oYYWYYYo.', '..oYYYYo..', '.oYYooYYo.', '.oYo..oYo.', '.oo....oo.'] },
    { id: 'moon', name: 'sleepy moon', px: ['...oooo...', '..oYYYo...', '.oYYYo....', '.oYYo.....', '.oYkYo....', '.oYYo.....', '.oYYYo....', '..oYYYoo..', '...ooooo..', '..........'] },
    { id: 'shroom', name: 'lil mushroom', px: ['...oooo...', '.ooRRWRoo.', 'oRWRRRRRRo', 'oRRRRRWRRo', 'oooooooooo', '...oWWo...', '..oWkWko..', '...oWWo...', '...oooo...', '..........'] },
    { id: 'coffee', name: 'warm coffee', px: ['..s.s.....', '...s.s....', '..........', 'oooooooo..', 'oWWWWWWooo', 'oWCCCCWo.o', 'oWWWWWWooo', 'oWWPWWWo..', '.oooooo...', '..........'] },
    { id: 'berry', name: 'strawberry', px: ['...ogGo...', '..oGGGGo..', '.oRRRRRRo.', 'oRWRRRWRRo', 'oRRRWRRRRo', 'oRWRRRRWRo', '.oRRRWRRo.', '..oRRRRo..', '...oooo...', '..........'] },
    { id: 'ghost', name: 'shy ghost', px: ['...oooo...', '..oWWWWo..', '.oWWWWWWo.', '.oWkWWkWo.', '.oWPWWPWo.', '.oWWWWWWo.', '.oWWWWWWo.', '.oWWWWWWo.', '.oWoWWoWo.', '..o.oo.o..'] },
    { id: 'frog', name: 'froggy', px: ['.oo....oo.', 'oWko..oWko', 'oGGGooGGGo', 'oGGGGGGGGo', 'oGPGGGGPGo', 'oGGkkkkGGo', '.oGGGGGGo.', '..oooooo..', '..........', '..........'] },
    { id: 'rainbow', name: 'rainbow', px: ['..........', '..oooooo..', '.oRRRRRRo.', 'oRYYYYYYRo', 'oRYBBBBYRo', 'oRYBooBYRo', 'oWWWo.WWWo', 'oWWWWoWWWo', '.oooo.ooo.', '..........'] },
    { id: 'note', name: 'music note', px: ['....oooooo', '....oNNNNo', '....oNoooo', '....oNo...', '....oNo...', '..oooNo...', '.oNNNNo...', '.oNNNo....', '..ooo.....', '..........'] },
    { id: 'tomato', name: 'focus tomato', px: ['....oo....', '..ogGGgo..', '.ooRRRRoo.', 'oRRWRRRRRo', 'oRWRRRRRRo', 'oRRRRRRRRo', 'oRRRRRRRRo', '.oRRRRRRo.', '..oooooo..', '..........'] },
    { id: 'cactus', name: 'tiny cactus', px: ['....oo....', '...oGGo...', '.o.oGGo.o.', 'oGooGGooGo', 'oGGGGGGGGo', '.ooGGGGoo.', '...oGGo...', '..oTTTTo..', '..oTTTTo..', '...oooo...'] },
    { id: 'onigiri', name: 'onigiri', px: ['....oo....', '...oWWo...', '..oWWWWo..', '..oWkWkWo.', '.oWWWPWWo.', '.oWWWWWWo.', 'oWWkkkkWWo', 'oWWkkkkWWo', 'oooooooooo', '..........'] },
    { id: 'planet', name: 'ringed planet', px: ['...oooo...', '..oNNNNo..', '.oNWNNNNo.', 'YYYYYYYYYY', '.oNNNNNNo.', '..oNNNNo..', '...oooo...', '..........', '..........', '..........'] },
    { id: 'fish', name: 'cat snack', px: ['..........', '...oooo..o', '..oFFFFooo', '.oFkFFFFFo', '.oFFFFFFFo', '..oFFFFooo', '...oooo..o', '..........', '..........', '..........'] },
  ];
  function stickerCanvas(s, dark) {
    const [c, g] = R.canvas(14, 14);
    const on = (x, y) => y >= 0 && y < 10 && x >= 0 && x < 10 && s.px[y][x] !== '.';
    g.fillStyle = dark ? 'rgba(43,33,64,.25)' : '#fff';            // die-cut white edge
    for (let y = -1; y <= 10; y++) for (let x = -1; x <= 10; x++) {
      let n = false;
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1 && !n; dx++) n = on(x + dx, y + dy);
      if (n) g.fillRect(x + 2, y + 2, 1, 1);
    }
    if (!dark) for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const k = s.px[y][x]; if (k !== '.') { g.fillStyle = PAL[k] || '#000'; g.fillRect(x + 2, y + 2, 1, 1); } }
    return c;
  }

  // ---------- the cassette (canvas, for the 3D ones in the drawer) ----------
  function cassetteCanvas(t) {
    const [c, g] = R.canvas(32, 20);
    g.fillStyle = '#2b2140'; g.fillRect(0, 0, 32, 20);
    g.fillStyle = t.c; g.fillRect(1, 1, 30, 18);
    g.fillStyle = '#fff6e0'; g.fillRect(3, 2, 26, 9);
    g.fillStyle = t.d; g.fillRect(3, 8, 26, 1); g.fillRect(3, 10, 26, 1);
    g.fillStyle = '#2b2140'; g.fillRect(9, 4, 14, 1); g.fillRect(9, 6, 10, 1);
    g.fillStyle = '#2b2140'; g.fillRect(8, 12, 16, 5);
    g.fillStyle = '#8a5a3a'; g.fillRect(9, 13, 14, 3);
    g.fillStyle = '#fff6e0'; g.fillRect(10, 13, 3, 3); g.fillRect(19, 13, 3, 3);
    g.fillStyle = '#2b2140'; g.fillRect(11, 14, 1, 1); g.fillRect(20, 14, 1, 1);
    g.fillStyle = t.d; g.fillRect(2, 18, 1, 1); g.fillRect(29, 18, 1, 1); g.fillRect(2, 1, 1, 1); g.fillRect(29, 1, 1, 1);
    return c;
  }

  const CSS = `
  #panel .box:has(.tapes) { width: min(880px, 94vw); max-height: 86vh; }
  .tapes .tabs { display: flex; gap: 6px; margin-bottom: 10px; }
  .tapes .tabs button.on { background: var(--accent); color: #2b2140; }
  .tapes .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px 12px; }
  .tape { --c: #9ec5e8; --d: #5b86b8; display: flex; flex-direction: column; gap: 6px; }
  .tape .shell { position: relative; aspect-ratio: 1.6; background: var(--c); border: 3px solid #2b2140; border-radius: 6px;
    box-shadow: 4px 4px 0 rgba(0,0,0,.35), inset 0 0 0 3px rgba(255,255,255,.25); cursor: pointer; transition: transform .15s; image-rendering: pixelated; }
  .tape .shell:hover { transform: translateY(-2px) rotate(-1deg); }
  .tape.on .shell { box-shadow: 4px 4px 0 rgba(0,0,0,.35), 0 0 0 3px var(--accent), inset 0 0 0 3px rgba(255,255,255,.25); }
  .tape .screw { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #e9e2f2; border: 2px solid #2b2140; box-sizing: border-box; }
  .tape .screw::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: #2b2140; transform: rotate(45deg); }
  .tape .s1 { left: 4px; top: 4px; } .tape .s2 { right: 4px; top: 4px; } .tape .s3 { left: 4px; bottom: 4px; } .tape .s4 { right: 4px; bottom: 4px; }
  .tape .label { position: absolute; left: 9%; right: 9%; top: 8%; height: 50%; background: #fff6e0; border: 2px solid #2b2140; border-radius: 3px;
    background-image: linear-gradient(to bottom, transparent 70%, var(--d) 70%, var(--d) 74%, transparent 74%, transparent 80%, var(--d) 80%, var(--d) 84%, transparent 84%); }
  .tape .ttl { position: absolute; left: 8px; right: 26px; top: 2px; font-family: Gaegu, 'Comic Sans MS', cursive; font-size: 19px; line-height: 1.05; color: #2b2140; transform: rotate(-1.5deg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tape .side { position: absolute; right: 4px; top: 2px; width: 18px; height: 18px; background: var(--d); color: #fff6e0; font-size: 16px; line-height: 18px; text-align: center; border-radius: 3px; }
  .tape .win { position: absolute; left: 26%; right: 26%; top: 44%; height: 26%; background: #2b2140; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; padding: 0 9%; box-sizing: border-box; z-index: 1; }
  .tape .win::before { content: ''; position: absolute; left: 30%; right: 30%; top: 30%; bottom: 30%; background: #7a4a2e; }
  .tape .reel { position: relative; width: 26%; aspect-ratio: 1; border-radius: 50%; background: #fff6e0; box-shadow: 0 0 0 3px #7a4a2e;
    background-image: conic-gradient(#2b2140 0 10%, transparent 10% 33%, #2b2140 33% 43%, transparent 43% 66%, #2b2140 66% 76%, transparent 76%);
    animation: reel var(--spd, 2s) linear infinite; animation-play-state: paused; }
  .tape .reel.r { box-shadow: 0 0 0 1px #7a4a2e; }
  .tape.on .reel { animation-play-state: running; }
  @keyframes reel { to { transform: rotate(-360deg); } }
  .tape .foot { position: absolute; left: 22%; right: 22%; bottom: -3px; height: 16%; background: var(--d); border: 3px solid #2b2140; border-bottom: none; clip-path: polygon(8% 0, 92% 0, 100% 100%, 0 100%); }
  .tape .foot::before, .tape .foot::after { content: ''; position: absolute; bottom: 20%; width: 8%; height: 40%; background: #2b2140; border-radius: 50%; }
  .tape .foot::before { left: 22%; } .tape .foot::after { right: 22%; }
  .tape input[type=range] { width: 100%; accent-color: var(--d); }
  .tapes .stickers { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; }
  .stk-slot { position: relative; background: #f4ecdc; border: 3px dashed #b7a98f; border-radius: 6px; aspect-ratio: 1; display: grid; place-items: center; cursor: default; }
  .stk-slot.got { border-style: solid; border-color: #2b2140; cursor: pointer; background: #f4ecdc radial-gradient(rgba(70,45,20,.07) 1px, transparent 1.3px) 0 0 / 7px 7px; }
  .stk-slot.stuck { box-shadow: 0 0 0 3px var(--accent); }
  .stk-slot canvas { width: 72%; image-rendering: pixelated; transform: rotate(var(--rot, -4deg)); filter: drop-shadow(2px 2px 0 rgba(0,0,0,.25)); }
  .stk-slot .n { position: absolute; right: 4px; bottom: 2px; font-size: 16px; color: #5a4a6e; }
  .stk-slot .pin { position: absolute; left: 4px; top: 0; font-size: 16px; color: #c0392b; }
  .tapes .hint { color: var(--dim); font-size: 18px; margin: 8px 0 0; }`;

  // ---------- the mixer ----------
  let bus = null;
  const live = {};
  function busNode() {
    if (!bus) { const ac = R.ac(); bus = ac.createGain(); bus.gain.value = 0.9; bus.connect(ac.destination); }
    return bus;
  }
  let cur = null;
  const mixOf = () => cur || (cur = R.store.get('mix', {}));
  function apply() {
    cur = null;
    const mix = mixOf();
    TAPES.forEach(t => {
      const v = +(mix[t.id] || 0);
      if (v > 0) {
        if (!live[t.id]) { try { live[t.id] = R.sfx[t.make](busNode()); } catch (e) { console.error(e); return; } }
        clearTimeout(live[t.id].bye);
        R.sfx.fade(live[t.id], v * t.vol, 1.2);
      } else if (live[t.id]) {
        const n = live[t.id]; delete live[t.id];
        R.sfx.fade(n, 0, 0.8);
        n.bye = setTimeout(() => { try { n.stop(); } catch (e) {} }, 1200);
      }
    });
    R.emit('tapes', mix);
  }
  function setMix(id, v) {
    const mix = Object.assign({}, mixOf());
    if (v > 0) mix[id] = Math.round(v * 100) / 100; else delete mix[id];
    R.store.set('mix', mix);
    apply();
  }

  // ---------- stickers ----------
  const book = () => Object.assign({ got: {}, stuck: [], last: 0 }, R.store.get('stickers', {}));
  function award(key) {
    const b = book();
    if (b.last === key) return null;               // the other screen already counted this session
    let r = R.rng ? R.rng(key % 100000) : Math.random;
    const missing = STICKERS.filter(s => !b.got[s.id]);
    const pool = missing.length ? missing : STICKERS;
    const s = pool[Math.floor(r() * pool.length) % pool.length];
    b.got = Object.assign({}, b.got, { [s.id]: (b.got[s.id] || 0) + 1 });
    b.last = key;
    R.store.set('stickers', b);
    return s;
  }

  R.buildTapes = function () {
    document.head.append(R.el('style', { text: CSS }));
    const cab = R.cabinet;
    const d = R.group(0.5, 0.85, 0, cab);           // the drawer, sliding out along +x
    const front = R.mat('#c99566'), wood = R.mat('#8a5c3a'), inner = R.mat('#5e4128');
    R.box(0.012, 0.48, 1.96, R.mat('#4a3020'), 0.006, 0, 0, cab).position.set(0.506, 0.85, 0);   // the gap around it
    R.box(0.06, 0.42, 1.9, front, 0.03, 0, 0, d);
    R.box(0.05, 0.06, 0.42, R.mat('#d8b07a'), 0.075, 0.04, 0, d);
    const lbl = R.canvasTex(24, 8, g => { g.fillStyle = '#fff6e0'; g.fillRect(0, 0, 24, 8); g.fillStyle = '#2b2140'; g.fillRect(0, 0, 24, 1); g.fillRect(0, 7, 24, 1); g.fillRect(0, 0, 1, 8); g.fillRect(23, 0, 1, 8);
      g.fillStyle = '#7d66c2'; [3, 5, 7, 9].forEach(x => g.fillRect(x, 3, 1, 2)); g.fillStyle = '#2b2140'; g.fillRect(12, 3, 8, 1); g.fillRect(12, 5, 6, 1); });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12), R.texMat(lbl)); lm.position.set(0.061, -0.1, 0); lm.rotation.y = Math.PI / 2; d.add(lm);
    R.box(0.62, 0.03, 1.8, inner, -0.31, -0.18, 0, d);
    R.box(0.62, 0.3, 0.03, wood, -0.31, -0.05, -0.89, d); R.box(0.62, 0.3, 0.03, wood, -0.31, -0.05, 0.89, d);
    R.box(0.03, 0.3, 1.8, wood, -0.61, -0.05, 0, d);
    // the tapes lying in it
    const tapes3d = TAPES.map((t, i) => {
      const tex = R.nearest(new THREE.CanvasTexture(cassetteCanvas(t)));
      const side = R.mat(t.c);
      const m = R.box(0.34, 0.05, 0.21, [side, side, R.texMat(tex), side, side, side], -0.3 + (i % 2) * 0.03, -0.14, -0.77 + i * 0.22, d);
      m.rotation.y = i % 2 ? 0.06 : -0.05;
      m.userData.y = m.position.y;
      return m;
    });

    // stickers on the cabinet front, under the drawer
    const decals = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.5 }));
      m.position.set(0.505, 0.3 + (i % 2 ? 0.14 : 0), -0.82 + i * 0.33); m.rotation.set(0, Math.PI / 2, (i % 3 - 1) * 0.18);
      m.visible = false; cab.add(m); decals.push(m);
    }
    function drawDecals() {
      const b = book();
      decals.forEach((m, i) => {
        const s = STICKERS.find(x => x.id === b.stuck[i]);
        m.visible = !!s;
        if (!s) return;
        if (m.userData.id === s.id) return;
        m.userData.id = s.id;
        m.material.map && m.material.map.dispose();
        m.material.map = R.nearest(new THREE.CanvasTexture(stickerCanvas(s))); m.material.needsUpdate = true;
      });
    }
    drawDecals();
    R.store.watch('stickers', () => { drawDecals(); if (R.panelOpen && R.panelOpen.startsWith('the tape drawer') && tab === 'stickers') show(); });

    let open = false, k = 0, tab = 'tapes';
    function setOpen(o) { if (open === o) return; open = o; R.sfx.drawer(o); }

    function tapeEl(t, mix) {
      const v = +(mix[t.id] || 0);
      const el = R.el('div', { cls: 'tape' + (v > 0 ? ' on' : '') });
      el.style.setProperty('--c', t.c); el.style.setProperty('--d', t.d);
      el.style.setProperty('--spd', (3.2 - v * 2.2).toFixed(2) + 's');
      const shell = R.el('div', { cls: 'shell', title: v > 0 ? 'click to stop' : 'click to play' },
        ['s1', 's2', 's3', 's4'].map(c => R.el('i', { cls: 'screw ' + c })),
        R.el('div', { cls: 'label' }, R.el('span', { cls: 'ttl', text: t.name }), R.el('span', { cls: 'side', text: t.side })),
        R.el('div', { cls: 'win' }, R.el('b', { cls: 'reel l' }), R.el('b', { cls: 'reel r' })),
        R.el('div', { cls: 'foot' }));
      const sl = R.el('input', { type: 'range', min: 0, max: 100, title: t.name + ' volume' });
      sl.value = Math.round(v * 100);
      shell.onclick = () => { R.sfx.clack(); setMix(t.id, v > 0 ? 0 : (R.store.get('mixLast', {})[t.id] || 0.6)); show(); };
      sl.oninput = () => {
        const nv = sl.value / 100;
        el.classList.toggle('on', nv > 0); el.style.setProperty('--spd', (3.2 - nv * 2.2).toFixed(2) + 's');
        clearTimeout(sl._t); sl._t = setTimeout(() => setMix(t.id, nv), 60);
        if (nv > 0) R.store.set('mixLast', Object.assign({}, R.store.get('mixLast', {}), { [t.id]: nv }));
      };
      el.append(shell, sl);
      return el;
    }
    function show() {
      R.panel('the tape drawer 📼', body => {
        const wrap = R.el('div', { cls: 'tapes' });
        const b = book(), have = Object.keys(b.got).length;
        wrap.append(R.el('div', { cls: 'tabs' },
          R.el('button', { cls: tab === 'tapes' ? 'on' : '', text: '📼 mixtapes', onclick: () => { tab = 'tapes'; show(); } }),
          R.el('button', { cls: tab === 'stickers' ? 'on' : '', text: '★ sticker book ' + have + '/' + STICKERS.length, onclick: () => { tab = 'stickers'; show(); } })));
        if (tab === 'tapes') {
          const mix = mixOf();
          wrap.append(R.el('div', { cls: 'grid' }, TAPES.map(t => tapeEl(t, mix))));
          const on = TAPES.filter(t => mix[t.id] > 0).length;
          wrap.append(R.el('div', { cls: 'prow' },
            R.el('small', { cls: 'dim', text: on ? on + ' tape' + (on > 1 ? 's' : '') + ' playing · they layer under your music' : 'click a tape to play it, slide to mix them' }),
            on ? R.el('button', { text: '⏏ eject all', onclick: () => { R.sfx.clack(); R.store.set('mix', {}); apply(); show(); } }) : null));
        } else {
          wrap.append(R.el('div', { cls: 'stickers' }, STICKERS.map((s, i) => {
            const n = b.got[s.id] || 0, stuck = b.stuck.includes(s.id);
            const cv = stickerCanvas(s, !n); cv.style.setProperty('--rot', ((i * 37) % 13 - 6) + 'deg');
            const slot = R.el('div', { cls: 'stk-slot' + (n ? ' got' : '') + (stuck ? ' stuck' : ''), title: n ? s.name + (stuck ? ' · on the cabinet (click to peel off)' : ' · click to stick it on the cabinet') : '??? · keep focusing' },
              cv, n > 1 ? R.el('span', { cls: 'n', text: '×' + n }) : null, stuck ? R.el('span', { cls: 'pin', text: '📌' }) : null);
            if (n) slot.onclick = () => {
              const bb = book();
              let st = bb.stuck.filter(x => x !== s.id);
              if (!stuck) { if (st.length >= 6) { R.toast('the cabinet fits 6 stickers. peel one off first'); return; } st = st.concat(s.id); }
              bb.stuck = st; R.store.set('stickers', bb); R.sfx.peel(0.8); drawDecals(); show();
            };
            return slot;
          })));
          wrap.append(R.el('p', { cls: 'hint', text: have < STICKERS.length
            ? 'finish a focus session and the cat finds you a new sticker · ' + (STICKERS.length - have) + ' still hiding'
            : 'you found every sticker ✨ extra ones still turn up as doubles' }));
        }
        body.append(wrap);
      });
    }

    R.makeClickable(d, 'tape drawer · ambience mixtapes + your sticker book', () => {
      if (open) { R.closePanel(); return; }
      setOpen(true);
      setTimeout(show, 420);
    });
    R.on('panel:close', () => { if (open) setTimeout(() => setOpen(false), 250); });

    // a finished focus session → a sticker
    R.on('focus:done', () => {
      const s = award(R.pomo.endsAt || Date.now());
      if (!s) return;
      setTimeout(() => { R.catSay('found a sticker for you: ' + s.name + '!', 4); R.toast('★ new sticker: ' + s.name + ' (in the tape drawer)'); }, 1500);
    });

    R.store.watch('mix', apply);
    apply();
    let t = 0;
    R.tick(dt => {
      t += dt;
      k = R.damp(k, open ? 1 : 0, 9, dt);
      d.position.x = 0.5 + k * 0.5;
      const mix = mixOf();
      tapes3d.forEach((m, i) => { const on = mix[TAPES[i].id] > 0; m.position.y = m.userData.y + (on ? 0.02 + Math.abs(Math.sin(t * 3 + i)) * 0.015 : 0); });
    });
    R.tapes = { show, setMix, award, STICKERS, TAPES };
  };
})(window.R);
