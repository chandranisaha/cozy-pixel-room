// Cork board synced with the Windows Sticky Notes app (through the helper, read-only).
// Click a note to open that note in Sticky Notes; click the "+" pad to start a new one.
(function (R) {
  const THEME = {
    Yellow: '#f7e27a', Pink: '#f6b6c4', Green: '#a9dcc8', Purple: '#c9b6ef',
    Blue: '#9fd0f0', Gray: '#d8d4dc', Charcoal: '#5a5560',
  };
  const SLOTS = 6;

  // Sticky Notes stores each paragraph as "\id=<guid>\strike\b text"
  function lines(text) {
    return (text || '').split(/\r?\n/).map(l => {
      const strike = /^(\\id=[0-9a-f-]+)?(\\[a-z]+\d*)*\\strike(?!0)/.test(l);
      l = l.replace(/^\\id=[0-9a-f-]+/, '').replace(/\\[a-z]+\d*/g, '').replace(/^ /, '');
      return { t: l.trim(), strike };
    }).filter(x => x.t);
  }

  function noteTexture(note) {
    const [c, g] = R.canvas(40, 40);
    const bg = note.plus ? '#efe7d6' : (THEME[note.theme] || THEME.Yellow);
    g.fillStyle = bg; g.fillRect(0, 0, 40, 40);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 40, 4);
    if (note.plus) {
      g.fillStyle = '#8a8496'; g.fillRect(18, 10, 4, 20); g.fillRect(10, 18, 20, 4);
      g.font = '6px monospace'; g.fillText('new', 14, 37);
    } else {
      const ink = note.theme === 'Charcoal' ? '#f4efe4' : '#3a3560';
      g.fillStyle = ink; g.strokeStyle = ink;
      g.font = 'bold 7px monospace';
      lines(note.text).slice(0, 4).forEach((ln, k) => {
        const s = ln.t.slice(0, 10), y = 13 + k * 8;
        g.fillText(s, 3, y);
        if (ln.strike) g.fillRect(3, y - 3, Math.min(34, s.length * 4.2), 1);
      });
    }
    return R.nearest(new THREE.CanvasTexture(c));
  }

  R.buildStickies = function () {
    const board = R.group(1.17, 3.85, -4.47, R.room);
    R.box(1.45, 2.1, 0.05, R.mat('#b88a5c'), 0, 0, 0, board);                 // frame
    R.box(1.33, 1.98, 0.06, R.texMat(R.canvasTex(16, 16, g => {               // cork
      const rnd = R.rng(4); g.fillStyle = '#c99b68'; g.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 40; i++) { g.fillStyle = rnd() < 0.5 ? '#b5875a' : '#d8ab78'; g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
    })), 0, 0, 0.01, board);

    const slots = [];
    const rnd = R.rng(17);
    for (let i = 0; i < SLOTS; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), R.texMat(noteTexture({ plus: true })));
      mesh.position.set(i % 2 ? 0.32 : -0.32, 0.66 - Math.floor(i / 2) * 0.66, 0.05 + i * 0.002);
      mesh.rotation.z = (rnd() - 0.5) * 0.18;
      mesh.userData.baseRot = mesh.rotation.z;
      mesh.userData.wob = 0;
      board.add(mesh);
      const pin = R.box(0.07, 0.07, 0.05, R.mat(['#d0565b', '#6aa0a8', '#f7c86b'][i % 3]), mesh.position.x, mesh.position.y + 0.22, 0.08, board);
      slots.push({ mesh, pin, note: null });
      R.makeClickable(mesh, '', () => {
        mesh.userData.wob = 0.6;
        const s = slots[i];
        if (!R.helper.ok) return R.toast('start the helper to sync with Sticky Notes');
        if (s.note && s.note.plus) {
          R.toast('new sticky note ✎');
          R.helper.call('/notes/new', 15000).then(j => { if (!j.created) R.toast('Sticky Notes opened, but the new-note button wasn\'t found'); setTimeout(refresh, 4000); }).catch(e => R.toast('could not open Sticky Notes'));
        } else if (s.note) {
          R.toast('opening note…');
          R.helper.call(R.helper.q('/notes/open', { id: s.note.id }), 15000).catch(() => R.toast('could not open Sticky Notes'));
        }
      });
    }

    let sig = '';
    function show(notes, extra) {
      const items = notes.slice(0, SLOTS - 1).concat([{ plus: true }]);
      const nextSig = JSON.stringify(items.map(n => [n.id, n.text, n.theme]));
      if (nextSig === sig) return;
      sig = nextSig;
      slots.forEach((s, i) => {
        const n = items[i] || null;
        s.note = n;
        s.mesh.visible = s.pin.visible = !!n;
        if (!n) return;
        s.mesh.material.map.dispose();
        s.mesh.material.map = noteTexture(n); s.mesh.material.needsUpdate = true;
        const first = n.plus ? '' : (lines(n.text)[0] || { t: '' }).t;
        s.mesh.userData.label = n.plus ? 'new sticky note' : '📝 ' + first.slice(0, 40) + (extra && i === SLOTS - 2 ? ' (+' + extra + ' more)' : '');
      });
    }
    function refresh() {
      R.helper.call('/notes', 8000)
        .then(j => { const ns = j.notes || []; show(ns, Math.max(0, ns.length - (SLOTS - 1))); })
        .catch(() => { if (!sig) show([{ id: 'x', theme: 'Yellow', text: 'your sticky\nnotes show\nup here' }]); });
    }
    refresh();
    setInterval(refresh, 15000);
    R.on('helper:state', () => { if (!sig || sig.includes('"x"')) refresh(); });

    R.tick(dt => slots.forEach(s => {
      const u = s.mesh.userData;
      if (u.wob > 0) { u.wob -= dt; s.mesh.rotation.z = u.baseRot + Math.sin(u.wob * 30) * u.wob * 0.3; }
      s.mesh.position.z = R.damp(s.mesh.position.z, R.hovered === s.mesh ? 0.12 : 0.05, 10, dt);
    }));
  };
})(window.R);
