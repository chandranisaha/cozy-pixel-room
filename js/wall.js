// Wire wall grid above the bed: polaroids, photos and sticky notes. Click to open.
(function (R) {
  const SCENES = [
    // tiny procedural placeholder pictures (32x32)
    (g) => { grad(g, '#ffb38a', '#e8607a'); disc(g, 16, 18, 6, '#ffe7a0'); g.fillStyle = '#5a4b8a'; g.fillRect(0, 20, 32, 12); g.fillStyle = '#ffd0a0'; for (let i = 0; i < 5; i++) g.fillRect(10 + i * 2, 22 + i * 2, 12 - i * 4 > 0 ? 12 - i * 4 : 1, 1); },
    (g) => { grad(g, '#8ec9ea', '#d9f0f7'); tri(g, 4, 26, 12, '#5d6f8f'); tri(g, 18, 26, 14, '#4a5a78'); g.fillStyle = '#eef'; g.fillRect(11, 15, 2, 1); g.fillRect(17, 13, 3, 1); g.fillStyle = '#6f9e5a'; g.fillRect(0, 26, 32, 6); },
    (g) => { grad(g, '#0b0d2a', '#2b2560'); const r = R.rng(5); g.fillStyle = '#fff6d0'; for (let i = 0; i < 25; i++) g.fillRect(Math.floor(r() * 32), Math.floor(r() * 28), 1, 1); disc(g, 22, 9, 4, '#f1ecd2'); disc(g, 24, 8, 3, '#141a40'); },
    (g) => { g.fillStyle = '#f2d7a6'; g.fillRect(0, 0, 32, 32); catFace(g); },
    (g) => { g.fillStyle = '#a9dcc8'; g.fillRect(0, 0, 32, 32); flower(g, 9, 14, '#f6b6c4'); flower(g, 20, 10, '#f7e27a'); flower(g, 24, 20, '#e8607a'); g.fillStyle = '#5e8c5a'; g.fillRect(0, 28, 32, 4); },
    (g) => { grad(g, '#1a1838', '#3c3478'); const r = R.rng(9); for (let x = 0; x < 32;) { const w = 3 + Math.floor(r() * 5), h = 8 + Math.floor(r() * 16); g.fillStyle = '#121030'; g.fillRect(x, 32 - h, w, h); g.fillStyle = '#ffd27a'; for (let y = 32 - h + 2; y < 31; y += 3) if (r() < .5) g.fillRect(x + 1, y, 1, 1); x += w; } },
  ];
  function grad(g, a, b) { for (let y = 0; y < 32; y += 2) { g.fillStyle = mix(a, b, y / 32); g.fillRect(0, y, 32, 2); } }
  function mix(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1); }
  function tri(g, x, base, h, c) { g.fillStyle = c; for (let i = 0; i < h; i++) g.fillRect(x + i, base - i, (h - i) * 2, 1); }
  function flower(g, x, y, c) { g.fillStyle = '#5e8c5a'; g.fillRect(x, y + 2, 1, 32 - y); disc(g, x, y, 2, c); g.fillStyle = '#ffe7a0'; g.fillRect(x, y, 1, 1); }
  function catFace(g) {
    g.fillStyle = '#e39a5a';
    g.fillRect(8, 10, 16, 14); g.fillRect(8, 6, 4, 4); g.fillRect(20, 6, 4, 4);
    g.fillStyle = '#3a3560'; g.fillRect(12, 15, 2, 2); g.fillRect(18, 15, 2, 2);
    g.fillStyle = '#e8607a'; g.fillRect(15, 18, 2, 1);
    g.fillStyle = '#fff'; g.fillRect(4, 18, 4, 1); g.fillRect(24, 18, 4, 1);
  }

  R.placeholderPicture = i => pictureCanvas(i);
  function pictureCanvas(i) {
    const [c, g] = R.canvas(32, 32);
    SCENES[i % SCENES.length](g);
    return c;
  }

  // Composite an item onto a small canvas (polaroid frame / note paper).
  function itemTexture(item, picture) {
    const isPol = item.type === 'polaroid';
    const W = 40, H = isPol ? 48 : 40;
    const [c, g] = R.canvas(W, H);
    if (item.type === 'note') {
      g.fillStyle = item.color || '#f7e27a'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, 4);
      g.fillStyle = '#3a3560';
      g.font = 'bold 7px monospace';
      (item.text || '').split('\n').slice(0, 4).forEach((ln, k) => g.fillText(ln.slice(0, 10), 3, 13 + k * 8));
    } else if (isPol) {
      g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, W, H);
      g.drawImage(picture, 4, 4, 32, 32);
      g.fillStyle = '#8a8496'; g.font = '6px monospace';
      g.fillText((item.caption || '').slice(0, 9), 4, 44);
    } else {
      g.drawImage(picture, 0, 0, W, H);
      g.strokeStyle = '#2c2a3a'; g.strokeRect(0.5, 0.5, W - 1, H - 1);
    }
    const t = R.nearest(new THREE.CanvasTexture(c));
    return { tex: t, aspect: W / H };
  }

  // Load a real photo into a 32x32 pixelated picture canvas (cover crop).
  function photoCanvas(src, ok) {
    const img = new Image();
    img.onload = () => {
      const [c, g] = R.canvas(32, 32);
      g.imageSmoothingEnabled = true;
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 32, 32);
      ok(c, img);
    };
    img.src = R.asset(src);
  }

  R.buildWall = function () {
    const items = (window.ROOM_ASSETS && window.ROOM_ASSETS.wall) || [];
    const notes = R.store.get('notes', {});
    const wall = R.group(3.7, 3.95, -4.47, R.room);

    // wire grid
    const wire = R.mat('#2c2a3a');
    for (let i = 0; i <= 6; i++) R.box(0.025, 3.3, 0.02, wire, -1.65 + i * 0.55, 0, 0, wall).castShadow = false;
    for (let j = 0; j <= 6; j++) R.box(3.3, 0.025, 0.02, wire, 0, -1.65 + j * 0.55, 0, wall).castShadow = false;

    const rnd = R.rng(21);
    const albumSlots = [];     // empty photo slots get filled from the shared album
    R.on('photos', () => albumSlots.forEach((fill, k) => fill(R.photos.list[k] || null)));
    items.slice(0, 9).forEach((item, i) => {
      item = Object.assign({}, item);
      if (item.type === 'note' && notes[i] != null) item.text = notes[i];
      if (item.type === 'note') R.store.watch('notes', v => { if (v && v[i] != null && v[i] !== item.text) { notes[i] = item.text = v[i]; redraw(); } });
      const col = i % 3, row = Math.floor(i / 3);
      let pic = pictureCanvas(i), full = null;
      const { tex, aspect } = itemTexture(item, pic);
      const h = item.type === 'polaroid' ? 0.95 : 0.8;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), R.texMat(tex));
      mesh.position.set(-1.1 + col * 1.1, 1.05 - row * 1.08, 0.04 + i * 0.002);
      mesh.rotation.z = (rnd() - 0.5) * 0.22;
      mesh.receiveShadow = true;
      wall.add(mesh);
      // clip / pin
      R.box(0.1, 0.12, 0.04, R.mat(['#d0565b', '#f7c86b', '#6aa0a8'][i % 3]), mesh.position.x, mesh.position.y + h / 2 - 0.02, 0.07, wall);

      const redraw = () => {
        const n = itemTexture(item, pic);
        mesh.material.map.dispose(); mesh.material.map = n.tex; mesh.material.needsUpdate = true;
      };
      if (item.src) photoCanvas(item.src, (c, img) => { pic = c; full = img; redraw(); });
      else if (item.type !== 'note') albumSlots.push((src) => {
        if (src) photoCanvas(src, (c, img) => { pic = c; full = img; redraw(); });
        else { pic = pictureCanvas(i); full = null; redraw(); }
      });

      const baseRot = mesh.rotation.z;
      let wob = 0;
      R.tick(dt => { if (wob > 0) { wob -= dt; mesh.rotation.z = baseRot + Math.sin(wob * 30) * wob * 0.3; } });

      R.makeClickable(mesh, item.type === 'note' ? 'note' : (item.caption || 'photo'), () => {
        wob = 0.6;
        R.openLightbox({
          item, picture: full ? full.src : pic.toDataURL(),
          onSave: text => { item.text = text; notes[i] = text; R.store.set('notes', notes); redraw(); },
        });
      });
    });
  };

  // ---------- lightbox ----------
  R.openLightbox = function ({ item, picture, onSave }) {
    const lb = document.getElementById('lightbox');
    const img = lb.querySelector('img'), cap = lb.querySelector('.cap'), ta = lb.querySelector('textarea');
    const paper = lb.querySelector('.paper');
    paper.className = 'paper ' + item.type;
    if (item.type === 'note') {
      img.hidden = true; cap.hidden = true; ta.hidden = false;
      ta.value = item.text || '';
      paper.style.background = item.color || '#f7e27a';
      ta.oninput = () => onSave(ta.value);
      setTimeout(() => ta.focus(), 50);
    } else {
      paper.style.background = '';
      ta.hidden = true; img.hidden = false; cap.hidden = !item.caption;
      img.src = picture; cap.textContent = item.caption || '';
      img.classList.toggle('pixel', !item.src && picture.startsWith('data:image/png'));   // placeholder art
    }
    R.openLightbox_(lb);
  };
})(window.R);
