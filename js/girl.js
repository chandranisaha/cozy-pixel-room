// Curly-haired girl: walks in when a focus session starts, studies at the desk,
// leans back on breaks, leaves when the timer stops. Model faces local +z.
(function (R) {
  const SPAWN = new THREE.Vector3(7.5, 0, 2.2);
  const PATH = [SPAWN, new THREE.Vector3(1.0, 0, 0.2), new THREE.Vector3(-0.9, 0, -2.3), new THREE.Vector3(-2.0, 0, -2.4)];
  const SEAT_HIP = 1.02, STAND_HIP = 1.5;
  // what she can wear (the dress-up tab in the corner box, looks.js)
  const OPTS = R.GIRL_OPTS = {
    skin: ['#f3d2b8', '#e6b894', '#c98d6b', '#a8704e', '#7d4f36', '#5a3826'],
    hair: ['curly', 'bob', 'long', 'buns', 'ponytail', 'pixie'],
    hairCol: ['#3b2418', '#141018', '#8a3a22', '#d8a85a', '#f2a6c4', '#a88ad6', '#5f8fd6', '#7fcfb0', '#e8e4f0'],
    top: ['hoodie', 'sweater', 'tee', 'cardigan'],
    topCol: ['#e0915a', '#f6b6c4', '#a88ad6', '#6aa0d8', '#8fc7a0', '#f2cf6a', '#efe3d0', '#3a3560', '#c25b5b'],
    bottom: ['jeans', 'skirt', 'shorts'],
    bottomCol: ['#4b4876', '#3f5f8a', '#2c2a3a', '#a8714a', '#c25b5b', '#efe3d0', '#7f6bb0'],
    shoes: ['#f2ece2', '#2c2a3a', '#c25b5b', '#f6b6c4', '#f7c86b'],
    head: ['headphones', 'cat ears', 'beanie', 'bow', 'none'],
    headCol: ['#d0565b', '#f6b6c4', '#efe3d0', '#2c2a3a', '#6aa0d8', '#8fc7a0', '#f7c86b'],
  };
  const DEF = { name: 'Mika', skin: 2, hair: 'curly', hairCol: 0, top: 'hoodie', topCol: 0, bottom: 'jeans', bottomCol: 0, shoes: 0, head: 'headphones', headCol: 0 };
  R.GIRL_DEF = DEF;
  R.girlLook = () => Object.assign({}, DEF, (R.store.get('look', {}) || {}).girl || {});
  const shade = (hex, l) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return c; };

  function hairStyle(g, style, mats) {
    const rnd = R.rng(17);
    const box = (s, x, y, z, m, rot) => { const c = R.box(s, s, s, m, x, y, z, g); if (rot) c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); return c; };
    const curly = style === 'curly';
    const shell = (n, r0, rr, s0, ss, rot) => {
      for (let i = 0; i < n; i++) {
        const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
        const x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
        if (z > 0.35 && y < 0.55) continue;                                // face
        if (y < -0.2) continue;
        const r = r0 + rnd() * rr;
        box(s0 + rnd() * ss, x * r * 1.05, 0.1 + y * r, z * r, mats[i % 4], rot);
      }
    };
    const fall = (n, y0, y1, r0, spread, s0) => {                       // hair falling down the back and sides
      for (let i = 0; i < n; i++) {
        const a = (rnd() - 0.5) * Math.PI * spread + Math.PI;
        const y = y0 - rnd() * (y0 - y1), r = r0 + rnd() * 0.06;
        box(s0 + rnd() * 0.05, Math.sin(a) * r, y, Math.cos(a) * r, mats[(i + 1) % 4], curly);
      }
    };
    if (curly) { shell(150, 0.36, 0.08, 0.13, 0.09, true); fall(45, -0.1, -0.6, 0.3, 1.25, 0.13); return; }
    if (style === 'pixie') { shell(110, 0.33, 0.04, 0.14, 0.05, false); return; }
    shell(130, 0.35, 0.05, 0.15, 0.06, false);
    if (style === 'bob') fall(40, 0.0, -0.3, 0.33, 1.3, 0.15);
    if (style === 'long') { fall(70, 0.0, -0.95, 0.31, 1.15, 0.15); }
    if (style === 'buns') [-1, 1].forEach(sx => { for (let i = 0; i < 14; i++) box(0.12 + rnd() * 0.05, sx * 0.25 + (rnd() - 0.5) * 0.14, 0.5 + (rnd() - 0.5) * 0.14, -0.05 + (rnd() - 0.5) * 0.14, mats[i % 4], true); });
    if (style === 'ponytail') {
      for (let i = 0; i < 10; i++) { const k = i / 9; box(0.17 - k * 0.05, 0, 0.32 - k * 0.75, -0.42 - Math.sin(k * 2.2) * 0.12, mats[i % 4], false); }
      R.box(0.2, 0.08, 0.1, mats[3], 0, 0.36, -0.4, g);                  // scrunchie spot
    }
  }

  R.buildGirl = function () {
    const root = R.group(SPAWN.x, 0, SPAWN.z, R.room);
    root.visible = false;
    const hips = R.group(0, STAND_HIP, 0, root);
    const M = {
      skin: R.mat('#c98d6b'), top: R.mat('#e0915a'), topDark: R.mat('#c97a4a'), inner: R.mat('#f4f1ea'),
      pants: R.mat('#4b4876'), shoe: R.mat('#f2ece2'), headwear: R.mat('#d0565b'), headDark: R.mat('#d0565b'),
      hair: [0, 1, 2, 3].map(() => R.mat('#3b2418')),
    };
    const stripeTex = R.canvasTex(8, 8, () => {});

    // legs: thigh + shin, each can be fabric or bare
    const leg = (x) => {
      const thigh = R.group(x, 0, 0, hips);
      const up = R.box(0.28, 0.75, 0.3, M.pants, 0, -0.375, 0, thigh);
      const knee = R.group(0, -0.75, 0, thigh);
      const low = R.box(0.26, 0.72, 0.28, M.pants, 0, -0.36, 0, knee);
      R.box(0.28, 0.12, 0.42, M.shoe, 0, -0.72, 0.06, knee);
      return { thigh, knee, up, low };
    };
    const L = leg(-0.17), Rl = leg(0.17);
    const skirt = R.box(0.86, 0.42, 0.56, M.pants, 0, -0.14, 0.02, hips);

    // upper body pivots at the hips so it can lean
    const spine = R.group(0, 0, 0, hips);
    const torso = R.box(0.8, 1.0, 0.46, M.top, 0, 0.5, 0, spine);
    const hem = R.box(0.82, 0.14, 0.48, M.topDark, 0, 0.05, 0, spine);
    const pocket = R.box(0.5, 0.18, 0.12, M.topDark, 0, 0.3, 0.24, spine);
    const hood = R.box(0.6, 0.22, 0.16, M.topDark, 0, 0.92, -0.26, spine);
    const placket = R.box(0.18, 0.9, 0.02, M.inner, 0, 0.52, 0.235, spine);   // cardigan's open front
    const arm = (x) => {
      const sh = R.group(x, 0.9, 0, spine);
      const up = R.box(0.22, 0.36, 0.24, M.top, 0, -0.16, 0, sh);
      const low = R.box(0.21, 0.36, 0.23, M.top, 0, -0.52, 0, sh);
      R.box(0.18, 0.16, 0.2, M.skin, 0, -0.76, 0, sh);
      return { sh, up, low };
    };
    const AL = arm(-0.51), AR = arm(0.51), armL = AL.sh, armR = AR.sh;

    const head = R.group(0, 1.32, 0, spine);
    R.box(0.18, 0.14, 0.18, M.skin, 0, -0.25, 0, head);         // neck
    R.box(0.56, 0.58, 0.52, M.skin, 0, 0.05, 0, head);
    R.box(0.08, 0.08, 0.02, R.mat('#2c2a3a'), -0.13, 0.06, 0.265, head);
    R.box(0.08, 0.08, 0.02, R.mat('#2c2a3a'), 0.13, 0.06, 0.265, head);
    R.box(0.09, 0.05, 0.02, R.mat('#e8857a'), -0.19, -0.06, 0.262, head);
    R.box(0.09, 0.05, 0.02, R.mat('#e8857a'), 0.19, -0.06, 0.262, head);
    R.box(0.1, 0.03, 0.02, R.mat('#8a4a3a'), 0, -0.13, 0.262, head);
    let hairG = null, hatG = null, shown = {};

    function headwear(kind) {
      const g = R.group(0, 0, 0, head), hp = M.headwear;
      if (kind === 'headphones' || kind === 'cat ears') {
        R.box(0.08, 0.1, 0.62, hp, 0, 0.52, 0, g);
        R.box(0.62, 0.08, 0.1, hp, 0, 0.52, -0.02, g);
        R.box(0.1, 0.24, 0.22, hp, -0.36, 0.02, 0, g);
        R.box(0.1, 0.24, 0.22, hp, 0.36, 0.02, 0, g);
        if (kind === 'cat ears') [-1, 1].forEach(sx => {
          const e = R.group(sx * 0.24, 0.55, 0, g); e.rotation.z = -sx * 0.25;
          R.box(0.16, 0.12, 0.08, hp, 0, 0.04, 0, e); R.box(0.1, 0.08, 0.08, hp, 0, 0.13, 0, e); R.box(0.05, 0.05, 0.08, hp, 0, 0.19, 0, e);
          R.box(0.07, 0.07, 0.02, M.headDark, 0, 0.09, 0.045, e);
        });
      } else if (kind === 'beanie') {
        R.box(0.74, 0.3, 0.7, hp, 0, 0.42, -0.02, g);
        R.box(0.78, 0.1, 0.74, M.headDark, 0, 0.3, -0.02, g);
        R.box(0.16, 0.14, 0.16, M.headDark, 0, 0.64, -0.02, g);
      } else if (kind === 'bow') {
        const b = R.group(0.3, 0.42, 0.1, g); b.rotation.z = -0.3;
        R.box(0.18, 0.16, 0.08, hp, -0.1, 0, 0, b); R.box(0.18, 0.16, 0.08, hp, 0.1, 0, 0, b); R.box(0.08, 0.1, 0.1, M.headDark, 0, 0, 0, b);
      }
      return g;
    }
    function apply(look) {
      const o = OPTS, at = (list, i) => list[i] || list[0];
      M.skin.color.set(at(o.skin, look.skin));
      const hc = at(o.hairCol, look.hairCol);
      M.hair.forEach((m, i) => m.color.copy(shade(hc, [0, 0.04, -0.04, 0.08][i])));
      const tc = at(o.topCol, look.topCol);
      M.top.color.set(tc); M.topDark.color.copy(shade(tc, -0.08));
      M.pants.color.set(at(o.bottomCol, look.bottomCol));
      M.shoe.color.set(at(o.shoes, look.shoes));
      const hw = at(o.headCol, look.headCol);
      M.headwear.color.set(hw); M.headDark.color.copy(shade(hw, look.head === 'cat ears' ? 0.2 : -0.1));
      // top: sweater stripes, tee sleeves, cardigan front, hoodie pocket + hood
      if (look.top === 'sweater') {
        const g = stripeTex.userData.ctx; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#' + shade(tc, 0.22).getHexString(); g.fillRect(0, 2, 8, 2); g.fillRect(0, 6, 8, 1);
        stripeTex.needsUpdate = true; M.top.map = stripeTex;
      } else M.top.map = null;
      M.top.needsUpdate = true;
      pocket.visible = hood.visible = look.top === 'hoodie';
      placket.visible = look.top === 'cardigan';
      [AL, AR].forEach(a => (a.low.material = look.top === 'tee' ? M.skin : M.top));
      // bottoms
      skirt.visible = look.bottom === 'skirt';
      [L, Rl].forEach(l => { l.up.material = look.bottom === 'skirt' ? M.skin : M.pants; l.low.material = look.bottom === 'jeans' ? M.pants : M.skin; });
      if (shown.hair !== look.hair) { if (hairG) head.remove(hairG); hairG = R.group(0, 0, 0, head); hairStyle(hairG, look.hair, M.hair); shown.hair = look.hair; }
      if (shown.head !== look.head) { if (hatG) head.remove(hatG); hatG = headwear(look.head); shown.head = look.head; }
      root.userData.label = look.name || 'her';
    }
    apply(R.girlLook());
    R.store.watch('look', () => apply(R.girlLook()));

    // ---------- state machine ----------
    const G = R.girl = { state: 'away', root };
    let path = [], seg = 0, segT = 0, t = 0, sitK = 0, phaseT = 0, stretch = 0;

    function follow(points) { path = points.map(p => p.clone()); seg = 0; segT = 0; }
    function placeSeated(state) {
      root.visible = true;
      const end = PATH[PATH.length - 1];
      root.position.copy(end); root.rotation.y = Math.PI;
      sitK = 1; G.state = state;
    }
    G.enter = () => {
      if (G.state === 'focus' || G.state === 'break' || G.state === 'sitdown') { G.state = 'focus'; return; }
      root.visible = true;
      root.position.copy(SPAWN);
      follow(PATH); G.state = 'enter';
    };
    // dress-up: she stands on the rug facing you while you change her look
    G.pose = on => {
      if (on) {
        if (G.state !== 'away') return;
        G.state = 'pose'; root.visible = true; sitK = 0;
        root.position.set(0.7, 0, -0.9); root.rotation.y = Math.atan2(R.CAM_BASE.x - 0.7, R.CAM_BASE.z + 0.9);
      } else if (G.state === 'pose') { G.state = 'away'; root.visible = false; }
    };
    G.leave = () => {
      if (G.state === 'away' || G.state === 'leave' || G.state === 'standup') return;
      G.state = 'standup'; phaseT = 0;
    };

    R.on('focus:start', () => G.enter());
    R.on('focus:resume', () => placeSeated('focus'));
    R.on('break:start', () => { if (G.state === 'away') placeSeated('break'); else if (G.state !== 'enter') G.state = 'break'; });
    R.on('pomo:pause', paused => { if (G.state === 'focus' || G.state === 'break') G.state = paused ? 'break' : (R.pomo.mode === 'focus' ? 'focus' : 'break'); });
    R.on('pomo:stop', () => G.leave());

    const SPEED = 2.4;
    const turn = (a, b, k, dt) => {
      const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      return a + d * (1 - Math.exp(-k * dt));
    };
    R.tick(dt => {
      t += dt;
      if (G.state === 'away') return;

      let walking = false;
      if (G.state === 'enter' || G.state === 'leave') {
        const a = path[seg], b = path[seg + 1];
        if (b) {
          const len = a.distanceTo(b);
          segT += dt * SPEED / len;
          if (segT >= 1) { seg++; segT = 0; }
          const p = path[seg + 1] ? a.clone().lerp(b, Math.min(segT, 1)) : b;
          root.position.copy(p);
          const dir = b.clone().sub(a);
          root.rotation.y = turn(root.rotation.y, Math.atan2(dir.x, dir.z), 10, dt);
          walking = true;
        }
        if (!path[seg + 1]) {
          if (G.state === 'enter') { G.state = 'sitdown'; phaseT = 0; }
          else { G.state = 'away'; root.visible = false; return; }
        }
      }
      if (G.state === 'sitdown') {
        phaseT += dt;
        root.rotation.y = turn(root.rotation.y, Math.PI, 8, dt);
        sitK = Math.min(1, phaseT / 0.7);
        if (sitK >= 1) {
          if (R.pomo.mode === 'idle') { G.state = 'standup'; phaseT = 0; }
          else G.state = R.pomo.mode === 'focus' && !R.pomo.pausedLeft ? 'focus' : 'break';
        }
      }
      if (G.state === 'standup') {
        phaseT += dt;
        sitK = Math.max(0, 1 - phaseT / 0.6);
        if (sitK <= 0) { follow(PATH.slice().reverse()); G.state = 'leave'; }
      }

      // ---- pose ----
      const sit = sitK * sitK * (3 - 2 * sitK);
      hips.position.y = R.lerp(STAND_HIP, SEAT_HIP, sit) + (walking ? Math.abs(Math.sin(t * 9)) * 0.06 : 0);
      hips.position.z = R.lerp(0, 0.08, sit);
      const swing = walking ? Math.sin(t * 9) * 0.55 : 0;
      L.thigh.rotation.x = R.lerp(swing, -Math.PI / 2, sit);
      Rl.thigh.rotation.x = R.lerp(-swing, -Math.PI / 2, sit);
      L.knee.rotation.x = R.lerp(walking ? Math.max(0, -swing) * 0.8 : 0, Math.PI / 2, sit);
      Rl.knee.rotation.x = R.lerp(walking ? Math.max(0, swing) * 0.8 : 0, Math.PI / 2, sit);

      const focusing = G.state === 'focus', resting = G.state === 'break';
      const music = R.music && R.music.spinning();
      let armX = -swing * 0.8, armRX = swing * 0.8, lean = 0, headX = 0, headY = 0, armZ = 0;
      if (focusing) {
        armX = -1.15 + Math.sin(t * 14) * 0.06;       // typing
        armRX = -1.15 + Math.sin(t * 14 + 1.7) * 0.06;
        lean = 0.12;
        headX = 0.12 + (music ? Math.sin(t * 2.5) * 0.06 : 0);   // nods to the music
        headY = Math.sin(t * 0.3) * 0.08;
      } else if (G.state === 'pose') {               // waves, sways a little
        armRX = -2.7 + Math.sin(t * 7) * 0.25; armZ = 0.35 + Math.sin(t * 7) * 0.2;
        armX = -0.1; headX = -0.05; headY = Math.sin(t * 1.3) * 0.15; lean = Math.sin(t * 2) * 0.03;
      } else if (resting) {
        stretch -= dt;
        if (stretch < -9) stretch = 2.5;
        if (stretch > 0) { armX = armRX = -2.9; armZ = 0.25; lean = -0.15; headX = -0.3; }   // big stretch
        else { armX = -0.5; armRX = -0.2; lean = -0.22; headX = -0.2; headY = -0.45; }        // gazing out the window
      }
      armL.rotation.x = R.damp(armL.rotation.x, armX, 8, dt);
      armR.rotation.x = R.damp(armR.rotation.x, armRX, 8, dt);
      armL.rotation.z = R.damp(armL.rotation.z, G.state === 'pose' ? -0.08 : -armZ, 8, dt);
      armR.rotation.z = R.damp(armR.rotation.z, armZ, 8, dt);
      spine.rotation.x = R.damp(spine.rotation.x, lean, 4, dt);
      head.rotation.x = R.damp(head.rotation.x, headX, 5, dt);
      head.rotation.y = R.damp(head.rotation.y, headY, 3, dt);
    });

    const nm = () => R.girlLook().name || 'she';
    R.makeClickable(root, nm(), () => {
      if (G.state === 'focus') R.toast(nm() + ': shh, focusing · ' + R.pomo.fmt(R.pomo.left()) + ' left');
      else if (G.state === 'break') R.toast(nm() + ' is on a break ☕');
      else if (G.state === 'pose') R.toast(nm() + ': how do i look? ✨');
      else R.toast(nm() + ': hi!');
    });
    G.apply = () => apply(R.girlLook());
  };
})(window.R);
