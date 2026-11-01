// Floor plant that grows when you finish tasks / focus sessions and wilts when neglected.
(function (R) {
  const STAGES = [0, 25, 60, 110, 170, 240];   // growth points per stage
  const DECAY_PER_HOUR = 3;                     // water lost per hour
  const S = R.plantState = Object.assign({ water: 70, growth: 30, t: Date.now() }, R.store.get('plant', {}));

  function decay() {
    const hrs = (Date.now() - S.t) / 3600e3 * (R.debug ? 60 : 1);
    S.water = R.clamp(S.water - hrs * DECAY_PER_HOUR, 0, 100);
    S.t = Date.now();
    R.store.set('plant', S);
  }
  decay();
  R.store.watch('plant', v => Object.assign(S, v));
  const stage = () => STAGES.filter(s => S.growth >= s).length - 1;

  R.buildPlant = function () {
    const g = R.group(-5.0, 0, -3.75, R.room);
    R.box(0.75, 0.65, 0.75, R.mat('#c06a4a'), 0, 0.33, 0, g);
    R.box(0.85, 0.1, 0.85, R.mat('#a95b3e'), 0, 0.65, 0, g);
    R.box(0.65, 0.04, 0.65, R.mat('#3e2a20'), 0, 0.68, 0, g);

    const stemMat = R.mat('#5c8a4a');
    const leafMat = R.mat('#6fae5c');
    const healthy = new THREE.Color('#6fae5c'), dry = new THREE.Color('#b59a4a');
    const stems = [
      { x: 0, z: 0, tilt: 0, lean: 0, max: 2.0 },
      { x: -0.15, z: 0.1, tilt: 0.25, lean: 0.4, max: 1.4 },
      { x: 0.15, z: -0.1, tilt: -0.25, lean: -0.6, max: 1.2 },
    ].map(s => {
      const pivot = R.group(s.x, 0.7, s.z, g);
      pivot.rotation.z = s.tilt; pivot.rotation.x = s.lean * 0.3;
      const stem = R.box(0.06, 1, 0.06, stemMat, 0, 0.5, 0, pivot);
      return Object.assign(s, { pivot, stem, leaves: [] });
    });

    // leaves: deterministic layout, revealed as the plant grows
    const rnd = R.rng(4);
    const allLeaves = [];
    for (let i = 0; i < 16; i++) {
      const s = stems[i % 3];
      const hFrac = 0.25 + (Math.floor(i / 3) / 5) * 0.75;
      const p = R.group(0, 0, 0, s.pivot);
      p.rotation.y = rnd() * Math.PI * 2;
      const leaf = R.box(0.42, 0.04, 0.2, leafMat, 0.22, 0, 0, p);
      allLeaves.push({ s, p, leaf, hFrac, order: i, up: 0.35 + rnd() * 0.3 });
    }
    const flower = R.group(0, 0, 0, stems[0].pivot);
    R.box(0.2, 0.2, 0.2, R.mat('#f6b6c4'), 0, 0.08, 0, flower);
    R.box(0.1, 0.1, 0.1, R.mat('#ffe7a0'), 0, 0.2, 0, flower);

    // water drops
    const drops = Array.from({ length: 8 }, () => {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), R.glow('#8fc8ff'));
      d.visible = false; g.add(d); return d;
    });
    let pour = 0;
    function water(amount, growth) {
      decay();
      S.water = R.clamp(S.water + amount, 0, 100);
      S.growth += growth;
      R.store.set('plant', S);
      pour = 1.4;
    }
    R.on('task:done', () => water(20, 20));
    R.on('focus:done', () => water(30, 35));

    let shownH = [0, 0, 0], decayAcc = 0, tt = 0;
    R.tick(dt => {
      tt += dt;
      decayAcc += dt;
      if (decayAcc > 30) { decayAcc = 0; decay(); }
      const st = stage();
      const wilt = R.clamp((30 - S.water) / 30, 0, 1);   // 0 healthy … 1 fully wilted
      stems.forEach((s, i) => {
        const target = Math.min(s.max, 0.35 + st * 0.33) * (i === 0 ? 1 : 0.8);
        shownH[i] = R.damp(shownH[i], target, 2, dt);
        s.stem.scale.y = shownH[i];
        s.stem.position.y = shownH[i] / 2;
        s.pivot.rotation.z = s.tilt + Math.sign(s.tilt || 1) * wilt * 0.35 + Math.sin(tt * 0.8 + i) * 0.02;
      });
      const visible = 3 + st * 2 + (st >= 5 ? 3 : 0);
      allLeaves.forEach(L => {
        const on = L.order < visible;
        const sc = R.damp(L.leaf.scale.x, on ? 1 : 0.001, 3, dt);
        L.leaf.scale.set(sc, 1, sc);
        L.p.position.y = shownH[stems.indexOf(L.s)] * L.hFrac;
        L.p.rotation.z = R.lerp(L.up, -0.7, wilt);   // droop when thirsty
      });
      leafMat.color.copy(healthy).lerp(dry, wilt);
      flower.visible = st >= 5 && wilt < 0.5;
      flower.position.y = shownH[0];

      if (pour > 0) {
        pour -= dt;
        drops.forEach((d, i) => {
          const p = ((1.4 - pour) * 1.6 + i / drops.length) % 1;
          d.visible = pour > 0.1;
          d.position.set(Math.sin(i * 2.3) * 0.25, 2.6 - p * 1.9, Math.cos(i * 1.7) * 0.25);
        });
      } else drops.forEach(d => (d.visible = false));
    });

    R.makeClickable(g, 'plant', () => {
      decay();
      const st = stage();
      R.toast('plant · stage ' + (st + 1) + '/6 · water ' + Math.round(S.water) + '%' + (S.water < 30 ? ' — thirsty! finish a task' : ''));
    });
  };
})(window.R);
