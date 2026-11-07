// Record crate next to the turntable. Clicking it opens CRATE, a vinyl catalogue magazine:
// one record per page (built-in stations and your Spotify playlists from
// assets/manifest.js → records), with paper page turns that peel from the corner (drag, click, scroll or arrow)
// through. Click the vinyl on a page to drop the needle: the turntable swaps records and it
// plays (Spotify playlists start in the app on their own, through the helper).
(function (R) {
  const M = R.music;

  // ---------- pixel art ----------
  function sleeveCanvas(r, i) {
    const [c, g] = R.canvas(24, 24);
    g.fillStyle = r.color; g.fillRect(0, 0, 24, 24);
    g.fillStyle = r.label;
    const rnd = R.rng(7 + i * 13);
    const style = i % 3;
    if (style === 0) { for (let y = 3; y < 24; y += 5) g.fillRect(0, y, 24, 2); }
    else if (style === 1) { for (let d = 0; d < 9; d++) g.fillRect(12 - d, 12 - d, d * 2, 1); g.fillRect(4, 18, 16, 2); }
    else { for (let k = 0; k < 12; k++) g.fillRect(Math.floor(rnd() * 22), Math.floor(rnd() * 22), 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 22, 24, 2);
    return c;
  }
  // covers load once; drawn small (so they come out pixelated) wherever they are used
  const covers = {};
  function cover(r) {
    if (!r.cover) return Promise.resolve(null);
    return (covers[r.cover] = covers[r.cover] || new Promise(ok => {
      const im = new Image();
      im.onload = () => ok(im); im.onerror = () => ok(null);
      im.src = R.asset(r.cover);
    }));
  }
  // a square sleeve: the real cover pixelated to 40px, or the station's generated art
  function sleeveArt(r, i) {
    const [c, g] = R.canvas(40, 40);
    g.drawImage(sleeveCanvas(r, i), 0, 0, 40, 40);
    cover(r).then(im => {
      if (!im) return;
      g.imageSmoothingEnabled = true;
      g.drawImage(im, 0, 0, 40, 40);
      g.imageSmoothingEnabled = false;
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 40, 1); g.fillRect(0, 0, 1, 40);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 39, 40, 1); g.fillRect(39, 0, 1, 40);
    });
    return c;
  }
  // the record itself: grooves, a shine, and the cover (or the station colours) on the label
  function discArt(r) {
    const [c, g] = R.canvas(48, 48);
    const paint = im => {
      g.clearRect(0, 0, 48, 48);
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const d = Math.hypot(x - 23.5, y - 23.5);
        if (d > 23.5) continue;
        let col = '#141018';
        if (d > 10 && Math.floor(d) % 3 === 0) col = '#251e2c';
        if (d > 22.5) col = '#2c2434';
        const ang = Math.atan2(y - 23.5, x - 23.5);
        if (d > 11 && Math.abs(Math.sin(ang * 1 + 0.8)) > 0.96) col = '#4a4058';   // shine
        if (d <= 10) col = d < 5 ? r.label : r.color;
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
      }
      if (im) {
        g.save(); g.beginPath(); g.arc(24, 24, 10, 0, Math.PI * 2); g.clip();
        g.imageSmoothingEnabled = true; g.drawImage(im, 14, 14, 20, 20); g.restore();
      }
      g.fillStyle = '#141018'; g.fillRect(23, 23, 2, 2);
    };
    paint(null);
    cover(r).then(im => im && paint(im));
    return c;
  }

  // ---------- the magazine ----------
  const CSS = `
  #mag { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; background: rgba(10, 8, 24, 0.62); }
  #mag[hidden] { display: none; }
  #mag .stage { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  #mag .book { position: relative; width: calc(var(--pw) * 2); height: var(--ph);
    transition: transform .55s cubic-bezier(.3,.8,.25,1); user-select: none; cursor: grab; }
  #mag .book.drag { cursor: grabbing; }
  #mag .book.corner { cursor: pointer; }
  #mag .face { position: absolute; top: 0; width: 50%; height: 100%; overflow: hidden; color: #2b2140;
    background: #f4ecdc radial-gradient(rgba(70,45,20,.07) 1px, transparent 1.3px) 0 0 / 7px 7px;
    border: 3px solid #2b2140; box-sizing: border-box; font-size: calc(var(--pw) / 17); z-index: 2; }
  #mag .face[hidden], #mag .flapw[hidden], #mag .stk[hidden] { display: none; }
  #mag .face.L { left: 0; } #mag .face.R { left: 50%; }
  #mag .face.under { z-index: 1; }
  #mag .face.flap { transform-origin: 0 0; will-change: transform, clip-path; }
  #mag .flapw { position: absolute; inset: 0; z-index: 6; pointer-events: none; filter: drop-shadow(0 0 calc(var(--pw) * .018) rgba(25,12,35,.45)); }
  #mag .face.front { border-left-width: 1px; }
  #mag .face.back { border-right-width: 1px; }
  #mag .face.front::before, #mag .face.back::before { content: ''; position: absolute; top: 0; bottom: 0; width: 14%; pointer-events: none; z-index: 3; }
  #mag .face.front::before { left: 0; background: linear-gradient(to right, rgba(40,20,10,.28), transparent); }
  #mag .face.back::before { right: 0; background: linear-gradient(to left, rgba(40,20,10,.28), transparent); }
  #mag .hold { position: absolute; inset: 0; }
  #mag .fx { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
  #mag .stk { position: absolute; top: 0; width: 50%; height: 100%; z-index: 0; background: #e9dfca; box-sizing: border-box; border: 3px solid #2b2140; }
  #mag .pg { position: absolute; inset: 0; padding: 5% 7%; display: flex; flex-direction: column; }
  #mag .top { display: flex; justify-content: space-between; font-size: .62em; letter-spacing: .08em; text-transform: uppercase; border-bottom: 2px solid #2b2140; padding-bottom: .2em; }
  #mag .band { position: absolute; left: 0; right: 0; top: 11%; height: 50%; z-index: 0;
    background-image: radial-gradient(rgba(255,255,255,.22) 22%, transparent 25%); background-size: .5em .5em; }
  #mag .art { position: relative; z-index: 1; width: 62%; aspect-ratio: 1; margin: 7% 0 0 6%; cursor: pointer; }
  #mag .art canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
  #mag .art .discw { position: absolute; inset: 2%; transform: translateX(34%); transition: transform .45s cubic-bezier(.3,.8,.25,1); }
  #mag .art .disc { animation: magspin 1.8s linear infinite; animation-play-state: paused; }
  #mag .art .sleeve { box-shadow: .25em .25em 0 rgba(30,15,40,.35); outline: 3px solid #2b2140; }
  #mag .art:hover .discw { transform: translateX(52%); }
  #mag .art:hover .disc, #mag .art.on .disc { animation-play-state: running; }
  #mag .art.drop .discw { transform: translateX(160%) scale(.7); opacity: 0; transition: transform .5s ease-in, opacity .5s ease-in; }
  #mag .art .hint { position: absolute; right: -36%; bottom: -4%; font-size: .55em; background: #2b2140; color: #f7c86b; padding: .1em .4em; opacity: 0; transition: opacity .2s; white-space: nowrap; }
  #mag .art:hover .hint { opacity: 1; }
  @keyframes magspin { to { transform: rotate(360deg); } }
  #mag .ttl { position: relative; z-index: 1; margin-top: auto; font-size: 1.55em; line-height: .95; overflow-wrap: anywhere; }
  #mag .by { font-size: .78em; color: #5a4a6e; margin-top: .25em; }
  #mag .meta { display: flex; justify-content: space-between; align-items: end; font-size: .6em; margin-top: .5em; border-top: 2px dashed #b7a98f; padding-top: .3em; text-transform: uppercase; letter-spacing: .06em; }
  #mag .stamp { position: absolute; right: 7%; top: 13%; z-index: 2; transform: rotate(9deg); border: 3px solid #d64545; color: #d64545; padding: .05em .35em; font-size: .7em; background: rgba(244,236,220,.85); }
  #mag .mast { font-size: 3.6em; line-height: .8; letter-spacing: -.02em; color: #2b2140; margin-top: 6%; text-shadow: .06em .06em 0 #f7c86b; }
  #mag .mosaic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5%; margin: 9% 6% auto; }
  #mag .mosaic canvas { width: 100%; image-rendering: pixelated; outline: 2px solid #2b2140; }
  #mag .mosaic canvas:nth-child(odd) { transform: rotate(-3deg); } #mag .mosaic canvas:nth-child(even) { transform: rotate(2.5deg); }
  #mag .tips p { font-size: .72em; margin: .5em 0; }
  #mag .tips b { color: #c0392b; font-weight: normal; }
  #mag .bars { display: flex; gap: 2px; height: 3em; margin-top: auto; }
  #mag .bars i { background: #2b2140; flex: 1; } #mag .bars i:nth-child(3n) { flex: .4; } #mag .bars i:nth-child(4n) { background: none; }
  #mag .bar { position: relative; z-index: 1000; display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 20px; min-width: min(640px, 90vw); justify-content: space-between; }
  #mag .bar .np { color: var(--accent); max-width: 46ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #mag .bar .grp { display: flex; gap: 6px; align-items: center; }
  #mag .bar small { color: var(--dim); }`;

  let mag, book, pagesEl = [], N = 0, f = 0, vf = 0, raf = 0, last = 0, dims = { pw: 400, ph: 530 };
  const S = {};           // the faces on the table: L, R, under, flap
  let T = null;           // the page being turned (peek | drag | auto | hold)
  const queue = [];       // turns asked for but not drawn yet (scroll/arrow riffles)

  function pageFrame(no, right, kids) {
    return R.el('div', { cls: 'pg' }, R.el('div', { cls: 'top' }, R.el('span', { text: 'crate ✦ vinyl catalogue' }), R.el('span', { text: 'p. ' + no })), kids);
  }
  function recordPage(r, i, no) {
    const art = R.el('div', { cls: 'art', title: 'drop the needle' });
    const dw = R.el('div', { cls: 'discw' }); const d = discArt(r); d.className = 'disc'; dw.append(d);
    const s = sleeveArt(r, i); s.className = 'sleeve';
    art.append(dw, s, R.el('span', { cls: 'hint', text: '▶ drop the needle' }));
    art.dataset.rec = r.id;
    const on = (M.playing && M.station && M.station.id === r.id) || M.lastRecord === r.id;
    if (on) art.classList.add('on');
    art._rec = r;
    art.onclick = ev => { ev.stopPropagation(); if (performance.now() - swallow > 350) choose(r, art); };
    const band = R.el('div', { cls: 'band' }); band.style.backgroundColor = r.color;
    const kind = r.kind === 'link' ? (/^spotify:(playlist|album)|open\.spotify\.com\/(playlist|album)/.test(r.url) ? 'on spotify' : '↗ opens spotify') : 'room radio';
    const by = r.artists || (r.kind === 'link' ? 'your spotify' : { lofi: 'the room band · generative', jazz: 'the room trio · generative', rain: 'the window · field recording', mine: 'your files' }[r.id] || 'the room');
    return [band, pageFrame(no, false, [
      on ? R.el('div', { cls: 'stamp', text: 'now spinning' }) : null,
      art,
      R.el('div', { cls: 'ttl', text: r.title }),
      R.el('div', { cls: 'by', text: by }),
      R.el('div', { cls: 'meta' }, R.el('span', { text: r.tracks ? r.tracks + ' tracks' : (r.kind === 'link' ? 'playlist' : '∞ minutes') }), R.el('span', { text: kind })),
    ])];
  }
  function coverPage(all) {
    const now = new Date();
    const pick = all.filter(r => r.cover).concat(all.filter(r => !r.cover)).slice(0, 6);
    const mos = R.el('div', { cls: 'mosaic' }, pick.map(r => sleeveArt(r, all.indexOf(r))));
    return [R.el('div', { cls: 'pg' },
      R.el('div', { cls: 'top' }, R.el('span', { text: 'issue ' + (now.getMonth() + 1) }), R.el('span', { text: now.toLocaleString('en', { month: 'long', year: 'numeric' }) })),
      R.el('div', { cls: 'mast', text: 'CRATE' }),
      R.el('div', { cls: 'by', text: 'the pixel room vinyl catalogue · ' + all.length + ' records inside' }),
      mos,
      R.el('div', { cls: 'meta' }, R.el('span', { text: 'free with every cat treat' }), R.el('span', { text: 'flip to dig →' })))];
  }
  function tipsPage() {
    return [R.el('div', { cls: 'pg tips' },
      R.el('div', { cls: 'top' }, R.el('span', { text: 'how to dig' }), R.el('span', { text: 'p. 2' })),
      R.el('p', {}, R.el('b', { text: 'hover a corner ' }), 'and it lifts; drag it across to peel the page over, slowly or with a flick'),
      R.el('p', {}, R.el('b', { text: 'click ' }), 'the right page to go on, the left one to go back'),
      R.el('p', {}, R.el('b', { text: 'scroll ' }), 'or use ← → to riffle through'),
      R.el('p', {}, R.el('b', { text: 'click a vinyl ' }), 'to drop the needle: the turntable swaps records and it plays. Spotify playlists start in the app by themselves'),
      R.el('p', {}, R.el('b', { text: 'volume ' }), 'is the little slider next to the song in the corner box'),
      R.el('div', { cls: 'bars' }, Array.from({ length: 28 }, () => R.el('i'))))];
  }
  function backPage() {
    return [R.el('div', { cls: 'pg' },
      R.el('div', { cls: 'top' }, R.el('span', { text: 'back cover' }), R.el('span', { text: 'fin.' })),
      R.el('div', { cls: 'mast', text: 'thx 4 digging' }),
      R.el('div', { cls: 'by', text: 'more records: add playlists in assets/manifest.js → records' }),
      R.el('div', { cls: 'bars' }, Array.from({ length: 34 }, () => R.el('i'))))];
  }

  function face(side) {
    const el = R.el('div', { cls: 'face ' + side }, R.el('div', { cls: 'hold' }), R.el('div', { cls: 'fx' }));
    el.side = side;
    return el;
  }
  function build() {
    const all = M.stations.concat(M.links);
    const pages = [coverPage(all), tipsPage()];
    all.forEach((r, i) => pages.push(recordPage(r, i, pages.length + 1)));
    if (pages.length % 2 === 0) pages.push([R.el('div', { cls: 'pg tips' }, R.el('div', { cls: 'top' }, R.el('span', { text: 'notes' }), R.el('span', { text: 'p. ' + (pages.length + 1) })), R.el('p', { text: 'this page is left blank for the cat to sit on.' }))]);
    pages.push(backPage());
    pagesEl = pages.map(p => R.el('div', { cls: 'hold' }, p));
    N = pagesEl.length / 2;      // sheets: sheet i is page 2i (right-hand) backed by page 2i+1 (left-hand)
    book.textContent = '';
    S.stkL = R.el('div', { cls: 'stk' }); S.stkL.style.left = '0';
    S.stkR = R.el('div', { cls: 'stk' }); S.stkR.style.left = '50%';
    S.under = face('R under'); S.L = face('L'); S.R = face('R');
    S.flap = face('R flap');
    S.flapw = R.el('div', { cls: 'flapw' }, S.flap);
    S.shelf = R.el('div', { hidden: true }, pagesEl);
    book.append(S.stkL, S.stkR, S.under, S.L, S.R, S.flapw, S.shelf);
  }

  // ---------- turning: a 2D paper fold ----------
  // The turning sheet is folded along the perpendicular bisector of (its corner → where the corner is now).
  // The part on the spine side stays flat; the rest is mirrored over the fold and shows the sheet's back.
  // Geometry is worked out for a right-hand page (spine at x=0, page x∈[0,pw]); turning back mirrors it.
  function layout() {
    let pw = Math.min(window.innerWidth * 0.45, 560), ph = pw * 1.32;
    const maxH = window.innerHeight * 0.76;
    if (ph > maxH) { ph = maxH; pw = ph / 1.32; }
    dims = { pw, ph };
    mag.style.setProperty('--pw', pw + 'px'); mag.style.setProperty('--ph', ph + 'px');
  }
  function shift() {    // closed at the front or back: centre the single page
    const s = f === 0 ? -0.25 : f === N ? 0.25 : 0;
    book.style.transform = 'translateX(' + s * dims.pw * 2 + 'px)';
  }
  const V = (x, y) => ({ x, y });
  function put(el, i, side) {
    const pg = i >= 0 && i < pagesEl.length ? pagesEl[i] : null;
    const h = el.firstChild;
    if (h.firstChild && h.firstChild !== pg) S.shelf.append(h.firstChild);   // unused pages wait off the table
    if (pg && pg.parentNode !== h) h.append(pg);
    el.hidden = !pg;
    if (side) el.side = side;
    el.className = 'face ' + el.side + (el === S.under ? ' under' : el === S.flap ? ' flap' : '') + (i % 2 ? ' back' : ' front');
    el.style.clipPath = ''; el.lastChild.style.background = '';
  }
  function stack(el, n, dir) {
    el.hidden = n <= 0;
    const k = Math.min(5, n), sh = [];
    for (let i = 1; i <= k; i++) sh.push(dir * i * 2 + 'px ' + i * 2 + 'px 0 ' + (i % 2 ? '#d8caae' : '#efe5d1'));
    sh.push(dir * (k * 2 + 3) + 'px ' + (k * 2 + 3) + 'px 0 #2b2140');
    el.style.boxShadow = sh.join(',');
  }
  function assign() {
    const d = T ? T.dir : 0;
    put(S.L, 2 * vf - 1); put(S.R, 2 * vf);
    if (d > 0) { put(S.under, 2 * vf + 2, 'R'); put(S.flap, 2 * vf + 1); }
    else if (d < 0) { put(S.under, 2 * vf - 3, 'L'); put(S.flap, 2 * vf - 2); }
    else { put(S.under, -1); put(S.flap, -1); }
    S.flapw.hidden = true;
    stack(S.stkL, d < 0 ? vf - 1 : vf, -1);
    stack(S.stkR, d > 0 ? N - vf - 1 : N - vf, 1);
  }
  const limit = (P, O, r) => { const dx = P.x - O.x, dy = P.y - O.y, d = Math.hypot(dx, dy); return d > r ? V(O.x + dx * r / d, O.y + dy * r / d) : P; };
  function geom() {
    const { pw, ph } = dims, C = V(pw, T.cy);
    let P = T.P;
    for (let i = 0; i < 3; i++) P = limit(limit(P, V(0, T.cy), pw), V(0, ph - T.cy), Math.hypot(pw, ph));   // paper doesn't stretch
    const dx = C.x - P.x, dy = C.y - P.y, len = Math.hypot(dx, dy);
    if (len < 0.5) return null;
    return { n: V(dx / len, dy / len), M: V((C.x + P.x) / 2, (C.y + P.y) / 2), len };
  }
  function cut(M, n, side) {   // the page rectangle on one side of the fold (side 1 = the corner's side)
    const { pw: w, ph: h } = dims, pts = [V(0, 0), V(w, 0), V(w, h), V(0, h)], out = [];
    const sd = p => side * ((p.x - M.x) * n.x + (p.y - M.y) * n.y);
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], sa = sd(a), sb = sd(b);
      if (sa >= 0) out.push(a);
      if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push(V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)); }
    }
    return out;
  }
  const poly = (pts, flip) => pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)'
    : 'polygon(' + pts.map(p => (flip ? dims.pw - p.x : p.x).toFixed(1) + 'px ' + p.y.toFixed(1) + 'px').join(',') + ')';
  function grad(M, n, stops, flip) {  // a linear gradient in page coords, its stops measured from the fold along n
    const { pw: w, ph: h } = dims;
    if (flip) { M = V(w - M.x, M.y); n = V(-n.x, n.y); }
    const th = Math.atan2(n.x, -n.y), L = Math.abs(w * Math.sin(th)) + Math.abs(h * Math.cos(th));
    const s0 = (M.x - w / 2) * n.x + (M.y - h / 2) * n.y + L / 2;
    return 'linear-gradient(' + (th * 180 / Math.PI).toFixed(2) + 'deg,' + stops.map(([d, c]) => c + ' ' + (s0 + d).toFixed(1) + 'px').join(',') + ')';
  }
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  function render() {
    if (!T) return;
    const g = geom(), back = T.dir < 0, kept = back ? S.L : S.R;
    if (!g) { kept.style.clipPath = ''; kept.lastChild.style.background = ''; S.flapw.hidden = true; return; }
    const { pw } = dims, { n, M, len } = g;
    S.flapw.hidden = S.flap.hidden;
    kept.style.clipPath = poly(cut(M, n, -1), back);
    S.flap.style.clipPath = poly(cut(M, n, 1), !back);
    // reflect over the fold; the sheet's back is laid out mirrored, so two mirrors = the page reads right
    const r = [1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.y, 1 - 2 * n.y * n.y];
    let m = [r[0], r[1], r[2], r[3], M.x - (r[0] * M.x + r[2] * M.y), M.y - (r[1] * M.x + r[3] * M.y)];
    m = back ? mul([-1, 0, 0, 1, 0, 0], m) : mul(m, [-1, 0, 0, 1, pw, 0]);
    S.flap.style.transform = 'matrix(' + m.map(v => v.toFixed(4)).join(',') + ')';
    // light: the page bows up by the fold, the flap catches a highlight, and drops a shadow on the page below
    const amt = R.clamp(len / (pw * 0.2), 0, 1) * R.clamp((2 * pw - len) / (pw * 0.35), 0, 1);
    const w = Math.min(pw * 0.26, len * 0.32) + 2;
    const a = v => (v * amt).toFixed(3);
    kept.lastChild.style.background = grad(M, V(-n.x, -n.y), [[0, 'rgba(30,15,40,' + a(0.3) + ')'], [w * 0.55, 'rgba(30,15,40,0)']], back);
    S.flap.lastChild.style.background = grad(M, n, [[0, 'rgba(45,25,15,' + a(0.38) + ')'], [w * 0.22, 'rgba(255,250,235,' + a(0.28) + ')'],
      [w * 0.7, 'rgba(255,250,235,' + a(0.06) + ')'], [w * 1.6, 'rgba(45,25,15,' + a(0.14) + ')']], !back);
    if (!S.under.hidden) S.under.lastChild.style.background = grad(M, n, [[0, 'rgba(20,10,30,' + a(0.5) + ')'], [w * 0.7, 'rgba(20,10,30,0)']], back);
  }
  // corner path for a turn: slides across while lifting a little, so the fold swings like real paper
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function begin({ dir, cy }) {
    const fast = queue.length > 0;
    if (T && T.mode === 'peek' && T.dir === dir) { T.mode = 'auto'; T.from = V(T.P.x, T.P.y); }
    else {
      cy = cy == null ? dims.ph : cy;
      T = { dir, cy, P: V(dims.pw, cy), from: V(dims.pw, cy), mode: 'auto' };
      assign();
    }
    const rem = Math.hypot(T.from.x + dims.pw, T.from.y - T.cy) / (2 * dims.pw);
    Object.assign(T, { e: 0, commit: true, dur: (fast ? 0.36 : 0.95) * (0.35 + 0.65 * R.clamp(rem, 0, 1)), lift: dims.ph * (fast ? 0.05 : 0.14) });
    R.sfx.page((fast ? 0.55 : 0.85) + Math.random() * 0.2, T.dur);
  }
  function finish() {
    if (T.commit) vf += T.dir;
    T = null;
    assign();
  }
  function frame(now) {
    const dt = R.clamp((now - last) / 1000, 0, 0.05); last = Math.max(last, now);   // rAF's time can be older than kick()'s
    if (queue.length && (!T || T.mode === 'peek')) begin(queue.shift());
    if (T && T.mode === 'peek') {
      const k = 1 - Math.exp(-dt * 13), C = V(dims.pw, T.cy);
      T.P = V(T.P.x + (T.goal.x - T.P.x) * k, T.P.y + (T.goal.y - T.P.y) * k);
      if (!T.goal.on && Math.hypot(T.P.x - C.x, T.P.y - C.y) < 0.6) { T = null; assign(); }
    } else if (T && T.mode === 'auto') {
      T.e = Math.min(1, T.e + dt / T.dur);
      const e = ease(T.e), A = T.from, B = V(T.commit ? -dims.pw : dims.pw, T.cy);
      const lift = Math.sin(Math.PI * e) * T.lift * (T.cy > 0 ? -1 : 1);
      T.P = V(A.x + (B.x - A.x) * e, A.y + (B.y - A.y) * e + lift);
      if (T.e >= 1) finish();
    }
    render();
    raf = (T && T.mode !== 'hold') || queue.length ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  function turn(dir, cy) {
    if (T && T.mode === 'drag') return false;
    if (dir > 0 ? f >= N : f <= 0) return false;
    f += dir;
    queue.push({ dir, cy });
    shift(); kick(); drawBar();
    return true;
  }
  const goTo = i => { const n = R.clamp(i, 0, N); while (f !== n) turn(n > f ? 1 : -1); };

  // the mouse: hover a corner and it lifts; drag it across (slowly or with a flick); click a page to turn it
  let moved = false, lastX = 0, lastT = 0, vx = 0, peelAt = 0, onArt = false, artEl = null, swallow = 0, turnedAt = 0;
  function local(ev) {
    const r = book.getBoundingClientRect();
    return V(ev.clientX - r.left - r.width / 2, ev.clientY - r.top);
  }
  function hover(ev) {
    if (mag.hidden || queue.length || (T && T.mode !== 'peek')) return;
    const p = local(ev), { pw, ph } = dims, zone = pw * 0.32;
    const dir = p.x > 0 ? 1 : -1, x = dir * p.x;
    const ok = x > 0 && x <= pw + 4 && p.y >= -4 && p.y <= ph + 4 && (dir > 0 ? vf < N : vf > 0) && pw - x < zone && (p.y < zone || ph - p.y < zone);
    book.classList.toggle('corner', ok);
    if (T && (!ok || T.dir !== dir || T.cy !== (p.y < ph / 2 ? 0 : ph))) { T.goal = V(pw, T.cy); T.goal.on = false; kick(); return; }
    if (!ok) return;
    const cy = p.y < ph / 2 ? 0 : ph, C = V(pw, cy);
    if (!T) {
      T = { dir, cy, P: C, mode: 'peek' }; assign();
      if (performance.now() - peelAt > 700) { peelAt = performance.now(); R.sfx.peel(0.5); }
    }
    T.goal = limit(V(x - pw * 0.05, p.y + (cy ? -1 : 1) * pw * 0.05), C, zone); T.goal.on = true;
    kick();
  }
  function down(ev) {
    if (ev.button !== 0 || ev.target.closest('button')) return;
    if (queue.length || (T && T.mode !== 'peek')) return;
    artEl = ev.target.closest('.art'); onArt = !!artEl;
    const p = local(ev), dir = p.x > 0 ? 1 : -1;
    if (dir > 0 ? vf >= N : vf <= 0) return;
    const cy = p.y < dims.ph / 2 ? 0 : dims.ph;
    if (!(T && T.dir === dir && T.cy === cy)) { T = { dir, cy, P: V(dims.pw, cy) }; assign(); }
    T.mode = 'drag'; T.grab = V(dir * p.x, p.y); T.start = V(T.P.x, T.P.y);
    moved = false; vx = 0; lastX = ev.clientX; lastT = performance.now();
    book.classList.add('drag');
    ev.preventDefault();
  }
  function move(ev) {
    if (!T || T.mode !== 'drag') return hover(ev);
    const p = local(ev), x = T.dir * p.x;
    const dx = x - T.grab.x, dy = p.y - T.grab.y;
    if (!moved && Math.hypot(dx, dy) > (onArt ? 14 : 4)) { moved = true; R.sfx.peel(0.7); }   // a click on a record can wobble
    const now = performance.now();
    vx = T.dir * (ev.clientX - lastX) / Math.max(1, now - lastT); lastX = ev.clientX; lastT = now;
    if (moved) { T.P = V(T.start.x + dx * 1.35, T.start.y + dy * 0.9); kick(); }   // the corner runs a little ahead of the mouse
  }
  function up() {
    if (!T || T.mode !== 'drag') return;
    book.classList.remove('drag');
    const travel = (dims.pw - T.P.x) / (2 * dims.pw);
    turnedAt = performance.now();
    if (moved) swallow = performance.now();                         // a drag that started on the vinyl isn't a click on it
    if (!moved && onArt) {                              // plain click on the vinyl: leave the page, play the record
      Object.assign(T, { mode: 'auto', from: V(T.P.x, T.P.y), e: 0, commit: false, dur: 0.2, lift: 0 }); kick();
      // play it from here: the browser's own click can get lost if the page shifted under the mouse
      if (artEl && artEl.isConnected && artEl._rec) { swallow = performance.now(); choose(artEl._rec, artEl); }
    } else if (!moved || travel > 0.18 || vx < -0.25) {      // a click, or let go far enough / with a flick: it turns from where it is
      T.mode = 'peek'; T.goal = V(T.P.x, T.P.y); T.goal.on = true;
      turn(T.dir, T.cy);
    } else {                                            // not far enough: it slips back
      Object.assign(T, { mode: 'auto', from: V(T.P.x, T.P.y), e: 0, commit: false, dur: 0.25 + 0.4 * R.clamp(travel * 3, 0, 1), lift: 0 });
      kick();
    }
  }
  let wheelAt = 0;
  function wheel(ev) {
    ev.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 160) return;
    wheelAt = now;
    turn(ev.deltaY > 0 || ev.deltaX > 0 ? 1 : -1);
  }
  function keys(ev) {
    if (mag.hidden) return;
    if (ev.key === 'ArrowRight') turn(1);
    else if (ev.key === 'ArrowLeft') turn(-1);
    else if (ev.key === 'Escape') close();
  }

  // ---------- bottom bar: Spotify's now playing + page counter ----------
  let bar;
  function drawBar() {
    if (!bar) return;
    bar.textContent = '';
    const m = M.media;
    const left = R.el('div', { cls: 'grp' });
    if (M.playing) left.append(R.el('span', { cls: 'np', text: '♪ ' + M.station.title }), R.el('button', { text: '■', title: 'stop', onclick: () => { M.stop(); drawBar(); } }));
    else if (m.active) {
      const cmd = w => () => M.mediaCmd(w).then(drawBar).catch(e => R.toast(String(e.message || e)));
      left.append(R.el('button', { text: '⏮', onclick: cmd('prev') }), R.el('button', { text: m.playing ? '❚❚' : '▶', onclick: cmd('toggle') }), R.el('button', { text: '⏭', onclick: cmd('next') }),
        R.el('span', { cls: 'np', text: (m.title || 'something') + (m.artist ? ' — ' + m.artist : '') }));
    } else if (!R.helper.ok) left.append(R.el('small', { text: 'start the helper so Spotify records play by themselves' }));
    else {
      const why = { closed: 'Spotify is closed', signedout: 'Spotify is open but not logged in: log in once and it stays connected',
        idle: 'Spotify is open: pick a record and it starts', missing: 'no Spotify app found: the web player works too' }[m.spotify];
      left.append(R.el('small', { cls: 'why', text: why || 'pick a record to drop the needle' }));
      if (m.spotify && m.spotify !== 'idle') left.append(R.el('button', { text: m.spotify === 'signedout' ? '↗ show Spotify' : '▶ open Spotify',
        onclick: () => R.helper.call('/media/spotify', 8000).then(() => R.toast('opening Spotify…')).catch(e => R.toast(String(e.message || e))) }));
    }
    const a = f * 2, pages = N * 2;
    bar.append(left, R.el('div', { cls: 'grp' },
      R.el('button', { text: '◀', onclick: () => turn(-1) }),
      R.el('small', { text: f === 0 ? 'cover' : f === N ? 'back' : a + '–' + (a + 1) + ' / ' + pages }),
      R.el('button', { text: '▶', onclick: () => turn(1) }),
      R.el('button', { text: '×', title: 'close', onclick: close })));
  }

  // ---------- open / close / play ----------
  function ensure() {
    if (mag) return;
    document.head.append(R.el('style', { text: CSS }));
    book = R.el('div', { cls: 'book' });
    bar = R.el('div', { cls: 'bar px' });
    mag = R.el('div', { id: 'mag' }, R.el('div', { cls: 'stage' }, book, bar));
    mag.hidden = true;
    document.body.append(mag);
    book.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    book.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keys);
    // close only on a real click on the dark backdrop: pressed AND released there, without dragging
    let bgDown = null;
    mag.addEventListener('mousedown', ev => { bgDown = ev.target === mag && (!T || T.mode === 'peek') && !queue.length ? V(ev.clientX, ev.clientY) : null; });
    mag.addEventListener('click', ev => {
      const ok = bgDown && ev.target === mag && Math.hypot(ev.clientX - bgDown.x, ev.clientY - bgDown.y) < 6 && performance.now() - turnedAt > 400;
      bgDown = null;
      if (ok) close();
    });
    book.addEventListener('click', ev => { if (performance.now() - swallow < 350) { ev.stopPropagation(); ev.preventDefault(); } }, true);
    window.addEventListener('resize', () => { if (!mag.hidden) { layout(); shift(); render(); } });
    R.on('media', () => { if (!mag.hidden) drawBar(); });
  }
  function open() {
    ensure();
    R.closePanel();
    build(); layout();
    // open at the record that's playing, or on the cover
    const idx = M.stations.concat(M.links).findIndex(r => (M.playing && M.station && M.station.id === r.id) || (!M.playing && M.lastRecord === r.id));
    const page = idx >= 0 ? idx + 2 : -1;          // pages: cover, tips, then records
    f = vf = page >= 0 ? Math.ceil(page / 2) : 0;
    T = null; queue.length = 0;
    assign();
    mag.hidden = false;
    book.style.transition = 'none'; shift(); void book.offsetWidth; book.style.transition = '';
    drawBar();
    R.sfx.page(0.6);
    M.pollMedia().then(drawBar);
  }
  function close() { if (mag && !mag.hidden) { mag.hidden = true; R.sfx.page(0.5); } }
  R.openCatalogue = open;
  // for tests / demos: ?demo=mag&spread=3&hold=70 (a page frozen mid-turn)
  R.catalogue = { turn, goTo, page: () => f, target: i => (i < f ? 180 : 0),
    hold: deg => {                                   // freeze the next page mid-turn (0–180)
      if (vf >= N) return;
      const e = R.clamp(deg / 180, 0, 1), { pw, ph } = dims;
      T = { dir: 1, cy: ph, mode: 'hold' }; assign();
      T.P = V(pw - 2 * pw * e, ph - Math.sin(Math.PI * e) * ph * 0.14); render();
    } };

  function choose(r, art) {
    art.classList.add('drop');
    R.sfx.pop(420);
    M.lastRecord = r.id;
    setTimeout(close, 420);
    if (r.kind === 'link') {
      M.stop();
      const going = M.playLink(r);                  // Spotify starts while the records swap
      M.swap(r, () => { R.emit('record:link', r); going.then(() => R.toast('♪ ' + r.title)); });
    } else {
      M.pauseSpotify();
      R.toast('♪ ' + r.title);
      M.swap(r, () => M.play(r.id));
    }
  }

  // ---------- the crate in the room ----------
  R.buildCrate = function () {
    const crate = R.group(-5.25, 0, 1.55, R.room);
    const wood = R.mat('#9a6a44'), dark = R.mat('#6a4a30');
    R.box(0.8, 0.08, 0.95, dark, 0, 0.04, 0, crate);
    R.box(0.06, 0.55, 0.95, wood, -0.37, 0.3, 0, crate);
    R.box(0.06, 0.55, 0.95, wood, 0.37, 0.3, 0, crate);
    R.box(0.8, 0.45, 0.06, wood, 0, 0.25, -0.45, crate);
    R.box(0.8, 0.3, 0.06, wood, 0, 0.18, 0.45, crate);
    const recs = M.stations.concat(M.links);
    const sleeves = [];
    const n = Math.min(7, Math.max(5, recs.length));   // the crate fits 7; the catalogue lists them all
    for (let i = 0; i < n; i++) {
      const r = recs[i % recs.length];
      const tex = R.nearest(new THREE.CanvasTexture(sleeveCanvas(r, i % recs.length)));
      // real covers on the sleeves where WebGL may use them (embedded by tools/embed_assets.py)
      if (r.cover && String(R.asset(r.cover)).startsWith('data:')) cover(r).then(im => {
        if (!im) return;
        const [c, g] = R.canvas(24, 24); g.imageSmoothingEnabled = true; g.drawImage(im, 0, 0, 24, 24);
        tex.image = c; tex.needsUpdate = true;
      });
      const s = R.box(0.62, 0.62, 0.03, [R.mat(r.color), R.mat(r.color), R.mat(r.color), R.mat(r.color), R.texMat(tex), R.mat(r.color)], 0, 0.42, 0.33 - i * 0.14, crate);
      s.rotation.x = -0.18;
      s.userData.base = s.position.clone();
      sleeves.push(s);
    }
    // flip animation on hover: records lean forward one after another
    let t = 0;
    R.tick(dt => {
      t += dt;
      const hot = R.hovered === crate;
      sleeves.forEach((s, i) => {
        const lean = hot ? -0.18 + 0.45 * Math.max(0, Math.sin(t * 3 - i * 0.7)) : -0.18;
        s.rotation.x = R.damp(s.rotation.x, lean, 8, dt);
        s.position.y = R.damp(s.position.y, s.userData.base.y + (hot && i === Math.floor(t * 0.48) % n ? 0.12 : 0), 8, dt);
      });
    });
    R.makeClickable(crate, 'record crate · flip through the catalogue', open);
  };
})(window.R);
