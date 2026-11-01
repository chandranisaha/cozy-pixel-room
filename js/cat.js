// The cat on the bed. Mood follows your productivity; click it to launch Claude, or to wake
// it up when it's asleep. It talks in little speech bubbles.
//   happy    — recent task/focus, a focus session is running, or it just had a treat
//   idle     — a while since you did something
//   sleeping — curled up: late night (00:00–06:00), wind-down, or a nap halfway to angry
//   angry    — nothing done for cfg.angryAfterMin minutes
(function (R) {
  const SYMBOLS = {
    heart: (g) => { g.fillStyle = '#ff7a9a'; [[1, 0, 2], [5, 0, 2], [0, 1, 8], [0, 2, 8], [1, 3, 6], [2, 4, 4], [3, 5, 2]].forEach(([x, y, w]) => g.fillRect(x + 4, y + 5, w, 1)); },
    z: (g) => { g.fillStyle = '#e6e9ff'; g.fillRect(4, 4, 7, 1); g.fillRect(9, 5, 1, 1); g.fillRect(8, 6, 1, 1); g.fillRect(7, 7, 1, 1); g.fillRect(6, 8, 1, 1); g.fillRect(5, 9, 1, 1); g.fillRect(4, 10, 7, 1); },
    angry: (g) => { g.fillStyle = '#ff4a4a'; g.fillRect(7, 2, 2, 8); g.fillRect(7, 12, 2, 2); g.fillStyle = '#ffd04a'; g.fillRect(2, 4, 2, 2); g.fillRect(12, 6, 2, 2); g.fillRect(3, 11, 2, 1); },
    alert: (g) => { g.fillStyle = '#fff3d6'; g.fillRect(2, 2, 12, 11); g.fillRect(4, 13, 3, 2); g.fillStyle = '#d0565b'; g.fillRect(7, 4, 2, 5); g.fillRect(7, 10, 2, 2); },
    meow: (g) => { g.fillStyle = '#fff3d6'; g.fillRect(1, 3, 14, 9); g.fillRect(3, 12, 3, 2); g.fillStyle = '#3a3560'; g.fillRect(3, 6, 1, 3); g.fillRect(5, 6, 1, 3); g.fillRect(4, 6, 1, 1); g.fillRect(7, 6, 2, 3); g.fillRect(10, 6, 2, 3); g.fillRect(13, 6, 1, 3); g.fillRect(12, 8, 1, 1); g.fillRect(14, 8, 1, 1); },
  };
  const EYES = {
    open: (g) => { g.fillStyle = '#2c2a3a'; g.fillRect(2, 2, 3, 3); g.fillRect(11, 2, 3, 3); g.fillStyle = '#fff'; g.fillRect(3, 2, 1, 1); g.fillRect(12, 2, 1, 1); },
    happy: (g) => { g.fillStyle = '#2c2a3a'; g.fillRect(2, 3, 1, 1); g.fillRect(3, 2, 1, 1); g.fillRect(4, 3, 1, 1); g.fillRect(11, 3, 1, 1); g.fillRect(12, 2, 1, 1); g.fillRect(13, 3, 1, 1); },
    closed: (g) => { g.fillStyle = '#2c2a3a'; g.fillRect(2, 3, 3, 1); g.fillRect(11, 3, 3, 1); },
    angry: (g) => { g.fillStyle = '#c22'; g.fillRect(2, 3, 3, 2); g.fillRect(11, 3, 3, 2); g.fillStyle = '#2c2a3a'; g.fillRect(1, 1, 2, 1); g.fillRect(3, 2, 2, 1); g.fillRect(13, 1, 2, 1); g.fillRect(11, 2, 2, 1); },
  };
  const tex = (fn, w, h) => R.canvasTex(w, h, fn);

  R.cat = { mood: 'idle' };
  let awakeUntil = 0, treatAt = 0;

  function computeMood() {
    const forced = R.params.get('mood');
    if (forced) return forced;
    const now = Date.now(), awake = now < awakeUntil;
    if (now - treatAt < R.min(10)) return 'happy';
    if (R.sleeping && !awake) return 'sleeping';
    if (R.pomo.mode === 'focus' && !R.pomo.pausedLeft) return 'happy';
    const h = new Date().getHours();
    if (h < 6 && !awake) return 'sleeping';
    const mins = (now - R.prod.last) / R.min(1), angryAt = +R.cfg.angryAfterMin;
    if (mins < 30) return 'happy';
    if (mins < angryAt) return mins >= Math.max(40, angryAt * 0.5) && !awake ? 'sleeping' : 'idle';
    return 'angry';
  }

  // ---------- speech bubbles ----------
  const LINES = {
    wake: ['mrrp… you woke me up', '*yawn* five more minutes?', 'oh. it\'s you. hi', 'i was dreaming about fish', '*stretches* …ok i\'m up'],
    happy: ['you\'re doing great :)', 'purr-ductive!', 'proud of you', 'keep going, human'],
    idle: ['drink some water?', 'stretch break?', 'pet me?', 'what are we doing today?', 'the plant looks thirsty'],
    angry: ['hey. HEY. do a task.', 'i\'m judging you', 'the tasks won\'t do themselves', 'hmph.'],
    task: ['nice one!', 'crumple! into the bin it goes', 'one less thing ✓'],
    treat: ['nom nom nom', 'TREATS!! ♥', 'you\'re my favourite human', '*crunch crunch*'],
    pet: ['purrrr ♥', 'mmm right there', 'more pets pls'],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let sayEl = null, sayUntil = 0;
  R.catSay = (text, sec = 3.5) => {
    if (!sayEl) { sayEl = R.el('div', { id: 'catSay', cls: 'px' }); document.body.append(sayEl); }
    sayEl.textContent = text; sayEl.hidden = false; sayUntil = performance.now() + sec * 1000;
  };

  // Prefer the local helper (launches the Claude app directly); fall back to the URL/protocol.
  function launchClaude() {
    const url = (R.cfg.catUrl || 'claude://').trim();
    const fallback = () => {
      try {
        if (/^https?:/.test(url)) window.open(url, '_blank');
        else window.location.href = url;     // custom protocol → OS opens the Claude app
      } catch (e) { R.toast('could not open ' + url); }
    };
    if (url === 'claude://') R.helper.call('/launch/claude').catch(fallback);
    else fallback();
  }

  R.buildCat = function () {
    const cat = R.group(2.9, 1.01, -2.0, R.room);
    cat.rotation.y = 0.45;
    cat.scale.setScalar(1.35);
    const fur = R.mat('#e39a5a'), furDark = R.mat('#c57a3e'), pink = R.mat('#f2a6a6'), white = R.mat('#f6eee2');
    const bodyTex = tex((g) => { g.fillStyle = '#e39a5a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#c57a3e'; for (let i = 1; i < 16; i += 4) g.fillRect(i, 0, 2, 16); }, 16, 16);

    const body = R.group(0, 0, 0, cat);
    const torso = R.box(0.48, 0.42, 0.78, R.texMat(bodyTex), 0, 0.36, 0, body);
    R.box(0.36, 0.2, 0.3, white, 0, 0.3, 0.3, body);
    const legs = [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]].map(([x, z]) => R.box(0.13, 0.2, 0.13, fur, x, 0.1, z, body));
    legs.forEach(l => (l.userData.y = l.position.y));

    const head = R.group(0, 0.62, 0.42, body);
    R.box(0.46, 0.38, 0.38, fur, 0, 0, 0, head);
    R.box(0.2, 0.1, 0.05, white, 0, -0.1, 0.2, head);
    R.box(0.05, 0.04, 0.03, pink, 0, -0.05, 0.215, head);
    const earL = R.group(-0.14, 0.19, 0, head), earR = R.group(0.14, 0.19, 0, head);
    R.box(0.13, 0.15, 0.08, furDark, 0, 0.07, 0, earL); R.box(0.13, 0.15, 0.08, furDark, 0, 0.07, 0, earR);
    const eyeTex = {}; Object.keys(EYES).forEach(k => (eyeTex[k] = tex(EYES[k], 16, 6)));
    const eyes = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshBasicMaterial({ map: eyeTex.open, transparent: true, alphaTest: 0.5 }));
    eyes.position.set(0, 0.04, 0.195); head.add(eyes);

    // tail: chain of segments
    const tail = R.group(0, 0.45, -0.38, body);
    let parent = tail; const segs = [];
    for (let i = 0; i < 4; i++) {
      const p = R.group(0, i ? 0.17 : 0, 0, parent);
      R.box(0.09, 0.18, 0.09, i === 3 ? furDark : fur, 0, 0.09, 0, p);
      segs.push(p); parent = p;
    }

    // mood bubble
    const symTex = {}; Object.keys(SYMBOLS).forEach(k => (symTex[k] = tex(SYMBOLS[k], 16, 16)));
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: symTex.heart, transparent: true, opacity: 0 }));
    bubble.scale.set(0.45, 0.45, 1);
    cat.add(bubble);

    let mood = computeMood(), t = 0, blink = 0, meow = 0, jump = 0, moodAcc = 0, baseY = 0, pet = 0, alert = 0, purr = null;
    let chatIn = 120 + Math.random() * 180, saidPet = false, munch = 0;
    R.on('cat:alert', () => { alert = 6; jump = 1; if (mood !== 'sleeping') R.catSay('psst. there\'s a letter for you'); });
    R.cat.mood = mood;
    R.on('task:done', () => { mood = computeMood(); if (mood !== 'sleeping' && Math.random() < 0.5) R.catSay(pick(LINES.task)); });
    R.on('focus:start', () => (mood = computeMood()));
    R.on('sleep', on => { if (on) { awakeUntil = 0; mood = computeMood(); R.cat.mood = mood; } });   // bedtime beats a recent wake-up

    function wake() {
      awakeUntil = Date.now() + R.min(R.sleeping ? 2 : 20);
      mood = computeMood(); R.cat.mood = mood;
      jump = 0.6; meow = 1.6;
      R.sfx.meow(true);
      R.catSay(pick(LINES.wake));
    }

    // treats from the bottom desk drawer fly over to the cat
    const fishTex = tex(g => { g.fillStyle = '#f4a259'; g.fillRect(3, 6, 7, 4); g.fillRect(4, 5, 5, 6); g.fillRect(10, 5, 1, 6); g.fillRect(11, 4, 1, 8); g.fillStyle = '#3a3560'; g.fillRect(4, 7, 1, 1); }, 16, 16);
    const treats = [];
    R.on('cat:treat', from => {
      if (mood === 'sleeping') { awakeUntil = Date.now() + R.min(20); R.sfx.meow(false); }
      R.catSay('!! was that the treat tin?', 1.2);
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fishTex, transparent: true }));
        sp.scale.set(0.22, 0.22, 1); sp.visible = false; R.room.add(sp);
        treats.push({ sp, from: from.clone(), t: -i * 0.18 });
      }
      jump = 1;
    });

    R.tick(dt => {
      t += dt; moodAcc += dt;
      if (moodAcc > 2) { moodAcc = 0; const m = computeMood(); if (m !== mood) { mood = m; R.cat.mood = m; } }
      // petting: wiggle the mouse over the cat
      if (R.hovered === cat) pet = Math.min(1.5, pet + (R.mouseTravel || 0) * 0.0025);
      pet = Math.max(0, pet - dt * 0.35);
      const petted = pet > 0.35;
      R.cat.pet = pet;
      if (petted && !purr) { purr = R.sfx.purr(); R.sfx.fade(purr, 0.5, 0.6); }
      if (purr) {
        R.sfx.fade(purr, petted ? 0.25 + 0.3 * Math.min(1, pet) : 0, 0.5);
        if (pet < 0.05) { const p = purr; setTimeout(() => p.stop(), 1500); purr = null; }
      }
      if (alert > 0) alert -= dt;
      if (petted && !saidPet) { saidPet = true; R.catSay(pick(LINES.pet), 2.5); }
      if (pet < 0.05) saidPet = false;

      // treats in flight → land in the cat's mouth
      const mouth = head.getWorldPosition(new THREE.Vector3());
      for (let k = treats.length - 1; k >= 0; k--) {
        const f = treats[k];
        f.t += dt / 0.9;
        if (f.t < 0) continue;
        const p = Math.min(1, f.t);
        f.sp.visible = true;
        f.sp.position.lerpVectors(f.from, mouth, p);
        f.sp.position.y += Math.sin(p * Math.PI) * 1.6;
        f.sp.material.rotation += dt * 8;
        if (p >= 1) {
          R.room.remove(f.sp); treats.splice(k, 1);
          if (!treats.length) {
            treatAt = Date.now(); mood = computeMood(); R.cat.mood = mood;
            munch = 1.2; R.sfx.crunch(); R.sfx.meow(false);
            setTimeout(() => R.catSay(pick(LINES.treat)), 300);
          }
        }
      }
      if (munch > 0) munch -= dt;

      // now and then it says something about how you're doing
      chatIn -= dt;
      if (chatIn < 0) {
        chatIn = 240 + Math.random() * 360;
        if (mood !== 'sleeping' && !R.panelOpen) R.catSay(pick(LINES[mood] || LINES.idle), 4);
      }
      if (sayEl && !sayEl.hidden) {
        if (performance.now() > sayUntil) sayEl.hidden = true;
        else {
          const v = mouth.clone().add(new THREE.Vector3(0, 0.9, 0)).project(R.camera);
          sayEl.style.left = ((v.x + 1) / 2 * window.innerWidth) + 'px';
          sayEl.style.top = ((1 - v.y) / 2 * window.innerHeight) + 'px';
        }
      }

      const sleeping = mood === 'sleeping' && !petted, angry = mood === 'angry' && !petted, happy = mood === 'happy' || petted;

      // posture
      baseY = R.damp(baseY, sleeping ? -0.12 : 0, 4, dt);
      body.position.y = baseY + (jump > 0 ? Math.sin(jump * Math.PI) * 0.35 : 0);
      if (jump > 0) jump = Math.max(0, jump - dt * 2.2);
      // asleep it curls into a ball: head tucked round to one side, tail wrapped toward it
      head.position.y = R.damp(head.position.y, sleeping ? 0.24 : 0.62 + (munch > 0 ? Math.abs(Math.sin(t * 14)) * -0.06 : 0), 4, dt);
      head.position.x = R.damp(head.position.x, sleeping ? 0.16 : 0, 4, dt);
      head.position.z = R.damp(head.position.z, sleeping ? 0.5 : 0.42, 4, dt);
      head.rotation.x = R.damp(head.rotation.x, sleeping ? 0.2 : munch > 0 ? 0.3 : 0, 4, dt);
      head.rotation.y = R.damp(head.rotation.y, sleeping ? 0.6 : 0, 4, dt);
      head.rotation.z = sleeping ? R.damp(head.rotation.z, -0.3, 4, dt) : petted ? 0.25 + Math.sin(t * 2) * 0.05 : happy ? Math.sin(t * 1.2) * 0.08 : 0;
      torso.scale.z = R.damp(torso.scale.z, sleeping ? 0.8 : 1, 4, dt);
      tail.position.y = R.damp(tail.position.y, sleeping ? 0.16 : 0.45, 4, dt);
      tail.position.x = R.damp(tail.position.x, sleeping ? 0.2 : 0, 4, dt);
      legs.forEach(l => (l.visible = !sleeping));
      torso.scale.y = R.damp(torso.scale.y, angry ? 1.12 : sleeping ? 0.7 : 1, 6, dt);
      torso.scale.x = 1 + (sleeping ? Math.sin(t * 1.5) * 0.04 : 0);   // breathing
      body.position.x = angry ? Math.sin(t * 40) * 0.015 : 0;          // shaking with rage
      const earBack = angry ? 0.9 : sleeping ? 0.3 : 0;
      earL.rotation.z = R.damp(earL.rotation.z, earBack, 8, dt);
      earR.rotation.z = R.damp(earR.rotation.z, -earBack, 8, dt);

      // tail
      const puff = angry ? 1.35 : 1;
      segs.forEach((s, i) => {
        s.scale.set(puff, 1, puff);
        if (sleeping) { s.rotation.x = R.damp(s.rotation.x, i === 0 ? -1.5 : 0, 5, dt); s.rotation.z = R.damp(s.rotation.z, i === 0 ? -0.5 : -0.8, 5, dt); }
        else if (angry) { s.rotation.x = (i === 0 ? -0.9 : 0.15) + Math.sin(t * 9 + i) * 0.05; s.rotation.z = Math.sin(t * 12) * 0.05; }
        else { s.rotation.x = i === 0 ? -0.5 : 0.25; s.rotation.z = Math.sin(t * (happy ? 3 : 1.5) - i * 0.6) * (happy ? 0.35 : 0.2); }
      });

      // eyes
      blink -= dt;
      if (blink < -3 - Math.random() * 3) blink = 0.15;
      eyes.material.map = sleeping ? eyeTex.closed : angry ? eyeTex.angry : blink > 0 ? eyeTex.closed : happy ? eyeTex.happy : eyeTex.open;

      // bubble
      let sym = null;
      if (meow > 0) { meow -= dt; sym = 'meow'; }
      else if (alert > 0) sym = 'alert';
      else if (petted) sym = 'heart';
      else if (sleeping) sym = 'z';
      else if (angry) sym = 'angry';
      else if (happy && (t % 8) < 2.5) sym = 'heart';
      bubble.material.map = sym ? symTex[sym] : bubble.material.map;
      const bob = Math.sin(t * 2) * 0.05;
      bubble.position.set(sleeping ? 0.25 : 0.1, (sleeping ? 0.85 : 1.2) + bob + (sym === 'z' ? (t % 2) * 0.15 : 0), 0.3);
      bubble.material.opacity = R.damp(bubble.material.opacity, sym ? 1 : 0, 6, dt);
      bubble.visible = bubble.material.opacity > 0.01;
    });

    R.cat.group = cat;
    R.makeClickable(cat, 'cat · click: open Claude (or wake it) · wiggle: pet', () => {
      if (mood === 'sleeping') { wake(); return; }
      meow = 1.6; jump = 1;
      R.sfx.meow(false);
      R.catSay(mood === 'angry' ? 'hmph. opening Claude… now get to work' : 'meow! opening Claude…', 2.5);
      launchClaude();
    });
    R.cat.wake = wake;
  };
})(window.R);
