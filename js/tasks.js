// To-do list in the HUD. Completing a task waters the plant and keeps the cat happy.
(function (R) {
  const T = R.tasks = { list: R.store.get('tasks', []) };
  const save = () => R.store.set('tasks', T.list);

  T.add = text => {
    text = text.trim();
    if (!text) return;
    T.list.push({ id: Date.now() + Math.random(), text, done: false });
    save(); render();
  };
  T.toggle = id => {
    const t = T.list.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    if (t.done && !t.rewarded) {
      t.rewarded = true;      // un-ticking and re-ticking can't farm water
      R.markProductive('tasks');
      R.emit('task:done', t);
      R.toast('nice! plant watered 💧');
    }
    save(); render();
  };
  T.remove = id => { T.list = T.list.filter(x => x.id !== id); save(); render(); };
  T.clearDone = () => { T.list = T.list.filter(x => !x.done); save(); render(); };

  function render() {
    const ul = document.getElementById('taskList');
    if (!ul) return;
    ul.textContent = '';
    T.list.forEach(t => {
      const li = document.createElement('li');
      li.className = t.done ? 'done' : '';
      const cb = document.createElement('button');
      cb.className = 'check'; cb.textContent = t.done ? '✓' : '';
      cb.onclick = () => T.toggle(t.id);
      const span = document.createElement('span'); span.textContent = t.text;
      span.onclick = () => T.toggle(t.id);
      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×'; del.title = 'remove';
      del.onclick = () => T.remove(t.id);
      li.append(cb, span, del);
      ul.appendChild(li);
    });
    const open = T.list.filter(t => !t.done).length;
    const c = document.getElementById('taskCount');
    if (c) c.textContent = open ? open + ' left' : (T.list.length ? 'all done ✨' : '');
  }
  T.render = render;

  R.store.watch('tasks', v => { T.list = v || []; render(); });

  R.initTasks = function () {
    const form = document.getElementById('taskForm'), input = document.getElementById('taskInput');
    form.addEventListener('submit', e => { e.preventDefault(); T.add(input.value); input.value = ''; });
    document.getElementById('clearDone').onclick = T.clearDone;
    render();
  };
})(window.R);
