// Renderer, camera, picking, ambience, HUD wiring.
(function (R) {
  const canvas = document.getElementById('room');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;   // hard pixel shadows
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1830');
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 80);
  const CAM_BASE = new THREE.Vector3(10.5, 8.2, 14.5);
  const LOOK = new THREE.Vector3(-0.2, 2.5, -1.8);
  R.CAM_BASE = CAM_BASE; R.LOOK = LOOK; R.scene = scene; R.camera = camera;

  R.buildRoom(scene);
  R.buildLamp();
  R.buildWindow();
  R.buildClock();
  R.buildVinyl();
  R.buildRug();
  R.buildWall();
  R.buildStickies();
  R.buildPomodoro();
  R.buildPlant();
  R.buildCat();
  R.buildGirl();
  R.buildCrate();
  R.buildWindowFx();
  R.buildBooks();
  R.buildCalendar();
  R.buildBed();
  R.buildBin();
  R.buildDrawers();
  R.buildPoster();
  R.buildTapes();
  R.buildDecor();
  R.buildLooks();
  R.buildMessages();
  R.buildVibe();
  R.initTasks();
  if (R.params.get('demo') === 'focus' && R.pomo.mode === 'idle') R.pomo.startFocus();
  if (R.params.get('demo') === 'seated') { R.pomo.startFocus(); R.emit('focus:resume'); }
  if (R.params.get('demo') === 'peel') setTimeout(() => R.rugPeel(0.7), 2500);
  if (R.params.get('demo') === 'rug') { R.helper.call = () => Promise.reject(); R.helper.ok = false; R.rugToggle(); }
  if (/^(drawers|treat)$/.test(R.params.get('demo'))) R.clickable.filter(o => /drawer/.test(o.userData.label) && (R.params.get('demo') === 'drawers' || /treat/.test(o.userData.label))).forEach(o => o.userData.onClick());
  if (R.params.get('demo') === 'tapes') setTimeout(() => { R.lastClick = { x: 300, y: 600 }; R.tapes.setMix('rain', 0.6); R.tapes.setMix('fire', 0.4); R.tapes.show(); }, 1500);
  if (R.params.get('demo') === 'stickers') setTimeout(() => { for (let i = 1; i <= 7; i++) R.tapes.award(1000 + i); const b = R.store.get('stickers'); b.stuck = Object.keys(b.got).slice(0, 4); R.store.set('stickers', b); R.store.fire('stickers'); R.lastClick = { x: 300, y: 600 }; }, 1500);
  if (R.params.get('demo') === 'decor') setTimeout(() => { R.decor.set('wall', { p: 'hearts', c: 4 }); R.decor.set('rug', { p: 'round', c: 1 }); R.decor.set('bed', { p: 'gingham', c: 3 }); R.decor.set('curtain', { p: 'dots', c: 2 }); R.decor.set('floor', { p: 'parquet', c: 1 }); R.decor.open('bed'); }, 1500);
  if (R.params.get('demo') === 'dress') setTimeout(() => { if (R.params.has('look')) { R.store.set('look', { girl: { name: 'Juno', hair: R.params.get('look') || 'buns', hairCol: 4, top: 'sweater', topCol: 2, bottom: 'skirt', bottomCol: 4, head: 'cat ears', headCol: 1 }, cat: { name: 'Biscuit', coat: 'orange tabby', eyes: 2, collar: 'bell', collarCol: 0 } }); R.store.fire('look'); } R.looks.show('dress'); }, 1500);
  if (R.params.get('demo') === 'poster') setTimeout(() => { R.music.media = { active: true, title: 'Balam Pichkari', artist: 'Pritam', app: 'Spotify.exe' }; R.emit('media', R.music.media); if (R.params.has('week')) { const wk = {}; [3, 2, 0, 4, 1, 5, 2].forEach((f, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); wk[R.dayKey(d)] = { focus: f, mins: f * 25, tasks: (i * 2) % 5 }; }); R.store.set('week', wk); R.store.fire('week'); R.poster.flip('week'); } }, 1500);
  if (R.params.get('demo') === 'mag') setTimeout(() => { R.openCatalogue(); R.catalogue.goTo(+R.params.get('spread') || 0); if (R.params.has('hold')) setTimeout(() => R.catalogue.hold(+R.params.get('hold')), 1500); }, 1500);
  if (R.params.get('demo') === 'crumple') { R.emit('task:done', { text: 'demo task' }); setTimeout(() => R.emit('task:done', { text: 'demo task' }), 3000); }

  // ---------- ambience: fairy twinkle, dust in the window light, mug steam ----------
  const dustGeo = new THREE.BufferGeometry();
  const N = 60, dpos = new Float32Array(N * 3), rnd = R.rng(31);
  for (let i = 0; i < N; i++) { dpos[i * 3] = -3.6 + rnd() * 3.4; dpos[i * 3 + 1] = 0.5 + rnd() * 4.5; dpos[i * 3 + 2] = -4.3 + rnd() * 3.5; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffe9c4', size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.5 }));
  scene.add(dust);

  const steam = Array.from({ length: 3 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }));
    m.userData.p = i / 3; scene.add(m); return m;
  });

  R.tick((dt, t) => {
    R.fairy.forEach((m, i) => {
      const k = 0.75 + 0.25 * Math.sin(t * 1.3 + i * 1.7) + 0.5 * (R.beat || 0) * ((i % 3) ? 0.6 : 1);
      m.material.color.copy(m.userData.base).multiplyScalar(k);
    });
    const a = dustGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      a.array[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.002 + 0.001;
      a.array[i * 3] += Math.cos(t * 0.3 + i * 2) * 0.0015;
      if (a.array[i * 3 + 1] > 5.2) a.array[i * 3 + 1] = 0.5;
    }
    a.needsUpdate = true;
    dust.material.opacity = 0.2 + 0.4 * (1 - (R.night || 0));
    steam.forEach(s => {
      const p = (t * 0.4 + s.userData.p) % 1;
      s.position.set(R.mugTop.x + Math.sin(p * 8 + s.userData.p * 5) * 0.05, R.mugTop.y + p * 0.6, R.mugTop.z);
      s.material.opacity = Math.sin(p * Math.PI) * 0.45;
    });
  });

  // ---------- sizing: render small, upscale with nearest-neighbour ----------
  let scale = 4;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    scale = +R.cfg.pixelScale || Math.max(2, Math.round(h / 400));
    renderer.setSize(Math.max(1, Math.floor(w / scale)), Math.max(1, Math.floor(h / scale)), false);
    camera.aspect = w / h;
    // keep the room framed on narrow / ultrawide screens
    camera.fov = 26 * Math.max(1, (16 / 9) / camera.aspect * 0.9);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  R.on('cfg', e => { if (e.name === 'pixelScale') resize(); if (e.name === 'showHud') applyHud(); });
  resize();

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, in: false };
  const tip = document.getElementById('tip');
  let travel = 0;   // mouse movement this frame (px), for petting the cat
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(R.clickable, true);
    for (const h of hits) {
      let o = h.object, shown = true;
      for (let q = o; q; q = q.parent) if (q.visible === false) shown = false;
      if (!shown) continue;                       // the raycaster doesn't skip hidden things
      while (o && !o.userData.onClick) o = o.parent;
      if (o) return o;
    }
    return null;
  }
  // screen point → point on the floor (y = h), or null
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  R.screenToFloor = (cx, cy, h = 0.04) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    floorPlane.constant = -h;
    return ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
  };
  // screen point → point on any plane (for dragging things on the walls), or null
  R.screenToPlane = (cx, cy, plane) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  };
  function onUi(ev) { return ev.target !== canvas; }
  let lastMX = null, lastMY = null;
  window.addEventListener('mousemove', ev => {
    if (lastMX != null) travel += Math.abs(ev.clientX - lastMX) + Math.abs(ev.clientY - lastMY);
    lastMX = ev.clientX; lastMY = ev.clientY;
    mouse.x = ev.clientX / window.innerWidth * 2 - 1;
    mouse.y = ev.clientY / window.innerHeight * 2 - 1;
    if (drag) {
      const dx = (drag.x - ev.clientX) / window.innerWidth;
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 6) drag.moved = true;
      drag.obj.userData.onDrag(dx, ev);
      return;
    }
    if (onUi(ev)) { tip.hidden = true; R.hovered = null; return; }
    const o = pick(ev);
    R.hovered = o;
    canvas.style.cursor = o ? (o.userData.onDragStart ? 'grab' : 'pointer') : 'default';
    if (o && o.userData.label) {
      tip.textContent = o.userData.label;
      tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 10 + 'px';
      tip.hidden = false;
    } else tip.hidden = true;
  });
  // draggable objects (the rug) get down/move/up; everything else gets a click
  let drag = null;
  // the room makeover is open: a click on the rug / bed / walls / floor / curtains picks that tab
  let decorClick = false;
  function decorHit(ev) {
    if (!R.decor || !R.decor.isOpen || !R.decorPick) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return R.decorPick(ray.intersectObjects(R.room.children, true).filter(h => h.object.visible));
  }
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0) return;
    decorClick = decorHit(ev);
    if (decorClick) return;
    const o = pick(ev);
    if (o && o.userData.onDragStart) {
      drag = { obj: o, x: ev.clientX, y: ev.clientY, moved: false };
      o.userData.onDragStart();
      canvas.style.cursor = 'grabbing'; tip.hidden = true;
    }
  });
  window.addEventListener('mouseup', ev => {
    if (!drag) return;
    const d = drag; drag = null;
    d.obj.userData.onDragEnd(d.moved, ev);
    suppressClick = true; setTimeout(() => (suppressClick = false), 0);
  });
  let suppressClick = false;
  canvas.addEventListener('mousedown', ev => { R.lastClick = { x: ev.clientX, y: ev.clientY }; }, true);
  canvas.addEventListener('click', ev => {
    if (suppressClick || decorClick) { decorClick = false; return; }
    const o = pick(ev);
    if (o && !o.userData.onDragStart) o.userData.onClick();
  });

  // ---------- HUD ----------
  const hud = document.getElementById('hud');
  let hudOpen = R.store.get('hudOpen', true);
  function applyHud() {
    hud.hidden = !R.cfg.showHud;
    hud.classList.toggle('collapsed', !hudOpen);
  }
  document.getElementById('hudToggle').onclick = () => { hudOpen = !hudOpen; R.store.set('hudOpen', hudOpen); applyHud(); };
  R.on('hud:toggle', () => { hudOpen = !hudOpen; R.store.set('hudOpen', hudOpen); applyHud(); });
  applyHud();

  const P = R.pomo;
  const btnStart = document.getElementById('pomoStart');
  document.getElementById('pomoStart').onclick = () => P.primary();
  document.getElementById('pomoStop').onclick = () => P.stop();
  document.getElementById('pomoSkip').onclick = () => { if (P.mode === 'focus') P.startBreak(); else if (P.mode === 'break') P.stop(); };
  function hudTick() {
    const time = document.getElementById('pomoTime'), mode = document.getElementById('pomoMode');
    if (P.mode === 'idle') { time.textContent = P.fmt(R.min(+R.cfg.focusMin)); mode.textContent = 'ready'; btnStart.textContent = 'focus'; }
    else { time.textContent = P.fmt(P.left()); mode.textContent = (P.pausedLeft ? 'paused · ' : '') + P.mode; btnStart.textContent = P.pausedLeft ? 'resume' : 'pause'; }
    document.getElementById('stats').textContent = 'today: ' + R.prod.focus + ' focus · ' + R.prod.tasks + ' tasks · cat is ' + R.cat.mood;
    const W = R.weather;
    document.getElementById('wx').textContent = (W.temp ? W.temp + ' · ' : '') + W.desc + (W.city ? ' · ' + W.city : '');
    drawPlayer();
    hud.classList.toggle('focusing', P.mode === 'focus');
  }
  // the little player: play/pause next to the song, skip, volume
  const np = document.getElementById('np'), npPlay = document.getElementById('npPlay'), npNext = document.getElementById('npNext'), npVol = document.getElementById('npVol');
  function drawPlayer() {
    const M = R.music, media = M.media || {};
    const vibe = R.vibe && R.vibe.name ? ' · ' + R.vibe.name : '';
    const text = M.nowPlaying ? M.nowPlaying + vibe : (M.playing ? M.station.title : '');
    np.textContent = text ? '♪ ' + text : 'nothing playing';
    np.title = text;
    np.classList.toggle('idle', !text);
    const on = M.playing || !!(media.active && media.playing);
    npPlay.textContent = on ? '❚❚' : '▶';
    npPlay.title = on ? 'pause' : 'play';
    npNext.disabled = !media.active;
    if (document.activeElement !== npVol) npVol.value = Math.round(M.volume.get() * 100);
    npVol.title = 'volume' + (M.volume.app() ? ' (' + M.volume.app() + ')' : '') + ' · ' + npVol.value + '%';
  }
  npPlay.onclick = () => { R.music.playPause(); setTimeout(drawPlayer, 50); };
  npNext.onclick = () => R.music.next();
  npVol.oninput = () => R.music.volume.set(npVol.value / 100);
  npVol.onchange = () => { R.music.volume.set(npVol.value / 100, true); R.toast('volume ' + npVol.value + '%'); };
  ['media', 'music', 'track', 'volume'].forEach(e => R.on(e, () => drawPlayer()));
  R.on('pomo:tick', hudTick);
  hudTick();

  document.getElementById('lightbox').addEventListener('click', ev => {
    if (ev.target.id === 'lightbox' || ev.target.classList.contains('close')) R.closeLightbox();
  });
  window.addEventListener('keydown', ev => { if (ev.key === 'Escape') { R.closeLightbox(); R.closePanel(); } });
  // Lively's "Mouse & keyboard" input can deliver each keystroke twice (its forwarded copy plus
  // the WebView's own), and a busy frame can push the copies tens of ms apart, so timing alone
  // isn't enough. A second keydown for a key that is still held (or that was let go a moment
  // ago) is a copy, unless the key has been held long enough to auto-repeat. And every typed
  // character has to follow its own keydown: text arriving without one is a copy too.
  // Lively sets the extended-key bit on every key it forwards, so its copy has a different
  // ev.code ("KeyS" vs "" or a media key) from the real one. Keys are therefore tracked by
  // keyCode (the same for both), and a keydown whose code differs from the last accepted one
  // for that key is the other source's copy of it, however late it arrives.
  const keys = {};          // keyCode -> { down, at, upAt, last, code, owed }
  let grant = 0;            // characters the last real keydown may type
  const drop = ev => { ev.preventDefault(); ev.stopImmediatePropagation(); };
  const keyId = ev => ev.keyCode || (ev.key.length === 1 ? ev.key.toUpperCase() : ev.key);
  window.addEventListener('keydown', ev => {
    const id = keyId(ev);
    const k = keys[id] = keys[id] || { down: false, at: -1e9, upAt: -1e9, last: -1e9, code: '', owed: false };
    const now = ev.timeStamp;
    if (k.owed && ev.code !== k.code && now - k.last < 600) { k.owed = false; return drop(ev); }
    const held = k.down && now - k.at < 300 && !ev.repeat;
    if (held || now - k.at < 45 || now - k.upAt < 30) return drop(ev);
    if (!k.down) k.at = now;
    k.down = true; k.last = now; k.code = ev.code; k.owed = true;
    grant = ev.key.length === 1 || ev.key === 'Enter' ? 1 : 0;
  }, true);
  window.addEventListener('keyup', ev => { const k = keys[keyId(ev)]; if (k) { k.down = false; k.upAt = ev.timeStamp; } }, true);
  window.addEventListener('blur', () => Object.values(keys).forEach(k => (k.down = false)));
  window.addEventListener('beforeinput', ev => {
    if (ev.inputType !== 'insertText' && ev.inputType !== 'insertLineBreak') return;
    if (ev.isComposing || (ev.data && ev.data.length > 1)) return;     // IME, emoji panel
    if (grant > 0) grant--; else drop(ev);
  }, true);
  document.getElementById('panel').addEventListener('click', ev => {
    if (ev.target.id === 'panel' || ev.target.classList.contains('pclose')) R.closePanel();
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const camPos = CAM_BASE.clone();
  let t = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    R.mouseTravel = travel; travel = 0;
    for (const fn of R.updaters) fn(dt, t);
    // gentle parallax toward the cursor
    camPos.set(CAM_BASE.x + mouse.x * 0.6, CAM_BASE.y - mouse.y * 0.35, CAM_BASE.z);
    camera.position.lerp(camPos, 1 - Math.exp(-2 * dt));
    camera.lookAt(LOOK);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  camera.position.copy(CAM_BASE);
  // debug: ?debug&sim=N fast-forwards N seconds of animation (headless screenshots)
  const sim = +R.params.get('sim');
  if (R.debug && sim) for (let i = 0; i < sim * 30; i++) { t += 1 / 30; for (const fn of R.updaters) fn(1 / 30, t); }
  frame();
  R.renderer = renderer; R.camera = camera;
  if (R.params.has('synctest')) { const st = document.createElement('script'); st.src = 'tools/synctest.js'; document.body.appendChild(st); }
  if (R.debug && R.params.has('selftest')) {
    const st = document.createElement('script'); st.src = 'tools/selftest.js'; document.body.appendChild(st);
  }
})(window.R);
