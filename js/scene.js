// Static room: walls, floor, window frame, desk, chair, bed, shelf, rug, lights.
// Units: ~2 units per metre. Back wall at z=-4.5, left wall at x=-6, floor y=0.
(function (R) {
  const PAL = {
    wall: '#5d5a8c', wallDark: '#4b4876', trim: '#3a3560',
    wood: '#8a5636', woodDark: '#6a3f27', woodLight: '#a8714a',
    desk: '#7a4a32', bedFrame: '#5b3a2a', blanket: '#d98a6a', blanket2: '#c46f58',
    sheet: '#efe3d0', pillow: '#f6eee2', rug1: '#b85c5c', rug2: '#e8c39e', rug3: '#7a3f55',
    curtain: '#c0607a', curtainDark: '#a14d65', metal: '#2c2a3a',
  };
  R.PAL = PAL;

  // ---------- procedural pixel textures ----------
  function planks() {
    const t = R.canvasTex(32, 32, (g) => {
      const rnd = R.rng(7);
      for (let row = 0; row < 4; row++) {
        const shades = ['#8a5636', '#7e4e31', '#94603d', '#835233'];
        g.fillStyle = shades[row % 4];
        g.fillRect(0, row * 8, 32, 8);
        g.fillStyle = '#5e3721';
        g.fillRect(0, row * 8 + 7, 32, 1);
        const seam = Math.floor(rnd() * 32);
        g.fillRect(seam, row * 8, 1, 8);
        g.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rnd() * 32), row * 8 + 1 + Math.floor(rnd() * 5), 3, 1);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 5);
    return t;
  }

  function wallpaper() {
    const t = R.canvasTex(16, 16, (g) => {
      g.fillStyle = PAL.wall; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#65629a';
      g.fillRect(3, 3, 1, 1); g.fillRect(11, 11, 1, 1);
      g.fillRect(2, 4, 3, 1); g.fillRect(3, 2, 1, 3);
      g.fillStyle = '#56538a';
      g.fillRect(11, 3, 1, 1); g.fillRect(3, 11, 1, 1);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 4);
    return t;
  }

  function rugTex() {
    return R.canvasTex(40, 28, (g, w, h) => {
      g.fillStyle = PAL.rug1; g.fillRect(0, 0, w, h);
      g.fillStyle = PAL.rug2; g.fillRect(2, 2, w - 4, h - 4);
      g.fillStyle = PAL.rug3; g.fillRect(4, 4, w - 8, h - 8);
      g.fillStyle = PAL.rug1; g.fillRect(6, 6, w - 12, h - 12);
      g.fillStyle = PAL.rug2;
      for (let i = 0; i < 5; i++) {
        const cx = 10 + i * 5, cy = h / 2;
        g.fillRect(cx - 1, cy - 3, 2, 6); g.fillRect(cx - 3, cy - 1, 6, 2);
      }
      g.fillStyle = '#f3dcc0';
      for (let x = 0; x < w; x += 2) { g.fillRect(x, 0, 1, 1); g.fillRect(x, h - 1, 1, 1); }
    });
  }

  function blanketTex() {
    return R.canvasTex(24, 24, (g, w, h) => {
      g.fillStyle = PAL.blanket; g.fillRect(0, 0, w, h);
      g.fillStyle = PAL.blanket2;
      for (let i = 0; i < w; i += 6) { g.fillRect(i, 0, 3, h); }
      g.fillStyle = 'rgba(255,240,220,0.35)';
      for (let j = 0; j < h; j += 6) { g.fillRect(0, j, w, 1); }
    });
  }

  function curtainTex() {
    return R.canvasTex(8, 16, (g, w, h) => {
      g.fillStyle = PAL.curtain; g.fillRect(0, 0, w, h);
      g.fillStyle = PAL.curtainDark; g.fillRect(2, 0, 1, h); g.fillRect(6, 0, 1, h);
    });
  }

  function bookSpines(n, seed) {
    const rnd = R.rng(seed);
    const cols = ['#d4a24c', '#6aa0a8', '#c25b5b', '#7f6bb0', '#e3d4b0', '#5e8c5a', '#d77f4e'];
    return Array.from({ length: n }, () => ({
      color: cols[Math.floor(rnd() * cols.length)],
      h: 0.45 + rnd() * 0.25,
      w: 0.1 + rnd() * 0.08,
    }));
  }

  R.buildRoom = function (scene) {
    const room = R.group(0, 0, 0, scene);
    R.room = room;
    const wallMat = R.texMat(wallpaper());
    const trimMat = R.mat(PAL.trim);

    // floor
    const floor = R.box(12, 0.2, 9, R.texMat(planks()), 0, -0.1, 0, room);
    floor.castShadow = false;

    // left wall
    R.box(0.2, 6.5, 9, wallMat, -6.1, 3.25, 0, room);
    R.box(0.08, 0.3, 9, trimMat, -5.96, 0.15, 0, room);

    // back wall with window hole: hole x∈[-3.6,-0.4], y∈[2.4,5.0]
    const W = { x0: -3.6, x1: -0.4, y0: 2.4, y1: 5.0 };
    R.windowRect = W;
    const bz = -4.6;
    R.box(W.x0 + 6.2, 6.5, 0.2, wallMat, (-6.2 + W.x0) / 2, 3.25, bz, room);      // left of hole
    R.box(6.2 - W.x1, 6.5, 0.2, wallMat, (W.x1 + 6.2) / 2, 3.25, bz, room);        // right of hole
    R.box(W.x1 - W.x0, W.y0, 0.2, wallMat, (W.x0 + W.x1) / 2, W.y0 / 2, bz, room); // below
    R.box(W.x1 - W.x0, 6.5 - W.y1, 0.2, wallMat, (W.x0 + W.x1) / 2, (W.y1 + 6.5) / 2, bz, room); // above
    R.box(12, 0.3, 0.08, trimMat, 0, 0.15, -4.46, room);

    // window frame
    const frameMat = R.mat('#e9dcc6');
    const cx = (W.x0 + W.x1) / 2, cy = (W.y0 + W.y1) / 2, ww = W.x1 - W.x0, wh = W.y1 - W.y0;
    R.box(ww + 0.3, 0.15, 0.3, frameMat, cx, W.y1 + 0.05, -4.5, room);
    R.box(ww + 0.5, 0.15, 0.55, frameMat, cx, W.y0 - 0.05, -4.38, room); // sill
    R.box(0.15, wh, 0.3, frameMat, W.x0 - 0.05, cy, -4.5, room);
    R.box(0.15, wh, 0.3, frameMat, W.x1 + 0.05, cy, -4.5, room);
    R.box(0.08, wh, 0.12, frameMat, cx, cy, -4.6, room);
    R.box(ww, 0.08, 0.12, frameMat, cx, cy + 0.2, -4.6, room);

    // curtains + rod
    R.box(ww + 1.6, 0.06, 0.06, R.mat(PAL.metal), cx, W.y1 + 0.35, -4.25, room);
    const cm = R.texMat(curtainTex());
    R.curtains = [
      R.box(0.55, wh + 0.9, 0.12, cm, W.x0 - 0.45, cy + 0.05, -4.3, room),
      R.box(0.55, wh + 0.9, 0.12, cm, W.x1 + 0.45, cy + 0.05, -4.3, room),
    ];

    // things on the sill
    R.box(0.3, 0.25, 0.3, R.mat('#c97c5d'), W.x1 - 0.4, W.y0 + 0.15, -4.3, room); // tiny pot
    R.box(0.08, 0.3, 0.08, R.mat('#6f9e5a'), W.x1 - 0.4, W.y0 + 0.4, -4.3, room);
    R.box(0.18, 0.4, 0.18, R.mat('#e6c88a', { emissive: '#7a5a20' }), W.x0 + 0.4, W.y0 + 0.2, -4.3, room); // candle jar

    // ---------- desk ----------
    const desk = R.group(-2, 0, -3.75, room);
    R.deskGroup = desk;
    const dm = R.mat(PAL.desk), dmd = R.mat(PAL.woodDark);
    R.box(3.8, 0.12, 1.5, dm, 0, 1.55, 0, desk);
    for (const [x, z] of [[-1.8, -0.65], [1.8, -0.65], [-1.8, 0.65], [1.8, 0.65]])
      R.box(0.12, 1.5, 0.12, dmd, x, 0.75, z, desk);
    R.box(0.9, 0.9, 1.3, dm, 1.3, 1.0, 0, desk);   // drawer block
    R.deskMat = dm;   // the two drawers themselves are in drawers.js

    // books on desk
    let bx = 1.0;
    for (const b of bookSpines(5, 3)) {
      R.box(b.w, b.h, 0.5, R.mat(b.color), bx, 1.61 + b.h / 2, -0.45, desk);
      bx += b.w + 0.02;
    }
    R.box(0.55, 0.04, 0.4, R.mat('#e3d4b0'), 0.55, 1.63, 0.4, desk); // open notebook
    R.box(0.02, 0.02, 0.35, R.mat('#c25b5b'), 0.7, 1.66, 0.4, desk);

    // mug with steam handled in main (just the mug here)
    const mug = R.group(1.25, 1.61, 0.35, desk);
    R.box(0.2, 0.24, 0.2, R.mat('#f0e6d6'), 0, 0.12, 0, mug);
    R.box(0.06, 0.12, 0.04, R.mat('#f0e6d6'), 0.13, 0.13, 0, mug);
    R.mugTop = new THREE.Vector3(-2 + 1.25, 1.61 + 0.3, -3.75 + 0.35);

    // ---------- chair ----------
    const chair = R.group(-2, 0, -2.45, room);
    R.chair = chair;
    const chm = R.mat('#3f3b5c');
    R.box(1.0, 0.12, 0.95, chm, 0, 0.9, 0, chair);
    R.box(1.0, 1.05, 0.12, chm, 0, 1.5, 0.45, chair);
    R.box(0.08, 0.85, 0.08, R.mat(PAL.metal), 0, 0.45, 0, chair);
    R.box(0.8, 0.06, 0.06, R.mat(PAL.metal), 0, 0.05, 0, chair);
    R.box(0.06, 0.06, 0.8, R.mat(PAL.metal), 0, 0.05, 0, chair);

    // ---------- bed (right, against back wall) ----------
    const bed = R.group(3.7, 0, -2.9, room);
    R.bedGroup = bed;
    R.box(3.9, 0.5, 3.2, R.mat(PAL.bedFrame), 0, 0.3, 0, bed);
    R.box(3.8, 0.35, 3.1, R.mat(PAL.sheet), 0, 0.72, 0, bed);
    R.box(3.9, 1.8, 0.2, R.mat(PAL.bedFrame), 0, 0.9, -1.55, bed); // headboard
    R.box(1.3, 0.3, 0.7, R.mat(PAL.pillow), -0.9, 1.05, -1.05, bed);
    R.box(1.3, 0.3, 0.7, R.mat('#e9d9c6'), 0.75, 1.05, -1.05, bed);
    R.box(3.85, 0.12, 2.0, R.texMat(blanketTex()), 0, 0.95, 0.5, bed);
    R.box(3.85, 0.45, 0.1, R.texMat(blanketTex()), 0, 0.75, 1.52, bed);

    // ---------- vinyl cabinet (left wall) ----------
    const cab = R.group(-5.4, 0, -0.3, room);
    R.cabinet = cab;
    R.box(1.0, 1.3, 2.3, R.mat(PAL.woodLight), 0, 0.65, 0, cab);
    R.box(0.04, 0.5, 2.0, R.mat(PAL.woodDark), 0.52, 0.85, 0, cab);
    // record sleeves in the cabinet front
    const sleeves = ['#d4a24c', '#6aa0a8', '#c25b5b', '#7f6bb0', '#e3d4b0', '#5e8c5a'];
    sleeves.forEach((c, i) => R.box(0.5, 0.5, 0.05, R.mat(c), 0.2, 0.32, -0.9 + i * 0.32, cab));

    // floating shelf + books above cabinet
    R.box(0.6, 0.08, 2.2, R.mat(PAL.woodDark), -5.7, 3.1, -0.3, room);
    let bz2 = -1.3;
    R.shelfBooks = [];
    for (const b of bookSpines(10, 11)) {
      R.shelfBooks.push(R.box(0.4, b.h, b.w, R.mat(b.color), -5.75, 3.14 + b.h / 2, bz2, room));
      bz2 += b.w + 0.02;
    }
    R.box(0.3, 0.3, 0.3, R.mat('#c97c5d'), -5.7, 3.29, 0.6, room);

    // poster on left wall
    const poster = R.canvasTex(24, 32, (g, w, h) => {
      g.fillStyle = '#f2d7a6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e57b5f'; g.fillRect(2, 2, w - 4, 18);
      g.fillStyle = '#f7c86b'; g.fillRect(9, 6, 6, 6);
      g.fillStyle = '#4b4876';
      g.fillRect(2, 14, w - 4, 6);
      g.fillRect(4, 12, 4, 2); g.fillRect(14, 11, 6, 3);
      g.fillStyle = '#3a3560';
      g.fillRect(4, 23, 16, 2); g.fillRect(6, 27, 12, 1);
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0), R.texMat(poster));
    pm.position.set(-5.99, 4.3, 1.9); pm.rotation.y = Math.PI / 2; room.add(pm);

    // rug is built in rug.js (it's interactive)
    R.rugTex = rugTex;

    // ---------- string lights along the top of both walls ----------
    R.fairy = [];
    const bulbCols = ['#ffd27a', '#ff9e7a', '#ffe9b0', '#ffb3c1'];
    for (let i = 0; i < 22; i++) {
      const x = -5.8 + i * 0.55, y = 6.0 - Math.sin((i % 6) / 5 * Math.PI) * 0.25;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), R.glow(bulbCols[i % 4]));
      m.position.set(x, y, -4.4); room.add(m); R.fairy.push(m);
    }
    for (let i = 0; i < 15; i++) {
      const z = -4.2 + i * 0.55, y = 6.0 - Math.sin((i % 6) / 5 * Math.PI) * 0.25;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), R.glow(bulbCols[(i + 1) % 4]));
      m.position.set(-5.9, y, z); room.add(m); R.fairy.push(m);
    }
    R.fairy.forEach(m => (m.userData.base = m.material.color.clone()));

    // ---------- lights ----------
    R.hemi = new THREE.HemisphereLight('#b9a8e6', '#3b2a36', 0.9);
    scene.add(R.hemi);
    R.ambient = new THREE.AmbientLight('#ffffff', 0.25);
    scene.add(R.ambient);

    // window light (sun/moon) — shadows from the wall leave a light patch on the floor
    const sun = new THREE.DirectionalLight('#fff1d6', 1.2);
    sun.position.set(-1.0, 8, -12);
    sun.target.position.set(-1.5, 0, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    sun.shadow.bias = -0.002;
    scene.add(sun); scene.add(sun.target);
    R.sun = sun;

    // fairy-light warm fill
    R.fairyLight = new THREE.PointLight('#ffb27a', 6, 14, 1.6);
    R.fairyLight.position.set(-3, 5.6, -2.5);
    scene.add(R.fairyLight);

    return room;
  };

  // Desk lamp is clickable, so it lives here but is wired in main.
  R.buildLamp = function () {
    const lamp = R.group(-3.35, 1.61, -3.95, R.room);
    R.box(0.4, 0.06, 0.4, R.mat(PAL.metal), 0, 0.03, 0, lamp);
    R.box(0.06, 0.9, 0.06, R.mat(PAL.metal), 0, 0.5, 0, lamp);
    const shade = R.box(0.55, 0.3, 0.45, R.mat('#e9b35a'), 0.15, 0.95, 0.1, lamp);
    shade.rotation.z = -0.35;
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), R.glow('#fff2c4'));
    bulb.position.set(0.2, 0.8, 0.1); lamp.add(bulb);
    const light = new THREE.PointLight('#ffc77a', 10, 7, 1.5);
    light.position.set(0.2, 0.6, 0.4); lamp.add(light);
    R.lamp = { group: lamp, light, bulb, on: R.store.get('lampOn', true) };
    const apply = () => {
      light.visible = R.lamp.on;
      bulb.material.color.set(R.lamp.on ? '#fff2c4' : '#5a5560');
    };
    apply();
    R.store.watch('lampOn', v => { R.lamp.on = v !== false; apply(); });
    R.makeClickable(lamp, 'desk lamp', () => {
      R.lamp.on = !R.lamp.on; R.store.set('lampOn', R.lamp.on); apply();
    });
  };
})(window.R);
