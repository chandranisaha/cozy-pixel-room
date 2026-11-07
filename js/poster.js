// The poster on the left wall.
//  · It's a gig poster for whatever is playing: the song's real cover (looked up by the helper),
//    the artist in big letters and "live tonight".
//    Nothing playing: the old sunset poster.
//  · Click it and it flips over on the wall to its back: your week in review (focus minutes per day,
//    tasks done, the best day starred, your streak). Click again to flip it back. The ticket stub at
//    the bottom of the gig poster opens the artist in Spotify.
(function (R) {
  const W = 1.74, H = 2.32, CW = 96, CH = 128;      // poster size (world) and its texture (px)

  // ---------- the artwork ----------
  function sunset(g) {
    const s = 4;
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * s, y * s, w * s, h * s); };
    r(0, 0, 24, 32, '#f2d7a6'); r(2, 2, 20, 18, '#e57b5f'); r(9, 6, 6, 6, '#f7c86b');
    r(2, 14, 20, 6, '#4b4876'); r(4, 12, 4, 2, '#4b4876'); r(14, 11, 6, 3, '#4b4876');
    r(4, 23, 16, 2, '#3a3560'); r(6, 27, 12, 1, '#3a3560');
  }
  function avgColor(img) {
    const [c, g] = R.canvas(8, 8); g.drawImage(img, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const col = new THREE.Color(r / 64 / 255, gg / 64 / 255, b / 64 / 255);
    const hsl = {}; col.getHSL(hsl);
    return '#' + new THREE.Color().setHSL(hsl.h, Math.max(0.45, hsl.s), R.clamp(hsl.l, 0.35, 0.5)).getHexString();
  }
  function fitText(g, text, maxW, big, small) {
    for (let px = big; px >= small; px--) { g.font = px + 'px VT323, monospace'; if (g.measureText(text).width <= maxW) return px; }
    while (text.length > 3 && g.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }
  function line(g, text, y, maxW, big, small, color) {
    const r = fitText(g, text, maxW, big, small);
    if (typeof r === 'string') text = r;
    g.fillStyle = color; g.textAlign = 'center'; g.fillText(text, CW / 2, y);
  }
  function gig(g, info, img) {
    const band = img ? avgColor(img) : '#8a5ca8';
    g.fillStyle = '#f3e6c8'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(120,80,40,.08)'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % CW, (i * 53) % CH, 1, 1);   // paper flecks
    g.fillStyle = band; g.fillRect(0, 0, CW, 20);
    g.fillStyle = '#2b2140'; g.fillRect(0, 20, CW, 2);
    g.textBaseline = 'alphabetic';
    line(g, '★ LIVE TONIGHT ★', 15, CW - 8, 15, 10, '#fff4dc');
    // the cover, pixelated, with a hard shadow
    g.fillStyle = '#2b2140'; g.fillRect(19, 28, 62, 62);
    if (img) {
      const [p, pg] = R.canvas(30, 30); pg.imageSmoothingEnabled = true; pg.drawImage(img, 0, 0, 30, 30);
      g.imageSmoothingEnabled = false; g.drawImage(p, 16, 25, 60, 60);
    } else {                      // no cover found: a vinyl
      g.fillStyle = band; g.fillRect(16, 25, 60, 60);
      g.fillStyle = '#1c1824'; g.beginPath(); g.arc(46, 55, 26, 0, 7); g.fill();
      g.fillStyle = '#f7c86b'; g.beginPath(); g.arc(46, 55, 8, 0, 7); g.fill();
      g.fillStyle = '#1c1824'; g.fillRect(45, 54, 2, 2);
    }
    g.strokeStyle = '#2b2140'; g.lineWidth = 2; g.strokeRect(17, 26, 58, 58);
    line(g, (info.artist || 'unknown artist').toUpperCase(), 103, CW - 8, 20, 11, '#2b2140');
    line(g, '“' + info.title + '”', 113, CW - 10, 12, 8, '#7a4a3a');
    g.fillStyle = '#2b2140'; for (let x = 2; x < CW; x += 4) g.fillRect(x, 117, 2, 1);       // ticket perforation
    line(g, '✂ tear here · play on spotify', 125, CW - 6, 9, 7, '#5a4a6e');
    g.fillStyle = band; [[6, 30], [86, 44], [8, 80], [88, 88]].forEach(([x, y]) => { g.fillRect(x, y - 2, 1, 5); g.fillRect(x - 2, y, 5, 1); });
  }

  // ---------- the back: your week in review ----------
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  function weekData() {
    const wk = R.store.get('week', {}), out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const e = wk[R.dayKey(d)] || { focus: 0, mins: 0, tasks: 0 };
      out.push(Object.assign({ day: DAYS[d.getDay()], today: i === 0 }, e));
    }
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const e = wk[R.dayKey(d)];
      if (e && (e.focus || e.tasks)) streak++; else if (i) break;
    }
    return { days: out, streak };
  }
  function weekCard(g) {
    const { days, streak } = weekData();
    g.fillStyle = '#f3e6c8'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(120,80,40,.08)'; for (let i = 0; i < 60; i++) g.fillRect((i * 41) % CW, (i * 29) % CH, 1, 1);
    g.fillStyle = '#5a7fb0'; g.fillRect(0, 0, CW, 20);
    g.fillStyle = '#2b2140'; g.fillRect(0, 20, CW, 2);
    g.textBaseline = 'alphabetic';
    line(g, '✦ MY WEEK ✦', 15, CW - 8, 16, 10, '#fff4dc');
    // focus minutes per day: pixel bars
    const max = Math.max(25, ...days.map(d => d.mins)), best = days.reduce((b, d) => (d.mins + d.tasks * 5 > b.mins + b.tasks * 5 ? d : b), days[0]);
    const x0 = 9, bw = 9, gap = 3, base = 74, top = 32;
    g.fillStyle = '#d9c7a0'; g.fillRect(x0 - 2, base, 7 * (bw + gap) + 1, 1);
    g.font = '8px VT323, monospace'; g.textAlign = 'left'; g.fillStyle = '#7a4a3a'; g.fillText('focus min', x0 - 2, top - 3);
    days.forEach((d, i) => {
      const x = x0 + i * (bw + gap), h = Math.round((base - top) * d.mins / max);
      g.fillStyle = d.today ? '#e57b5f' : '#7f6bb0';
      g.fillRect(x, base - h, bw, h);
      if (h > 2) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, base - h, 2, h); }
      if (d === best && (d.mins || d.tasks)) {          // best day gets a star
        const sy = base - h - 7; g.fillStyle = '#f7c86b';
        g.fillRect(x + 4, sy - 2, 1, 5); g.fillRect(x + 2, sy, 5, 1); g.fillRect(x + 3, sy - 1, 3, 3);
      }
      g.fillStyle = d.today ? '#e57b5f' : '#2b2140'; g.textAlign = 'center'; g.font = '9px VT323, monospace';
      g.fillText(d.day, x + bw / 2, base + 9);
      // tasks done: little ticks under each day
      g.fillStyle = '#5e8c5a';
      for (let k = 0; k < Math.min(d.tasks, 6); k++) g.fillRect(x + 1 + (k % 3) * 3, base + 12 + Math.floor(k / 3) * 3, 2, 2);
    });
    const mins = days.reduce((a, d) => a + d.mins, 0), tasks = days.reduce((a, d) => a + d.tasks, 0);
    g.fillStyle = '#2b2140'; for (let x = 2; x < CW; x += 4) g.fillRect(x, 92, 2, 1);
    g.textAlign = 'left'; g.font = '11px VT323, monospace'; g.fillStyle = '#2b2140';
    const hrs = mins >= 60 ? (mins / 60).toFixed(1).replace(/\.0$/, '') + ' h' : mins + ' min';
    g.fillText('focused  ' + hrs, 6, 103);
    g.fillText('tasks ✓  ' + tasks, 6, 113);
    g.fillText('streak   ' + streak + (streak === 1 ? ' day' : ' days') + (streak >= 3 ? ' !' : ''), 6, 123);
    if (!mins && !tasks) { g.textAlign = 'center'; g.fillStyle = '#7a4a3a'; g.font = '9px VT323, monospace'; g.fillText('start a focus session ♪', CW / 2, 56); }
  }

  R.buildPoster = function () {
    const grp = R.group(-5.99, 4.45, 2.05, R.room);
    grp.rotation.y = Math.PI / 2;
    const card = R.group(0, 0, 0, grp);                 // the sheet that flips over

    const tex = R.canvasTex(CW, CH, sunset);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), R.texMat(tex));
    const backTex = R.canvasTex(CW, CH, () => {});
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), R.texMat(backTex));
    back.rotation.y = Math.PI; back.position.z = -0.004;
    card.add(front, back);
    [-1, 1].forEach(sx => R.box(0.06, 0.06, 0.03, R.mat('#d64545'), sx * (W / 2 - 0.1), H / 2 - 0.1, 0, card));   // pins
    const redrawBack = () => { const g = backTex.userData.ctx; g.clearRect(0, 0, CW, CH); weekCard(g); backTex.needsUpdate = true; };
    (document.fonts ? document.fonts.load('11px VT323') : Promise.resolve()).then(redrawBack, redrawBack);
    R.store.watch('week', redrawBack);
    R.store.watch('prod', redrawBack);
    R.on('focus:done', () => setTimeout(redrawBack, 50)); R.on('task:done', () => setTimeout(redrawBack, 50));

    // ---------- what's playing → the artwork ----------
    let want = '';
    function now() {
      const m = R.music.media || {};
      if (m.active && m.title) return { title: m.title, artist: m.artist || '', spotify: /spotify/i.test(m.app || '') };
      if (R.music.playing && R.music.station) return { title: R.music.station.title, artist: 'the room band', room: true };
      return null;
    }
    function refresh() {
      const info = now(), key = info ? info.title + '|' + info.artist : '';
      if (key === want) return;
      want = key;
      const g = tex.userData.ctx;
      const paint = img => { if (want !== key) return; g.clearRect(0, 0, CW, CH); info ? gig(g, info, img) : sunset(g); tex.needsUpdate = true; };
      if (!info || info.room) { (document.fonts ? document.fonts.load('16px VT323') : Promise.resolve()).then(() => paint(null), () => paint(null)); return; }
      R.helper.call('/media/art', 15000).then(j => {
        if (!j || !j.ok || !j.data) return paint(null);
        const img = new Image(); img.onload = () => paint(img); img.onerror = () => paint(null);
        img.src = 'data:image/jpeg;base64,' + j.data;
      }).catch(() => paint(null));
    }
    R.on('media', refresh); R.on('music', refresh); R.on('track', refresh);
    refresh();

    // ---------- click: flip it over; the ticket stub opens the artist ----------
    const S = { side: R.store.get('posterSide', 'front'), k: 0 };
    S.k = S.side === 'week' ? 1 : 0;
    const plane = new THREE.Plane(), tmpV = new THREE.Vector3();
    const localY = (cx, cy) => {
      grp.updateMatrixWorld();
      const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(grp.getWorldQuaternion(new THREE.Quaternion()));
      plane.setFromNormalAndCoplanarPoint(nrm, grp.getWorldPosition(tmpV));
      const hit = R.screenToPlane(cx, cy, plane);
      return hit ? grp.worldToLocal(hit).y : 0;
    };
    const STUB = -H / 2 + H * 11 / CH;                  // below the perforation
    function flip(side) {
      if (side === S.side) return;
      S.side = side; R.store.set('posterSide', side);
      if (side === 'week') redrawBack();
      R.sfx.page(0.6, 0.45);
    }
    function openArtist() {
      const info = now();
      if (!info) return R.toast('play something and this turns into a gig poster ♪');
      if (info.room) return R.toast('♪ ' + info.title + ' · live from the record player');
      R.toast('opening ' + (info.artist || info.title) + ' in Spotify…');
      R.openLink('spotify:search:' + encodeURIComponent(info.artist || info.title));
    }
    R.makeClickable(card, '', () => {
      if (S.side === 'front' && R.lastClick && localY(R.lastClick.x, R.lastClick.y) < STUB) return openArtist();
      flip(S.side === 'front' ? 'week' : 'front');
      if (S.side === 'week') {
        const { days, streak } = weekData(), t = days[6];
        R.catSay(t.focus || t.tasks ? 'look at you go: ' + t.focus + ' focus · ' + t.tasks + ' tasks today' : streak ? streak + ' day streak, keep it going!' : 'a fresh week. let\'s fill it up', 3.5);
      }
    });
    let mx = 0, my = 0;
    window.addEventListener('mousemove', ev => { mx = ev.clientX; my = ev.clientY; });
    Object.defineProperty(card.userData, 'label', {
      get: () => S.side === 'week' ? 'my week · click to flip back'
        : (now() && !now().room && localY(mx, my) < STUB) ? 'ticket stub · open ' + (now().artist || 'it') + ' in Spotify'
        : now() ? 'gig poster · click: flip it over for your week · ticket stub: open in Spotify' : 'poster · click: flip it over for your week',
      configurable: true });
    R.store.watch('posterSide', v => { S.side = v === 'week' ? 'week' : 'front'; if (S.side === 'week') redrawBack(); });

    R.tick(dt => {
      S.k = R.damp(S.k, S.side === 'week' ? 1 : 0, 5, dt);
      if (Math.abs(S.k - (S.side === 'week' ? 1 : 0)) < 0.001) S.k = S.side === 'week' ? 1 : 0;
      const e = S.k * S.k * (3 - 2 * S.k);
      card.rotation.y = e * Math.PI;
      card.position.z = Math.sin(e * Math.PI) * (W / 2 + 0.08);      // swings out off the wall to turn
      card.rotation.z = Math.sin(e * Math.PI) * 0.06;
      // the sides swap when the sheet is edge-on
      front.visible = e < 0.5; back.visible = e >= 0.5;
    });
    R.poster = { refresh, flip, redrawBack };
  };
})(window.R);
