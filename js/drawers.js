// The desk drawers. Top: memories, a photo from your shared Google Photos album pops out as a
// polaroid you can flip through. Bottom: the cat-treat tin; it rattles and the cat gets a treat.
(function (R) {
  const OUT = 0.42;    // how far a drawer slides out

  function makeDrawer(y) {
    const d = R.group(1.3, y, 0.6, R.deskGroup);
    const front = R.mat('#b07a4e'), wood = R.mat('#8a5c3a'), inner = R.mat('#6a4a30');
    R.box(0.82, 0.36, 0.06, front, 0, 0, 0.04, d);
    R.box(0.36, 0.05, 0.05, R.mat('#d8b07a'), 0, 0.03, 0.1, d);
    R.box(0.76, 0.03, 0.55, inner, 0, -0.15, -0.26, d);
    R.box(0.03, 0.26, 0.55, wood, -0.37, -0.03, -0.26, d);
    R.box(0.03, 0.26, 0.55, wood, 0.37, -0.03, -0.26, d);
    R.box(0.76, 0.26, 0.03, wood, 0, -0.03, -0.52, d);
    d.userData.k = 0; d.userData.open = false;
    return d;
  }
  function setOpen(d, o) {
    if (d.userData.open === o) return;
    d.userData.open = o;
    R.sfx.drawer(o);
  }

  // ---------- top: memories ----------
  let shown = 0;
  function memoryPicture() {
    const list = R.photos.list;
    if (list.length) return { src: list[shown % list.length], real: true };
    return { src: R.placeholderPicture(shown).toDataURL(), real: false };
  }
  function polaroidTex(src, done) {
    const img = new Image();
    img.onload = () => {
      const [c, g] = R.canvas(40, 48);
      g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, 40, 48);
      const s = Math.min(img.width, img.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 4, 4, 32, 32);
      done(R.nearest(new THREE.CanvasTexture(c)));
    };
    img.src = src;
  }

  function openMemories(drawer, pol) {
    const show = () => {
      const p = memoryPicture();
      polaroidTex(p.src, t => { pol.material.map && pol.material.map.dispose(); pol.material.map = t; pol.material.needsUpdate = true; });
      R.panel('memories 📷', body => {
        body.append(R.el('img', { src: p.src, cls: 'memory' + (p.real ? '' : ' pixel') }));
        if (!p.real) body.append(R.el('p', { cls: 'dim', text: R.photos.loading ? 'fetching your album…'
          : R.photos.error ? 'album: ' + R.photos.error
          : 'share an album in Google Photos ("anyone with the link"), then paste the link into Customise → photos album.' }));
        const row = R.el('div', { cls: 'prow' });
        if (R.photos.list.length > 1) row.append(R.el('button', { text: '↻ another one', onclick: () => { shown++; R.sfx.swish(0.2, 0.15, false); show(); } }),
          R.el('small', { cls: 'dim', text: (shown % R.photos.list.length + 1) + ' / ' + R.photos.list.length }));
        row.append(R.el('button', { text: 'close the drawer', onclick: () => R.closePanel() }));
        body.append(row);
      });
    };
    show();
  }

  // ---------- bottom: cat treats ----------
  function tinTexture() {
    return R.canvasTex(16, 16, g => {
      g.fillStyle = '#c9d3dc'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#e8607a'; g.fillRect(0, 5, 16, 6);
      g.fillStyle = '#fff3d6';                     // a little fish
      g.fillRect(4, 7, 6, 2); g.fillRect(5, 6, 4, 4); g.fillRect(10, 6, 1, 4); g.fillRect(11, 5, 1, 6);
      g.fillStyle = '#3a3560'; g.fillRect(5, 7, 1, 1);
    });
  }

  R.buildDrawers = function () {
    const top = makeDrawer(1.22), bottom = makeDrawer(0.8);

    const pol = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
    pol.position.set(0, -0.12, -0.25); pol.rotation.x = -Math.PI / 2; pol.visible = false; top.add(pol);
    let polUp = 0;

    const tinSide = R.mat('#c9d3dc'), tinTex = R.texMat(tinTexture());
    const tin = R.box(0.3, 0.2, 0.3, [tinSide, tinSide, R.mat('#e8607a'), tinSide, tinTex, tinSide], 0, -0.03, -0.24, bottom);
    let shake = 0, busy = false;

    R.makeClickable(top, 'top drawer · memories', () => {
      if (top.userData.open) { R.closePanel(); return; }
      setOpen(top, true);
      pol.visible = true;
      setTimeout(() => openMemories(top, pol), 450);
    });
    R.on('panel:close', () => { if (top.userData.open) setTimeout(() => setOpen(top, false), 250); });

    R.makeClickable(bottom, 'bottom drawer · cat treats', () => {
      if (busy) return;
      busy = true;
      setOpen(bottom, true);
      setTimeout(() => { shake = 0.8; R.sfx.rattle(); }, 400);
      setTimeout(() => {
        R.emit('cat:treat', tin.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)));
      }, 1100);
      setTimeout(() => { setOpen(bottom, false); busy = false; }, 3200);
    });

    R.tick((dt, t) => {
      [top, bottom].forEach(d => {
        d.userData.k = R.damp(d.userData.k, d.userData.open ? 1 : 0, 9, dt);
        d.position.z = 0.6 + d.userData.k * OUT;
      });
      // the polaroid rises out of the open drawer and leans toward you
      polUp = R.damp(polUp, top.userData.open ? 1 : 0, 6, dt);
      pol.position.y = -0.12 + polUp * 0.45;
      pol.rotation.x = -Math.PI / 2 + polUp * 1.25;
      pol.rotation.z = Math.sin(t * 1.5) * 0.05 * polUp;
      pol.visible = polUp > 0.02;
      if (shake > 0) { shake -= dt; tin.rotation.z = Math.sin(shake * 45) * 0.25; tin.position.y = -0.03 + Math.abs(Math.sin(shake * 30)) * 0.05; }
      else { tin.rotation.z = 0; tin.position.y = -0.03; }
    });
  };
})(window.R);
