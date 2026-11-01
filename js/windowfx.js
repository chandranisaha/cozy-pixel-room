// The window opens: click it and the lower sash slides up, letting in sound that matches the
// real weather (rain + thunder, wind, birds by day, crickets and a far-off city at night).
// Drag either curtain to draw it; the room gets darker as they close. Click a curtain to
// open/close both.
(function (R) {
  R.buildWindowFx = function () {
    const Wr = R.windowRect, W = R.weather;
    const cx = (Wr.x0 + Wr.x1) / 2, ww = Wr.x1 - Wr.x0, mid = (Wr.y0 + Wr.y1) / 2 + 0.2;
    const S = { open: R.store.get('winOpen', false), curtain: R.store.get('curtain', 0) };

    // lower sash: a frame with a faint pane of glass that slides up when open
    const sash = R.group(cx, 0, -4.53, R.room);
    const fm = R.mat('#e9dcc6'), h = mid - Wr.y0;
    R.box(ww, 0.08, 0.06, fm, 0, Wr.y0 + 0.04, 0, sash);
    R.box(ww, 0.08, 0.06, fm, 0, mid - 0.04, 0, sash);
    R.box(0.07, h, 0.06, fm, -ww / 2 + 0.035, Wr.y0 + h / 2, 0, sash);
    R.box(0.07, h, 0.06, fm, ww / 2 - 0.035, Wr.y0 + h / 2, 0, sash);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.1, h - 0.1),
      new THREE.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.12, depthWrite: false }));
    glass.position.set(0, Wr.y0 + h / 2, 0.01); sash.add(glass);
    const shine = R.box(0.06, h * 0.7, 0.01, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18 }), -ww / 4, Wr.y0 + h / 2, 0.02, sash);
    shine.rotation.z = 0.5; shine.castShadow = false;
    let slide = S.open ? 1 : 0;
    R.windowState = S;

    // ---------- ambience ----------
    let amb = null, ambKind = '';
    const kindNow = () => {
      if (W.kind === 'rain' || W.kind === 'thunder') return 'rain';
      if (W.kind === 'snow' || W.kind === 'fog') return 'wind';
      return R.night > 0.5 ? 'crickets' : 'birds';
    };
    function updateAmb() {
      const want = S.open && !R.sleeping ? kindNow() : '';
      if (want === ambKind) return;
      if (amb) { const a = amb; R.sfx.fade(a, 0, 1.2); setTimeout(() => a.stop(), 2500); amb = null; }
      ambKind = want;
      if (want) { amb = R.sfx[want](); R.sfx.fade(amb, want === 'rain' ? 0.5 : 0.7, 2); }
      S.ambience = want;
    }
    R.on('thunder', () => { if (S.open) R.sfx.thunder(); });
    R.on('weather', updateAmb);
    R.on('sleep', updateAmb);
    setInterval(updateAmb, 30000);

    function setOpen(o) {
      S.open = o; R.store.set('winOpen', o);
      R.sfx.sash(o);
      updateAmb();
      const wx = (W.temp ? W.temp + ' ' : '') + W.desc;
      R.toast(o ? 'window open · ' + wx + ({ rain: ' · listen to the rain', birds: ' · birds outside', crickets: ' · night sounds', wind: ' · chilly wind' }[ambKind] || '') : 'window closed');
    }
    const plane = R.windowPlane;
    plane.userData.onClick = () => setOpen(!S.open);
    const label = () => (plane.userData.label = (S.open ? 'close window' : 'open window') + ' · ' + (W.temp ? W.temp + ' ' : '') + W.desc + (W.city ? ', ' + W.city : ''));
    R.on('weather', label); label();
    R.store.watch('winOpen', v => { S.open = !!v; slide = S.open ? 1 : 0; updateAmb(); label(); });

    // ---------- curtains ----------
    const [cl, cr] = R.curtains;
    const openW = 0.55, shutW = ww / 2 + 0.75;
    const leftEdge = Wr.x0 - 0.45 - openW / 2, rightEdge = Wr.x1 + 0.45 + openW / 2;
    let c = S.curtain, cTarget = null, c0 = 0, t = 0, swished = 0;
    function place() {
      const w = R.lerp(openW, shutW, c);
      cl.scale.x = cr.scale.x = w / openW;
      cl.position.x = leftEdge + w / 2;
      cr.position.x = rightEdge - w / 2;
      R.curtainK = c;
    }
    place();
    R.store.watch('curtain', v => { c = R.clamp(+v || 0, 0, 1); cTarget = null; place(); });
    [cl, cr].forEach((m, side) => {
      R.makeClickable(m, 'curtain · drag to draw', () => {});
      m.userData.onDragStart = () => { c0 = c; cTarget = null; swished = 0; };
      m.userData.onDrag = dx => {
        const prev = c;
        c = R.clamp(c0 + (side ? dx : -dx) / 0.12, 0, 1); place();
        // a swish for every bit of fabric pulled along the rod
        swished += Math.abs(c - prev);
        if (swished > 0.18) { swished = 0; R.sfx.swish(0.3, 0.22); }
      };
      m.userData.onDragEnd = moved => {
        if (!moved) { cTarget = c > 0.5 ? 0 : 1; R.sfx.swish(0.6, 0.32); }
        R.store.set('curtain', cTarget ?? c);
      };
    });

    R.tick(dt => {
      t += dt;
      slide = R.damp(slide, S.open ? 1 : 0, 4, dt);
      sash.position.y = slide * (h - 0.06);
      sash.position.z = -4.53 + slide * 0.04;
      if (cTarget != null) {
        c = R.damp(c, cTarget, 5, dt); place();
        if (Math.abs(c - cTarget) < 0.002) { c = cTarget; cTarget = null; place(); }
      }
      // a breeze moves the curtains while the window is open
      const breeze = slide * (W.kind === 'rain' || W.kind === 'thunder' ? 0.07 : 0.04);
      cl.rotation.y = Math.sin(t * 1.3) * breeze; cr.rotation.y = Math.sin(t * 1.1 + 1) * breeze;
      cl.position.z = cr.position.z = -4.3 + slide * 0.08 * (0.5 + 0.5 * Math.sin(t * 0.9));
    });
  };
})(window.R);
