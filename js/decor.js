// Room makeover: a little old-school decorating window. Pick a pattern and a colour for the
// wallpaper, floor, rug, bedsheet and curtains; the room repaints as you click. Opens from a
// click on an empty bit of wall or the 🎨 button in the corner box. While it's open, clicking the
// rug, bed, walls, floor or curtains in the room jumps to that tab.
(function (R) {
  const shade = (hex, l, s = 0) => { const c = new THREE.Color(hex); c.offsetHSL(0, s, l); return '#' + c.getHexString(); };

  // ---------- patterns ----------
  // each draws one tile with the colour set c = [main, second, third]
  const WALL = {
    sprigs: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], 0.05); px(g, [[3, 3], [11, 11]]); g.fillRect(2, 4, 3, 1); g.fillRect(3, 2, 1, 3); g.fillStyle = shade(c[0], -0.03); px(g, [[11, 3], [3, 11]]); },
    stripes: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], 0.06); g.fillRect(0, 0, 4, 16); g.fillRect(8, 0, 1, 16); g.fillStyle = shade(c[0], -0.03); g.fillRect(12, 0, 1, 16); },
    checks: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], 0.05); g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8); },
    hearts: (g, c) => { fill(g, c[0], 16); g.fillStyle = c[1]; heart(g, 3, 3); g.fillStyle = shade(c[0], 0.06); heart(g, 11, 11); },
    stars: (g, c) => { fill(g, c[0], 16); g.fillStyle = c[1]; star(g, 4, 4); g.fillStyle = shade(c[0], 0.08); px(g, [[12, 11], [11, 12], [12, 12], [13, 12], [12, 13], [10, 3], [14, 7]]); },
    flowers: (g, c) => { fill(g, c[0], 16); flower(g, 4, 4, c[1], c[2]); flower(g, 12, 12, shade(c[0], 0.1), c[2]); },
    dots: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], 0.07); g.fillRect(3, 3, 2, 2); g.fillRect(11, 11, 2, 2); },
    argyle: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], 0.06); for (let i = 0; i < 8; i++) { g.fillRect(8 - i, i, 2 * i, 1); g.fillRect(8 - i, 15 - i, 2 * i, 1); } g.fillStyle = c[1]; for (let i = 0; i < 16; i += 2) { g.fillRect(i, i, 1, 1); g.fillRect(15 - i, i, 1, 1); } },
    plain: (g, c) => { fill(g, c[0], 16); g.fillStyle = shade(c[0], -0.02); g.fillRect(0, 15, 16, 1); },
  };
  const WALL_COLS = [
    ['#5d5a8c', '#f6b6c4', '#f7c86b'], ['#6f8a6a', '#f4e3b5', '#e57b5f'], ['#b07a6e', '#f6d6c8', '#f7c86b'], ['#5f7fa8', '#d6e6f7', '#f7c86b'],
    ['#9c6680', '#f8cfe0', '#fff3d6'], ['#5f9a90', '#d8f0e4', '#f6b6c4'], ['#b8a160', '#fff2c4', '#e57b5f'], ['#3c3a5c', '#8a83c8', '#f7c86b'], ['#b9ae98', '#ffffff', '#c25b5b'],
  ];

  const FLOOR = {
    planks: (g, c) => {
      const rnd = R.rng(7), tones = [c[0], shade(c[0], -0.03), shade(c[0], 0.03), shade(c[0], -0.015)];
      for (let row = 0; row < 4; row++) {
        g.fillStyle = tones[row]; g.fillRect(0, row * 8, 32, 8);
        g.fillStyle = shade(c[0], -0.12); g.fillRect(0, row * 8 + 7, 32, 1); g.fillRect(Math.floor(rnd() * 32), row * 8, 1, 8);
        g.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rnd() * 32), row * 8 + 1 + Math.floor(rnd() * 5), 3, 1);
      }
    },
    parquet: (g, c) => {
      fill(g, c[0], 32);
      for (let by = 0; by < 32; by += 16) for (let bx = 0; bx < 32; bx += 16) {
        const v = ((bx + by) / 16) % 2 === 0;
        for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? shade(c[0], 0.03) : shade(c[0], -0.02); v ? g.fillRect(bx + k * 4, by, 4, 16) : g.fillRect(bx, by + k * 4, 16, 4); }
        g.fillStyle = shade(c[0], -0.12); g.fillRect(bx, by, 16, 1); g.fillRect(bx, by, 1, 16);
      }
    },
    tiles: (g, c) => { for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? c[0] : c[1]; g.fillRect(x, y, 8, 8); } g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 32; i += 8) { g.fillRect(i, 0, 1, 32); g.fillRect(0, i, 32, 1); } },
    carpet: (g, c) => { fill(g, c[0], 32); const rnd = R.rng(3); for (let i = 0; i < 90; i++) { g.fillStyle = rnd() < 0.5 ? shade(c[0], 0.04) : shade(c[0], -0.04); g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1); } },
  };
  const FLOOR_COLS = [['#8a5636', '#6a3f27'], ['#b07a48', '#8a5636'], ['#5e3c2a', '#40281c'], ['#c9a072', '#a8805a'], ['#9a8a80', '#6a5e58'], ['#c48a8a', '#f2e0d0'], ['#e9dcc6', '#3a3560'], ['#6a7f9a', '#d6e6f7']];

  const RUG = {
    kilim: (g, c, w, h) => {
      fill(g, c[0], w, h); g.fillStyle = c[1]; g.fillRect(2, 2, w - 4, h - 4); g.fillStyle = c[2]; g.fillRect(4, 4, w - 8, h - 8); g.fillStyle = c[0]; g.fillRect(6, 6, w - 12, h - 12);
      g.fillStyle = c[1]; for (let i = 0; i < 5; i++) { const cx = 10 + i * 5, cy = h / 2; g.fillRect(cx - 1, cy - 3, 2, 6); g.fillRect(cx - 3, cy - 1, 6, 2); }
    },
    stripes: (g, c, w, h) => { const cols = [c[0], c[1], c[2], c[1]]; for (let x = 0; x < w; x += 4) { g.fillStyle = cols[(x / 4) % 4]; g.fillRect(x, 0, 4, h); } },
    checker: (g, c, w, h) => { for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? c[0] : c[1]; g.fillRect(x, y, 4, 4); } g.fillStyle = c[2]; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); },
    heart: (g, c, w, h) => { fill(g, c[1], w, h); g.fillStyle = c[0]; g.fillRect(2, 2, w - 4, h - 4); g.fillStyle = c[1]; g.fillRect(4, 4, w - 8, h - 8); g.fillStyle = c[2]; bigHeart(g, w / 2, h / 2); },
    rainbow: (g, c, w, h) => { const cols = ['#e57b5f', '#f7c86b', '#8fd6a8', '#6aa0d8', '#a88ad6', '#f6b6c4']; fill(g, c[1], w, h); for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(w / 2, h - 3, 16 - i * 2, Math.PI, 0); g.lineTo(w / 2 + 14 - i * 2, h - 3); g.arc(w / 2, h - 3, 14 - i * 2, 0, Math.PI, true); g.fill(); } },
    round: (g, c, w, h) => { fill(g, c[1], w, h); for (let r = 13; r > 0; r -= 2) { g.fillStyle = [c[0], c[2], c[1]][(r >> 1) % 3]; g.beginPath(); g.ellipse(w / 2, h / 2, r * 1.45, r, 0, 0, 7); g.fill(); } },
  };
  const RUG_COLS = [['#b85c5c', '#e8c39e', '#7a3f55'], ['#3f6f9a', '#d6e6f7', '#f7c86b'], ['#5e8c5a', '#efe3c0', '#c25b5b'], ['#e57b5f', '#ffe3b0', '#7f6bb0'], ['#f6b6c4', '#fff3f6', '#9c6680'], ['#4b4876', '#c9bfe0', '#f7c86b'], ['#3a3530', '#f4f1ea', '#d0565b']];

  const BED = {
    stripes: (g, c) => { fill(g, c[0], 24); g.fillStyle = c[1]; for (let i = 0; i < 24; i += 6) g.fillRect(i, 0, 3, 24); g.fillStyle = 'rgba(255,240,220,0.35)'; for (let j = 0; j < 24; j += 6) g.fillRect(0, j, 24, 1); },
    gingham: (g, c) => { fill(g, '#f7efe4', 24); g.globalAlpha = 0.55; g.fillStyle = c[0]; for (let i = 0; i < 24; i += 6) { g.fillRect(i, 0, 3, 24); g.fillRect(0, i, 24, 3); } g.globalAlpha = 1; },
    hearts: (g, c) => { fill(g, c[0], 24); g.fillStyle = c[1]; heart(g, 3, 4); heart(g, 15, 16); g.fillStyle = shade(c[0], 0.12); heart(g, 15, 4); heart(g, 3, 16); },
    stars: (g, c) => { fill(g, c[0], 24); g.fillStyle = c[1]; star(g, 5, 5); star(g, 17, 17); g.fillStyle = shade(c[0], 0.12); px(g, [[17, 5], [5, 17], [11, 11]]); },
    dots: (g, c) => { fill(g, c[0], 24); g.fillStyle = c[1]; for (let y = 2; y < 24; y += 6) for (let x = (y / 6) % 2 ? 5 : 2; x < 24; x += 6) g.fillRect(x, y, 2, 2); },
    patchwork: (g, c) => { const cols = [c[0], c[1], shade(c[0], 0.12), shade(c[1], -0.08)]; for (let y = 0; y < 24; y += 8) for (let x = 0; x < 24; x += 8) { g.fillStyle = cols[(x / 8 + y / 4) % 4]; g.fillRect(x, y, 8, 8); } g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 24; i += 2) { g.fillRect(i, 0, 1, 1); g.fillRect(i, 8, 1, 1); g.fillRect(i, 16, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(8, i, 1, 1); g.fillRect(16, i, 1, 1); } },
    plain: (g, c) => { fill(g, c[0], 24); g.fillStyle = shade(c[0], -0.04); g.fillRect(0, 23, 24, 1); },
  };
  const BED_COLS = [['#d98a6a', '#c46f58'], ['#f6b6c4', '#e98aa6'], ['#a88ad6', '#8a6cc0'], ['#6aa0d8', '#4d7fb8'], ['#8fc7a0', '#5e9c72'], ['#f2cf6a', '#d9a940'], ['#9a96a8', '#6e6a80'], ['#4b4876', '#f7c86b']];

  const CURTAIN = {
    pleats: (g, c) => { fill(g, c[0], 8, 16); g.fillStyle = shade(c[0], -0.08); g.fillRect(2, 0, 1, 16); g.fillRect(6, 0, 1, 16); },
    dots: (g, c) => { fill(g, c[0], 8, 16); g.fillStyle = '#fff3f0'; px(g, [[1, 2], [5, 6], [1, 10], [5, 14]]); },
    gingham: (g, c) => { fill(g, '#f7efe4', 8, 16); g.globalAlpha = 0.6; g.fillStyle = c[0]; for (let i = 0; i < 16; i += 4) { g.fillRect(i % 8, 0, 2, 16); g.fillRect(0, i, 8, 2); } g.globalAlpha = 1; },
    stars: (g, c) => { fill(g, c[0], 8, 16); g.fillStyle = '#f7d77a'; px(g, [[2, 3], [1, 4], [2, 4], [3, 4], [2, 5], [6, 11], [5, 12], [6, 12], [7, 12], [6, 13]]); },
  };
  const CURTAIN_COLS = [['#c0607a'], ['#e9a0b4'], ['#7f6bb0'], ['#5d7fa8'], ['#6f9e7a'], ['#e0a85a'], ['#efe3d0'], ['#3a3560']];

  function fill(g, c, w, h = w) { g.fillStyle = c; g.fillRect(0, 0, w, h); }
  function px(g, pts) { pts.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); }
  function heart(g, x, y) { [[1, 0, 2], [4, 0, 2], [0, 1, 7], [0, 2, 7], [1, 3, 5], [2, 4, 3], [3, 5, 1]].forEach(([dx, dy, w]) => g.fillRect(x + dx, y + dy, w, 1)); }
  function bigHeart(g, cx, cy) { for (let y = -6; y <= 6; y++) for (let x = -8; x <= 8; x++) { const X = x / 7, Y = -y / 7 + 0.3; if ((X * X + Y * Y - 1) ** 3 - X * X * Y * Y * Y < 0) g.fillRect(cx + x, cy + y, 1, 1); } }
  function star(g, x, y) { g.fillRect(x, y - 2, 1, 5); g.fillRect(x - 2, y, 5, 1); g.fillRect(x - 1, y - 1, 3, 3); }
  function flower(g, x, y, petal, mid) { g.fillStyle = petal; g.fillRect(x - 1, y - 2, 2, 1); g.fillRect(x - 1, y + 1, 2, 1); g.fillRect(x - 2, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); g.fillStyle = mid; g.fillRect(x - 1, y - 1, 2, 2); }

  // what each part of the room is, and where its texture goes
  const PARTS = {
    wall: { name: 'wallpaper', icon: '🧱', pats: WALL, cols: WALL_COLS, size: [16, 16], def: { p: 'sprigs', c: 0 }, repeat: [8, 4] },
    floor: { name: 'floor', icon: '🪵', pats: FLOOR, cols: FLOOR_COLS, size: [32, 32], def: { p: 'planks', c: 0 }, repeat: [6, 5] },
    rug: { name: 'rug', icon: '🧶', pats: RUG, cols: RUG_COLS, size: [40, 28], def: { p: 'kilim', c: 0 } },
    bed: { name: 'bedsheet', icon: '🛏', pats: BED, cols: BED_COLS, size: [24, 24], def: { p: 'stripes', c: 0 } },
    curtain: { name: 'curtains', icon: '🪟', pats: CURTAIN, cols: CURTAIN_COLS, size: [8, 16], def: { p: 'pleats', c: 0 } },
  };
  const TABS = Object.keys(PARTS);

  function draw(part, p, ci, g, w, h) {
    const P = PARTS[part];
    (P.pats[p] || P.pats[P.def.p])(g, P.cols[ci] || P.cols[0], w, h);
    if (part === 'rug') { g.fillStyle = '#f3dcc0'; for (let x = 0; x < w; x += 2) { g.fillRect(x, 0, 1, 1); g.fillRect(x, h - 1, 1, 1); } }   // fringe
  }
  function texFor(part, p, ci) {
    const P = PARTS[part], [w, h] = P.size;
    const t = R.canvasTex(w, h, (g) => draw(part, p, ci, g, w, h));
    if (P.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(P.repeat[0], P.repeat[1]); }
    return t;
  }
  function mats(part) {
    const D = R.decorParts;
    if (part === 'wall') return D.walls.map(w => w.material);
    if (part === 'floor') return [D.floorMat];
    if (part === 'rug') return R.rug ? [R.rug.material] : [];
    if (part === 'bed') return [D.blanketMat];
    if (part === 'curtain') return [D.curtainMat];
    return [];
  }
  const get = () => Object.assign({}, ...TABS.map(k => ({ [k]: PARTS[k].def })), R.store.get('decor', {}));
  function paint(part) {
    const d = get()[part], t = texFor(part, d.p, d.c);
    if (part === 'wall') {
      // each wall piece gets its own copy, tiled to its size, so the pattern is the same scale everywhere
      R.decorParts.walls.forEach(w => {
        const g = w.geometry.parameters, wide = g.width > g.depth ? g.width : g.depth, tt = t.clone();
        tt.needsUpdate = true; tt.repeat.set(wide / 0.95, g.height / 0.95);
        if (w.material.map) w.material.map.dispose();
        w.material.map = tt; w.material.needsUpdate = true;
      });
    } else mats(part).forEach(m => { if (m.map && m.map !== t) m.map.dispose(); m.map = t; m.needsUpdate = true; });
    if (part === 'bed') R.decorParts.sheetMat.color.set(shade((PARTS.bed.cols[d.c] || PARTS.bed.cols[0])[0], 0.3, -0.25));   // the sheet underneath goes with it
  }
  function set(part, patch) {
    const all = R.store.get('decor', {});
    all[part] = Object.assign({}, get()[part], patch);
    R.store.set('decor', all);
    paint(part);
    R.sfx.pop(380 + Math.random() * 200);
  }

  // ---------- the window ----------
  let win = null, tab = 'wall';
  function swatch(part, p, ci, size) {
    const P = PARTS[part], [w, h] = P.size, [c, g] = R.canvas(w, h);
    draw(part, p, ci, g, w, h);
    c.style.width = size + 'px'; c.style.height = Math.round(size * Math.min(1, h / w)) + 'px';
    return c;
  }
  function render() {
    if (!win) return;
    const body = win.querySelector('.dbody'), tabs = win.querySelector('.dtabs');
    tabs.innerHTML = '';
    TABS.forEach(k => tabs.append(R.el('button', { cls: k === tab ? 'on' : '', text: PARTS[k].icon + ' ' + PARTS[k].name, onclick: () => { tab = k; render(); } })));
    const P = PARTS[tab], d = get()[tab];
    body.innerHTML = '';
    const pats = R.el('div', { cls: 'dgrid' });
    Object.keys(P.pats).forEach(p => {
      const orig = p === P.def.p;
      const b = R.el('button', { cls: 'dsw' + (p === d.p ? ' on' : ''), title: orig ? p + ' (the original)' : p, onclick: () => { set(tab, { p }); render(); } });
      b.append(swatch(tab, p, d.c, 46), R.el('span', { text: (orig ? '★ ' : '') + p }));
      pats.append(b);
    });
    const cols = R.el('div', { cls: 'dcols' });
    P.cols.forEach((c, i) => {
      const b = R.el('button', { cls: 'dchip' + (i === d.c ? ' on' : '') + (i === P.def.c ? ' orig' : ''), title: i === P.def.c ? 'the original colours' : 'colour ' + (i + 1), onclick: () => { set(tab, { c: i }); render(); } });
      b.style.background = c.length > 1 && tab !== 'curtain' ? 'linear-gradient(135deg,' + c[0] + ' 60%,' + c[1] + ' 60%)' : c[0];
      cols.append(b);
    });
    body.append(R.el('div', { cls: 'dlab', text: 'pattern' }), pats, R.el('div', { cls: 'dlab', text: 'colours' }), cols);
    win.querySelector('.dstatus').textContent = '★ = the original · click the rug, bed, walls, floor or curtains to switch';
  }
  function open(which) {
    if (which && PARTS[which]) tab = which;
    if (!win) {
      win = R.el('div', { id: 'decor', cls: 'y2k' });
      const bar = R.el('div', { cls: 'dbar' }, R.el('span', { text: '🎨 room_makeover.exe' }),
        R.el('span', { cls: 'dbtns' }, R.el('button', { text: '?', title: 'how it works', onclick: () => R.toast('pick a pattern, then a colour · the room repaints as you click') }), R.el('button', { text: '×', title: 'close', onclick: close })));
      win.append(bar, R.el('div', { cls: 'dtabs' }), R.el('div', { cls: 'dbody' }),
        R.el('div', { cls: 'dfoot' },
          R.el('button', { text: '🎲 surprise', onclick: surprise }),
          R.el('button', { text: '↺ this one', title: 'put this part back to the original', onclick: () => { set(tab, PARTS[tab].def); render(); } }),
          R.el('button', { text: '★ original room', title: 'the whole room back to how it first looked', onclick: () => { resetAll(); render(); } }),
          R.el('button', { text: '✓ done', onclick: close })),
        R.el('div', { cls: 'dstatus' }));
      document.body.append(win);
      dragBy(bar, win);
      R.sfx.drawer && R.sfx.drawer();
    }
    win.hidden = false;
    R.decor.isOpen = true;
    render();
  }
  function resetAll() {
    R.store.set('decor', {});
    TABS.forEach(paint);
    R.sfx.pop(520);
    R.toast('the room is back to the original ★');
  }
  function close() { if (win) win.hidden = true; R.decor.isOpen = false; }
  function surprise() {
    const P = PARTS[tab], ps = Object.keys(P.pats);
    set(tab, { p: ps[Math.floor(Math.random() * ps.length)], c: Math.floor(Math.random() * P.cols.length) });
    render();
  }
  function dragBy(handle, el) {
    handle.addEventListener('mousedown', ev => {
      if (ev.target.closest('button')) return;
      const r = el.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      const mv = e => { el.style.left = R.clamp(e.clientX - ox, 0, innerWidth - 80) + 'px'; el.style.top = R.clamp(e.clientY - oy, 0, innerHeight - 40) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
      ev.preventDefault();
    });
  }

  R.decor = { open, close, isOpen: false, set, resetAll, PARTS };

  R.buildDecor = function () {
    R.decorParts.walls.forEach(w => (w.material = w.material.clone()));
    TABS.forEach(paint);
    R.store.watch('decor', () => { TABS.forEach(paint); render(); });
    const D = R.decorParts;
    // the walls themselves: an empty bit of wall opens the makeover
    D.walls.forEach(w => R.makeClickable(w, 'wallpaper · click to redecorate the room', () => open('wall')));
    // while the window is open, things in the room pick their tab instead of doing their usual thing
    D.walls.forEach(w => (w.userData.decor = 'wall'));
    D.floor.userData.decor = 'floor';
    if (R.rug) R.rug.userData.decor = 'rug';
    R.bedGroup.userData.decor = 'bed';
    R.curtains.forEach(c => (c.userData.decor = 'curtain'));
    R.decorPick = (hits) => {
      if (!R.decor.isOpen) return false;
      for (const h of hits) {
        for (let o = h.object; o; o = o.parent) if (o.userData.decor) { open(o.userData.decor); return true; }
      }
      return false;
    };
  };
})(window.R);
