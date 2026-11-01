// Curly-haired girl: walks in when a focus session starts, studies at the desk,
// leans back on breaks, leaves when the timer stops. Model faces local +z.
(function (R) {
  const SPAWN = new THREE.Vector3(7.5, 0, 2.2);
  const PATH = [SPAWN, new THREE.Vector3(1.0, 0, 0.2), new THREE.Vector3(-0.9, 0, -2.3), new THREE.Vector3(-2.0, 0, -2.4)];
  const SEAT_HIP = 1.02, STAND_HIP = 1.5;
  const SKIN = '#c98d6b', HOODIE = '#e0915a', PANTS = '#4b4876', SHOE = '#f2ece2';
  const HAIR = ['#3b2418', '#4a2d1d', '#2e1b12', '#56351f'];

  R.buildGirl = function () {
    const root = R.group(SPAWN.x, 0, SPAWN.z, R.room);
    root.visible = false;
    const hips = R.group(0, STAND_HIP, 0, root);

    // legs
    const leg = (x) => {
      const thigh = R.group(x, 0, 0, hips);
      R.box(0.28, 0.75, 0.3, R.mat(PANTS), 0, -0.375, 0, thigh);
      const knee = R.group(0, -0.75, 0, thigh);
      R.box(0.26, 0.72, 0.28, R.mat(PANTS), 0, -0.36, 0, knee);
      R.box(0.28, 0.12, 0.42, R.mat(SHOE), 0, -0.72, 0.06, knee);
      return { thigh, knee };
    };
    const L = leg(-0.17), Rl = leg(0.17);

    // upper body pivots at the hips so it can lean
    const spine = R.group(0, 0, 0, hips);
    R.box(0.8, 1.0, 0.46, R.mat(HOODIE), 0, 0.5, 0, spine);
    R.box(0.82, 0.14, 0.48, R.mat('#c97a4a'), 0, 0.05, 0, spine);   // hoodie hem
    R.box(0.5, 0.18, 0.12, R.mat('#c97a4a'), 0, 0.3, 0.24, spine);   // pocket
    const arm = (x) => {
      const sh = R.group(x, 0.9, 0, spine);
      R.box(0.22, 0.72, 0.24, R.mat(HOODIE), 0, -0.34, 0, sh);
      R.box(0.18, 0.16, 0.2, R.mat(SKIN), 0, -0.76, 0, sh);
      return sh;
    };
    const armL = arm(-0.51), armR = arm(0.51);

    const head = R.group(0, 1.32, 0, spine);
    R.box(0.18, 0.14, 0.18, R.mat(SKIN), 0, -0.25, 0, head);         // neck
    R.box(0.56, 0.58, 0.52, R.mat(SKIN), 0, 0.05, 0, head);
    R.box(0.08, 0.08, 0.02, R.mat('#2c2a3a'), -0.13, 0.06, 0.265, head);
    R.box(0.08, 0.08, 0.02, R.mat('#2c2a3a'), 0.13, 0.06, 0.265, head);
    R.box(0.09, 0.05, 0.02, R.mat('#e8857a'), -0.19, -0.06, 0.262, head);
    R.box(0.09, 0.05, 0.02, R.mat('#e8857a'), 0.19, -0.06, 0.262, head);
    R.box(0.1, 0.03, 0.02, R.mat('#8a4a3a'), 0, -0.13, 0.262, head);

    // curly hair: clumps on a shell around the head, leaving the face open, falling to the shoulders
    const rnd = R.rng(17);
    const hairMats = HAIR.map(c => R.mat(c));
    for (let i = 0; i < 150; i++) {
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
      const x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
      if (z > 0.35 && y < 0.55) continue;                                  // face
      const r = 0.36 + rnd() * 0.08;
      const s = 0.13 + rnd() * 0.09;
      const c = R.box(s, s, s, hairMats[i % 4], x * r * 1.05, 0.1 + y * r, z * r, head);
      c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    }
    for (let i = 0; i < 45; i++) {                                          // curls down the back and sides
      const a = (rnd() - 0.5) * Math.PI * 1.25 + Math.PI;
      const y = -0.1 - rnd() * 0.5;
      const r = 0.3 + rnd() * 0.12;
      const s = 0.13 + rnd() * 0.08;
      const c = R.box(s, s, s, hairMats[(i + 1) % 4], Math.sin(a) * r, y, Math.cos(a) * r, head);
      c.rotation.set(rnd() * 3, rnd() * 3, 0);
    }
    // headphones
    const hp = R.mat('#d0565b');
    R.box(0.08, 0.1, 0.62, hp, 0, 0.52, 0, head).rotation.x = 0;
    R.box(0.62, 0.08, 0.1, hp, 0, 0.52, -0.02, head);
    R.box(0.1, 0.24, 0.22, hp, -0.36, 0.02, 0, head);
    R.box(0.1, 0.24, 0.22, hp, 0.36, 0.02, 0, head);

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
      } else if (resting) {
        stretch -= dt;
        if (stretch < -9) stretch = 2.5;
        if (stretch > 0) { armX = armRX = -2.9; armZ = 0.25; lean = -0.15; headX = -0.3; }   // big stretch
        else { armX = -0.5; armRX = -0.2; lean = -0.22; headX = -0.2; headY = -0.45; }        // gazing out the window
      }
      armL.rotation.x = R.damp(armL.rotation.x, armX, 8, dt);
      armR.rotation.x = R.damp(armR.rotation.x, armRX, 8, dt);
      armL.rotation.z = R.damp(armL.rotation.z, -armZ, 8, dt);
      armR.rotation.z = R.damp(armR.rotation.z, armZ, 8, dt);
      spine.rotation.x = R.damp(spine.rotation.x, lean, 4, dt);
      head.rotation.x = R.damp(head.rotation.x, headX, 5, dt);
      head.rotation.y = R.damp(head.rotation.y, headY, 3, dt);
    });

    R.makeClickable(root, 'her', () => {
      if (G.state === 'focus') R.toast('shh, focusing · ' + R.pomo.fmt(R.pomo.left()) + ' left');
      else if (G.state === 'break') R.toast('on a break ☕');
      else R.toast('hi!');
    });
  };
})(window.R);
