// The corner box's tabs: ⏱ focus (the timer and tasks), ✿ dress up (name her and pick her hair,
// outfit and headwear, or dress up the cat, old character-creator style with ◀ ▶ arrows), and
// 🎨 room (opens the room makeover window, decor.js). While dress up is open she steps onto the rug.
(function (R) {
  const GIRL_ROWS = [
    ['hair', 'hair'], ['hair colour', 'hairCol'], ['skin', 'skin'], ['top', 'top'], ['top colour', 'topCol'],
    ['bottoms', 'bottom'], ['bottoms colour', 'bottomCol'], ['shoes', 'shoes'], ['on her head', 'head'], ['head colour', 'headCol'],
  ];
  const CAT_ROWS = [['coat', 'coat'], ['eyes', 'eyes'], ['collar', 'collar'], ['collar colour', 'collarCol']];

  R.buildLooks = function () {
    const hud = document.getElementById('hud'), body = hud.querySelector('.body');
    const focusPane = R.el('div', { id: 'paneFocus' });
    while (body.firstChild) focusPane.append(body.firstChild);
    const dressPane = R.el('div', { id: 'paneDress', hidden: '' });
    const tabs = R.el('div', { cls: 'htabs' });
    body.append(tabs, focusPane, dressPane);

    let pane = 'focus', who = 'girl';
    const tabBtn = (id, text, title) => R.el('button', { 'data-tab': id, text, title, onclick: () => show(id) });
    tabs.append(tabBtn('focus', '⏱ focus', 'timer and tasks'), tabBtn('dress', '✿ dress up', 'name her, change her look, dress up the cat'),
      R.el('button', { text: '🎨 room', title: 'wallpaper, floor, rug, bedsheet, curtains', onclick: () => R.decor.open() }));
    function show(id) {
      pane = id;
      focusPane.hidden = id !== 'focus'; dressPane.hidden = id !== 'dress';
      tabs.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
      if (R.girl) R.girl.pose(id === 'dress' && who === 'girl');
      if (id === 'dress') draw();
    }

    const look = () => R.store.get('look', {}) || {};
    function save(part, patch) {
      const L = look();
      L[part] = Object.assign({}, part === 'girl' ? R.girlLook() : R.catLook(), patch);
      R.store.set('look', L);
      R.store.fire('look');
    }
    const optsFor = (part, key) => (part === 'girl' ? R.GIRL_OPTS : R.CAT_OPTS)[key];
    const isCol = v => typeof v === 'string' && v[0] === '#';

    function row(part, label, key) {
      const opts = optsFor(part, key), cur = (part === 'girl' ? R.girlLook() : R.catLook())[key];
      const idx = isCol(opts[0]) ? (+cur || 0) : Math.max(0, opts.indexOf(cur));
      const step = d => {
        const i = (idx + d + opts.length) % opts.length;
        save(part, { [key]: isCol(opts[0]) ? i : opts[i] });
        R.sfx.pop(420 + i * 30);
        draw();
      };
      const def = (part === 'girl' ? R.GIRL_DEF : R.CAT_DEF)[key];
      const orig = isCol(opts[0]) ? idx === (+def || 0) : opts[idx] === def;
      const val = R.el('span', { cls: 'dval', title: orig ? 'the original' : '' });
      if (isCol(opts[0])) { const sw = R.el('i', { cls: 'dswatch' }); sw.style.background = opts[idx]; val.append(sw, ' ' + (idx + 1) + '/' + opts.length); }
      else val.textContent = opts[idx];
      if (orig) val.append(' ★');
      return R.el('div', { cls: 'drow' }, R.el('span', { cls: 'dkey', text: label }),
        R.el('button', { text: '◀', onclick: () => step(-1) }), val, R.el('button', { text: '▶', onclick: () => step(1) }));
    }
    function draw() {
      const L = who === 'girl' ? R.girlLook() : R.catLook();
      dressPane.innerHTML = '';
      const name = R.el('input', { cls: 'dname', maxlength: '14', placeholder: who === 'girl' ? 'her name' : 'cat\'s name', spellcheck: 'false' });
      name.value = L.name || '';
      name.onchange = () => { save(who, { name: name.value.trim() }); R.toast((who === 'girl' ? 'she' : 'the cat') + '\'s name is ' + (name.value.trim() || '…nothing?') + ' now'); };
      dressPane.append(
        R.el('div', { cls: 'dwho' },
          R.el('button', { cls: who === 'girl' ? 'on' : '', text: '👧 her', onclick: () => { who = 'girl'; R.girl.pose(true); draw(); } }),
          R.el('button', { cls: who === 'cat' ? 'on' : '', text: '🐈 the cat', onclick: () => { who = 'cat'; R.girl.pose(false); draw(); } })),
        R.el('div', { cls: 'drow' }, R.el('span', { cls: 'dkey', text: 'name' }), name),
        ...(who === 'girl' ? GIRL_ROWS : CAT_ROWS).map(([l, k]) => row(who, l, k)),
        R.el('div', { cls: 'row dfoot2' },
          R.el('button', { text: '🎲 random', onclick: randomise }),
          R.el('button', { text: '★ original', title: 'back to the original look (keeps the name)', onclick: () => {
            const L2 = look(), name = (L2[who] || {}).name; L2[who] = name ? { name } : {};
            R.store.set('look', L2); R.store.fire('look'); R.sfx.pop(520); draw();
          } })),
        R.el('div', { cls: 'dhint', text: '★ = the original look' }));
    }
    function randomise() {
      const O = who === 'girl' ? R.GIRL_OPTS : R.CAT_OPTS, patch = {};
      (who === 'girl' ? GIRL_ROWS : CAT_ROWS).forEach(([, k]) => { const o = O[k], i = Math.floor(Math.random() * o.length); patch[k] = isCol(o[0]) ? i : o[i]; });
      save(who, patch);
      R.sfx.pop(600);
      draw();
    }

    R.store.watch('look', () => { if (pane === 'dress' && !dressPane.contains(document.activeElement)) draw(); });
    // collapsing the box ends the fitting
    document.getElementById('hudToggle').addEventListener('click', () => setTimeout(() => { if (hud.classList.contains('collapsed') && R.girl) R.girl.pose(false); else if (pane === 'dress' && who === 'girl') R.girl.pose(true); }, 0));
    show('focus');
    R.looks = { show };
  };
})(window.R);
