// The rug.
//  · click            → a wave sweeps ALL desktop icons under the rug (click again: they hop back out)
//  · drag             → the rug folds back as far as you pull and stays there, showing what's
//                       underneath: the real icons, lying on the floor. Click one to open it.
//  · drop a desktop icon onto the rug → the helper tucks that one file under it (moves it to
//                       %USERPROFILE%\CozyRug). It shows up as a lump; lift the rug and drag it
//                       off to put it back on the desktop.
(function (R) {
  const W = 5.0, D = 3.4, SX = 48, SZ = 32;
  const CENTER = new THREE.Vector3(0.2, 0.035, 0.9);
  const ICON_HOME = new THREE.Vector3(-6.2, 2.8, -0.6);   // rug-local point toward the screen's left edge
  const SPEED = 1 / 1.6;                                   // full sweep in 1.6 s
  const CURL = 0.16;                                       // radius of the fold
  const COLS = 8, ROWS = 4;

  function fallbackTextures() {
    const draw = [
      g => { g.fillStyle = '#f7c86b'; g.fillRect(1, 3, 14, 11); g.fillRect(1, 1, 6, 3); g.fillStyle = '#e0a84a'; g.fillRect(1, 6, 14, 1); },      // folder
      g => { g.fillStyle = '#f4f1ea'; g.fillRect(3, 1, 10, 14); g.fillStyle = '#6aa0a8'; for (let y = 4; y < 13; y += 2) g.fillRect(5, y, 6, 1); }, // doc
      g => { g.fillStyle = '#6a7fd6'; g.fillRect(1, 1, 14, 14); g.fillStyle = '#fff'; g.fillRect(5, 5, 6, 6); g.fillStyle = '#6a7fd6'; g.fillRect(7, 7, 2, 2); }, // app
    ];
    return draw.map(fn => R.canvasTex(16, 16, fn));
  }
  const iconTexCache = {};
  function iconTexture(item, fb) {
    if (!item.icon) return item.isDir ? fb[0] : fb[1];
    if (iconTexCache[item.icon]) return iconTexCache[item.icon];
    const t = R.canvasTex(32, 32, () => {});
    const img = new Image();
    img.onload = () => { t.userData.ctx.drawImage(img, 0, 0, 32, 32); t.needsUpdate = true; };
    img.src = item.icon;
    return (iconTexCache[item.icon] = t);
  }

  R.buildRug = function () {
    const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const base = pos.array.slice();
    const rug = new THREE.Mesh(geo, R.texMat(R.rugTex(), { side: THREE.DoubleSide }));
    rug.position.copy(CENTER);
    rug.castShadow = true; rug.receiveShadow = true;
    R.room.add(rug);
    R.rug = rug;

    // ---------- state ----------
    const S = { hidden: R.store.get('rugHidden', false), peel: 0, peelTarget: null };
    let anim = null;        // hide-all wave: { dir: 'hide'|'show', p, target }
    const fb = fallbackTextures();

    // ---------- what's under the rug ----------
    // stash = single files tucked under (always there); desk = the whole desktop (only while hidden)
    let stash = [], desk = [], deskCount = 5;
    const slots = new Map();            // key -> slot
    function slotXZ(i) {
      const col = Math.floor(i / ROWS), row = i % ROWS;
      return [W / 2 - 0.42 - col * ((W - 0.7) / COLS), -D / 2 + 0.5 + row * ((D - 1.0) / (ROWS - 1))];
    }
    function layout() {
      const items = stash.map(s => Object.assign({ key: 's:' + s.id, kind: 'stash' }, s))
        .concat((desk.length ? desk : Array.from({ length: deskCount }, (_, i) => ({ name: 'icon ' + i, placeholder: true })))
          .map((d, i) => Object.assign({ key: 'd:' + (d.name || i), kind: 'desk' }, d)))
        .slice(0, COLS * ROWS);
      const keep = new Set(items.map(it => it.key));
      for (const [k, s] of slots) if (!keep.has(k)) { rug.remove(s.tile); rug.remove(s.sprite); slots.delete(k); }
      items.forEach((it, i) => {
        let s = slots.get(it.key);
        const [x, z] = slotXZ(i);
        if (!s) {
          const tex = iconTexture(it, fb);
          const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3 }));
          tile.rotation.x = -Math.PI / 2;
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
          sprite.scale.set(0.42, 0.42, 1); sprite.visible = false;
          rug.add(tile); rug.add(sprite);
          s = { gulp: 0, it, tile, sprite, x, z, k: it.kind === 'stash' ? 0 : (S.hidden ? 1 : 0), ph: Math.random() * 6, drag: null };
          slots.set(it.key, s);
          wireTile(s);
        }
        s.it = it; s.x = x; s.z = z;
        s.r = it.kind === 'stash' ? 0.3 : 0.34; s.h = it.kind === 'stash' ? 0.13 : 0.15;
        s.tile.position.set(x, -0.025, z);
      });
    }

    function wireTile(s) {
      const tile = s.tile;
      const name = () => s.it.name;
      if (s.it.kind === 'stash') {
        R.makeClickable(tile, '', () => {});
        tile.userData.label = name() + ' · click: open · drag off the rug: back to desktop';
        tile.userData.onDragStart = () => { s.drag = { x: s.x, z: s.z }; };
        tile.userData.onDrag = (dx, ev) => {
          const p = R.screenToFloor(ev.clientX, ev.clientY);
          if (p) { s.drag.x = p.x - CENTER.x; s.drag.z = p.z - CENTER.z; }
        };
        tile.userData.onDragEnd = (moved) => {
          const d = s.drag; s.drag = null;
          if (!moved) return openItem(s);
          if (d && (Math.abs(d.x) > W / 2 + 0.05 || Math.abs(d.z) > D / 2 + 0.05)) {
            s.leaving = 1;
            R.helper.call(R.helper.q('/rug/restore', { id: s.it.id }))
              .then(() => { R.toast(name() + ' is back on your desktop'); refreshStash(); })
              .catch(e => { s.leaving = 0; R.toast('could not put it back: ' + (e.message || e)); });
          }
        };
      } else {
        R.makeClickable(tile, (s.it.placeholder ? 'desktop icon' : name()) + ' · click to open', () => openItem(s));
      }
    }
    function openItem(s) {
      if (s.it.placeholder) return;
      R.sfx.pop(500);
      const path = s.it.kind === 'stash' ? R.helper.q('/rug/open', { id: s.it.id }) : R.helper.q('/desktop/open', { name: s.it.name });
      R.helper.call(path, 5000).then(() => R.toast('opening ' + s.it.name)).catch(e => R.toast('could not open: ' + (e.message || e)));
    }

    function refreshDesk() {
      return R.helper.call('/desktop/items', 15000).then(j => { desk = j.items || []; layout(); }).catch(() => {});
    }
    let stashSeq = -1, stashLoaded = false;
    function refreshStash() {
      return R.helper.call('/rug/stash', 8000).then(j => {
        const before = new Set(stash.map(s => s.id));
        stash = j.items || [];
        if (j.seq !== stashSeq) {
          if (stashSeq >= 0 && j.msg) R.toast(j.msg);
          stashSeq = j.seq;
        }
        layout();
        if (stashLoaded) stash.filter(s => !before.has(s.id)).forEach(s => { const sl = slots.get('s:' + s.id); if (sl) sl.gulp = 1; });
        stashLoaded = true;
      }).catch(() => {});
    }
    layout();

    // ---------- hide-all (real icons through the helper) ----------
    function setIcons(hide) {
      if (!R.helper.ok) {
        if (!S.warned) { R.toast('start helper/start-helper.cmd to hide your real icons'); S.warned = true; }
        return;
      }
      S.cmdAt = Date.now();
      R.helper.call(hide ? '/icons/hide' : '/icons/show').catch(() => R.toast('helper not responding'));
    }
    function start(dir, fromP = 0) {
      anim = { dir, p: fromP, target: 1 };
      if (dir === 'hide') setIcons(true);
    }
    R.rugToggle = () => {
      if (S.peel > 0.02) { S.peelTarget = 0; return; }     // lifted: first lay it back down
      if (!anim) start(S.hidden ? 'show' : 'hide');
    };

    // ---------- drag = peel ----------
    let p0 = 0;
    rug.userData.onDragStart = () => { p0 = S.peel; S.peelTarget = null; };
    rug.userData.onDrag = dx => {
      if (anim) return;
      // from flat, a pull either way lifts it; once lifted, left lifts more and right lays it down
      S.peel = R.clamp(p0 < 0.02 ? Math.abs(dx) / 0.32 : p0 + dx / 0.32, 0, 1);
    };
    rug.userData.onDragEnd = moved => {
      if (!moved) return R.rugToggle();
      if (S.peel < 0.06) S.peelTarget = 0;
      else if (S.hidden && !desk.length) refreshDesk();
    };
    R.makeClickable(rug, '', () => {});
    const label = () => (rug.userData.label = S.peel > 0.02 ? 'rug · drag back, or click to lay it flat'
      : S.hidden ? 'rug · click: icons back · drag: peek under' : 'rug · click: sweep icons under · drag: lift · drop an icon on it to hide it');
    R.store.watch('rugHidden', v => {
      if (anim || S.hidden === !!v) return;
      S.hidden = !!v; S.cmdAt = Date.now();
      if (S.hidden) refreshDesk(); else layout();
    });
    R.rugPeel = v => { S.peelTarget = v; };              // for tests / demos
    R.rugState = S;

    // keep in sync with the real desktop (e.g. toggled from the right-click menu)
    R.on('helper:state', j => {
      if (!j) return;
      if (j.count != null && j.count !== deskCount) { deskCount = j.count; if (!desk.length) layout(); }
      if (!desk.length || (desk.length !== j.count)) refreshDesk();
      // follow changes made outside the room — but not the echo of our own command
      if (!anim && Date.now() - (S.cmdAt || 0) > 4000 && j.iconsVisible === S.hidden) start(j.iconsVisible ? 'show' : 'hide');
    });
    setInterval(refreshStash, 2500);
    refreshStash();

    // tell the helper where the rug is on screen, so icons dropped on it get tucked under
    function sendArea() {
      if (!R.camera) return;
      const cam = R.camera.clone();
      cam.position.copy(R.CAM_BASE); cam.lookAt(R.LOOK); cam.updateMatrixWorld();
      const dpr = window.devicePixelRatio || 1, inset = 0.92;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
        const v = new THREE.Vector3(CENTER.x + sx * W / 2 * inset, CENTER.y, CENTER.z + sz * D / 2 * inset).project(cam);
        const x = (v.x + 1) / 2 * window.innerWidth, y = (1 - v.y) / 2 * window.innerHeight;
        return Math.round((window.screenX + x) * dpr) + ',' + Math.round((window.screenY + y) * dpr);
      });
      R.helper.call(R.helper.q('/rug/area', { pts: pts.join(';'), id: R.instanceId })).catch(() => {});
    }
    setTimeout(sendArea, 1500);
    setInterval(sendArea, 20000);
    window.addEventListener('resize', () => setTimeout(sendArea, 300));

    // a corner of an icon peeking out from under the front edge when something's under
    const peek = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), R.texMat(fb[0], { transparent: true, alphaTest: 0.5 }));
    peek.rotation.x = -Math.PI / 2; peek.rotation.z = 0.5;
    peek.position.set(-0.6, -0.02, D / 2 + 0.05);
    rug.add(peek);

    const crestAt = p => R.lerp(W / 2 + 1.2, -W / 2 - 1.2, p);
    const hitP = x => (W / 2 + 1.2 - x) / (W + 2.4);
    const foldAt = p => W / 2 - p * 0.72 * W;

    // ---------- per-frame cloth ----------
    let t = 0;
    const tmp = new THREE.Vector3();
    R.tick(dt => {
      t += dt;
      label();
      if (S.peelTarget != null) {
        S.peel = R.damp(S.peel, S.peelTarget, 7, dt);
        if (Math.abs(S.peel - S.peelTarget) < 0.003) { S.peel = S.peelTarget; S.peelTarget = null; }
      }
      let p = 0, dir = S.hidden ? 'show' : 'hide';
      if (anim) {
        const step = dt * SPEED;
        anim.p = anim.target > anim.p ? Math.min(1, anim.p + step) : Math.max(0, anim.p - step);
        p = anim.p; dir = anim.dir;
        if (anim.p === anim.target) {
          S.hidden = anim.dir === 'hide';
          R.store.set('rugHidden', S.hidden);
          if (anim.dir === 'show') setIcons(false);
          else refreshDesk();
          R.toast(S.hidden ? 'icons swept under the rug 🧹' : 'icons are back');
          anim = null; p = 0;
        }
      }
      const cx = crestAt(p);
      const amp = 0.55 * Math.sin(Math.PI * p);
      const xf = foldAt(S.peel);
      const hover = R.hovered === rug && !anim && S.peel < 0.01 ? 1 : 0;
      rug.userData.hoverK = R.damp(rug.userData.hoverK || 0, hover, 8, dt);

      // lumps, tiles and flying icons
      const lumps = [];
      for (const s of slots.values()) {
        if (s.it.kind === 'desk') {
          const passed = p > 0 && cx < s.x;
          const target = p > 0 ? (dir === 'hide' ? +passed : +!passed) : +S.hidden;
          s.k = R.damp(s.k, target, 10, dt);
          const hp = hitP(s.x);
          s.sprite.visible = false;
          if (p > 0 && dir === 'hide' && p < hp) {                // icon flies in, lands as the crest arrives
            const f = R.clamp(p / Math.max(hp, 0.01), 0, 1);
            tmp.set(s.x, 0.2, s.z).lerp(ICON_HOME, 1 - f); tmp.y += Math.sin(f * Math.PI) * 1.0;
            s.sprite.position.copy(tmp); s.sprite.visible = true; s.sprite.material.opacity = 1;
          } else if (p > 0 && dir === 'show' && p > hp) {         // icon hops out toward the screen edge
            const f = R.clamp((p - hp) / 0.4, 0, 1);
            tmp.set(s.x, 0.2, s.z).lerp(ICON_HOME, f); tmp.y += Math.sin(f * Math.PI) * 1.2;
            s.sprite.position.copy(tmp); s.sprite.visible = f < 1; s.sprite.material.opacity = 1 - f * f;
          }
        } else {
          s.k = R.damp(s.k, s.leaving ? 0 : 1, 6, dt);
          if (s.gulp > 0) s.gulp = Math.max(0, s.gulp - dt * 1.5);
        }
        const under = s.k > 0.5;
        const revealed = s.x > xf + 0.25;
        s.tile.visible = under && revealed && !s.leaving;
        if (s.drag) { s.tile.position.set(s.drag.x, 0.15, s.drag.z); s.tile.visible = true; }
        else s.tile.position.set(s.x, -0.025 + (s.leaving ? 0.3 : 0), s.z);
        if (s.k > 0.01 && !revealed) lumps.push(s);
      }

      const a = pos.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i], z = base[i + 2];
        let y = 0, X = x;
        if (x > xf && S.peel > 0.001) {                            // folded back over itself
          const d = x - xf;
          if (d < Math.PI * CURL) { const th = d / CURL; X = xf + CURL * Math.sin(th); y = CURL * (1 - Math.cos(th)); }
          else { X = xf - (d - Math.PI * CURL); y = 2 * CURL + 0.02 * Math.sin(z * 3 + X); }
        } else {
          for (const L of lumps) {
            const d2 = ((x - L.x) ** 2 + (z - L.z) ** 2) / (L.r * L.r);
            if (d2 < 1) y += L.h * L.k * (1 - d2) * (1 - d2) * (1 + 0.08 * Math.sin(t * 2 + L.ph) + L.gulp * 0.6 * Math.sin(L.gulp * 12));
          }
          if (amp > 0) y += amp * Math.exp(-((x - cx) ** 2) / 0.45) * (0.85 + 0.15 * Math.sin(z * 2 + t * 6));
          if (rug.userData.hoverK > 0.01) {                       // front-right corner lifts on hover
            const dc = Math.hypot(x - W / 2, z - D / 2);
            y += rug.userData.hoverK * 0.35 * Math.max(0, 1 - dc / 1.1) ** 2;
          }
        }
        a[i] = X; a[i + 1] = y;
      }
      peek.visible = lumps.length > 0 && S.peel < 0.05;
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    });
  };
})(window.R);
