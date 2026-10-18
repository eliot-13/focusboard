// Application : routage, barre latérale, actions globales, raccourcis, recherche et paramètres.
(function () {
  'use strict';

  const { icon, esc } = U;
  const HOUR_H = 48;
  const PERIOD_RE = { day: /^\d{4}-\d{2}-\d{2}$/, week: /^\d{4}-W\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ };
  const CAL_MODES = ['month', 'week', 'day', 'agenda'];

  let route = { view: 'today' };
  let lastHash = null;
  let lastDay = D.today();

  // ---------------------------------------------------------------- Routage

  function parseHash() {
    const [view, a, b] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (view === 'tasks') {
      const scope = M.SCOPES.includes(a) ? a : 'day';
      const period = scope !== 'inbox' && b && PERIOD_RE[scope].test(b) ? b : null;
      return { view: 'tasks', scope, period };
    }
    if (view === 'calendar') {
      const mode = CAL_MODES.includes(a) ? a : S.state.settings.calView;
      const date = PERIOD_RE.day.test(b || '') ? b : D.today();
      if (S.state.settings.calView !== mode) { S.state.settings.calView = mode; S.save(); }
      return { view: 'calendar', mode, date };
    }
    if (view === 'goals') return { view: 'goals', horizon: M.HORIZON_RANK[a] !== undefined ? a : 'all' };
    return { view: 'today' };
  }

  function render() {
    route = parseHash();
    const viewEl = document.getElementById('view');
    const isNewRoute = location.hash !== lastHash;

    // Conserver le focus d'un champ d'ajout et le défilement interne pendant le rafraîchissement.
    let refocus = null;
    const active = document.activeElement;
    if (active && viewEl.contains(active)) {
      const f = active.closest('[data-form]');
      if (f) refocus = { key: f.dataset.key, value: active.value };
    }
    const scrolls = {};
    if (!isNewRoute) viewEl.querySelectorAll('[data-keep-scroll]').forEach((el) => { scrolls[el.dataset.keepScroll] = el.scrollTop; });

    const v = V[route.view];
    viewEl.className = 'view' + (v.wide ? ' wide' : '') + (isNewRoute ? ' enter' : '');
    viewEl.innerHTML = v.render(route);
    if (v.mount) v.mount(viewEl, route, isNewRoute);

    viewEl.querySelectorAll('[data-keep-scroll]').forEach((el) => {
      if (scrolls[el.dataset.keepScroll] != null) el.scrollTop = scrolls[el.dataset.keepScroll];
    });
    if (refocus) {
      const input = viewEl.querySelector('[data-form][data-key="' + CSS.escape(refocus.key) + '"] input');
      if (input) { input.value = refocus.value; input.focus({ preventScroll: true }); }
    }

    renderSidebar();
    const title = v.title(route);
    document.getElementById('topbar-title').textContent = title;
    document.title = title + ' · Organisation';
    if (isNewRoute) window.scrollTo(0, 0);
    lastHash = location.hash;
  }

  function renderSidebar() {
    const s = S.state;
    const ref = D.today();
    const count = (scope) => {
      const n = M.tasksIn(s, scope, scope === 'inbox' ? null : D.periodOf(scope, ref)).filter((t) => !t.done).length;
      return n ? '<span class="count">' + n + '</span>' : '';
    };
    const is = (cond) => (cond ? ' active' : '');
    const r = route;
    const link = (href, ic, label, active, extra) => '<a class="nav-item' + is(active) + '" href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + icon(ic) + '<span>' + label + '</span>' + (extra || '') + '</a>';
    const activeGoals = s.goals.filter((g) => g.status === 'active').length;
    const dark = isDark();

    document.getElementById('sidebar').innerHTML =
      '<div class="side-head"><div class="avatar">' + esc((s.settings.name || 'O').trim().charAt(0).toUpperCase() || 'O') + '</div>'
      + '<div class="side-name">' + esc(s.settings.name ? 'Espace de ' + s.settings.name : 'Mon organisation') + '</div></div>'
      + '<button type="button" class="nav-item" data-act="open-search">' + icon('search') + '<span>Rechercher</span><span class="kbd-hint"><kbd>' + (U.isMac ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd></span></button>'
      + link('#/today', 'today', "Aujourd'hui", r.view === 'today')
      + link('#/calendar', 'calendar', 'Calendrier', r.view === 'calendar')
      + link('#/goals', 'target', 'Objectifs', r.view === 'goals', activeGoals ? '<span class="count">' + activeGoals + '</span>' : '')
      + '<div class="side-label">Tâches</div>'
      + link('#/tasks/inbox', 'inbox', 'Sans date', r.view === 'tasks' && r.scope === 'inbox', count('inbox'))
      + link('#/tasks/day', 'day', 'Jour', r.view === 'tasks' && r.scope === 'day', count('day'))
      + link('#/tasks/week', 'week', 'Semaine', r.view === 'tasks' && r.scope === 'week', count('week'))
      + link('#/tasks/month', 'month', 'Mois', r.view === 'tasks' && r.scope === 'month', count('month'))
      + link('#/tasks/year', 'year', 'Année', r.view === 'tasks' && r.scope === 'year', count('year'))
      + '<div class="side-spacer"></div><div class="side-foot">'
      + '<button type="button" class="nav-item" data-act="new-task">' + icon('plus') + '<span>Nouvelle tâche</span><span class="kbd-hint"><kbd>N</kbd></span></button>'
      + '<button type="button" class="nav-item" data-act="toggle-theme">' + icon(dark ? 'today' : 'moon') + '<span>' + (dark ? 'Mode clair' : 'Mode sombre') + '</span></button>'
      + '<button type="button" class="nav-item" data-act="open-settings">' + icon('settings') + '<span>Paramètres</span></button></div>';
  }

  // ---------------------------------------------------------------- Thème

  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  function isDark() {
    const t = S.state.settings.theme;
    return t === 'dark' || (t === 'system' && darkQuery.matches);
  }
  function applyTheme() {
    const t = S.state.settings.theme;
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]').content = isDark() ? '#191919' : '#FFFFFF';
  }

  // ---------------------------------------------------------------- Actions

  const idOf = (el) => el.closest('[data-id]').dataset.id;
  const findTask = (id) => M.findTask(S.state, id);

  function newTaskContext() {
    if (route.view === 'tasks') {
      return { scope: route.scope, period: route.scope === 'inbox' ? null : route.period || D.periodOf(route.scope, D.today()) };
    }
    if (route.view === 'calendar') return { scope: 'day', period: route.date };
    return { scope: 'day', period: D.today() };
  }

  function createTask(fields) {
    const t = M.newTask(fields);
    S.update((s) => s.tasks.push(t));
    P.open('task', t.id, { isNew: true });
  }

  function moveMenu(anchor, t) {
    const ref = D.today();
    const wk = D.periodOf('week', ref);
    const mo = D.periodOf('month', ref);
    const targets = [
      ["Aujourd'hui", 'day', 'day', ref],
      ['Demain', 'day', 'day', D.addDays(ref, 1)],
      ['Cette semaine', 'week', 'week', wk],
      ['Semaine prochaine', 'week', 'week', D.shiftPeriod('week', wk, 1)],
      ['Ce mois-ci', 'month', 'month', mo],
      ['Le mois prochain', 'month', 'month', D.shiftPeriod('month', mo, 1)],
      ['Cette année', 'year', 'year', D.periodOf('year', ref)],
      ['Sans date', 'inbox', 'inbox', null],
    ];
    if (t.scope !== 'inbox') {
      const next = D.shiftPeriod(t.scope, t.period, 1);
      targets.unshift(['Période suivante', 'arrow', t.scope, next]);
    }
    const items = [{ header: 'Déplacer vers' }];
    targets.forEach(([label, ic, scope, period]) => {
      if (scope === t.scope && period === t.period) return;
      const hint = label === 'Période suivante' ? C.listLabel({ scope: t.scope, period: period }) : '';
      items.push({
        label, icon: ic, hint,
        onClick: () => {
          S.update(() => M.moveTask(findTask(t.id), scope, period));
          U.toast('Déplacée : ' + C.listLabel(findTask(t.id)));
        },
      });
    });
    items.push({ sep: true }, { label: 'Supprimer', icon: 'trash', danger: true, onClick: () => A['delete-task'](anchor) });
    U.menu(anchor, items);
  }

  Object.assign(A, {
    'open-task': (el, e, ctx) => P.open('task', idOf(el), { fromPeek: ctx.inPeek }),
    'open-event': (el, e, ctx) => P.open('event', idOf(el), { fromPeek: ctx.inPeek, date: el.dataset.date }),
    'open-goal': (el, e, ctx) => P.open('goal', idOf(el), { fromPeek: ctx.inPeek }),

    'toggle-task'(el) {
      const id = idOf(el);
      let next = null;
      S.update((s) => { next = M.toggleTask(s, id); });
      const t = findTask(id);
      if (t && t.done) {
        const c = document.querySelector('.task[data-id="' + id + '"] > .check');
        if (c) c.classList.add('pop');
      }
      if (next) U.toast('Prochaine occurrence : ' + C.listLabel(next));
    },

    'focus-task'(el) {
      const t = findTask(idOf(el));
      if (!t.focus) {
        const n = S.state.tasks.filter((x) => x.focus && x.scope === 'day' && x.period === t.period && !x.done).length;
        if (n >= 3) { U.toast('Trois priorités maximum : retirez-en une d\'abord.'); return; }
      }
      S.update(() => { t.focus = !t.focus; });
    },

    'move-task'(el) { moveMenu(el, findTask(idOf(el))); },

    'delete-task'(el) {
      const id = idOf(el);
      if (P.current && P.current.id === id) P.close();
      S.undoable('Tâche supprimée', (s) => { s.tasks = s.tasks.filter((t) => t.id !== id); });
    },

    reschedule(el) {
      const { scope, from, to } = el.dataset;
      const n = S.state.tasks.filter((t) => t.scope === scope && !t.done && (from ? t.period === from : t.period < to)).length;
      S.undoable(n + (n > 1 ? ' tâches reportées' : ' tâche reportée'), (s) => {
        s.tasks.forEach((t) => {
          if (t.scope === scope && !t.done && (from ? t.period === from : t.period < to)) M.moveTask(t, scope, to);
        });
      });
    },

    'toggle-done': () => S.update((s) => { s.settings.showDone = !s.settings.showDone; }),

    'pick-focus'(el) {
      const ref = D.today();
      const candidates = M.sortTasks(M.tasksIn(S.state, 'day', ref).filter((t) => !t.done && !t.focus), 'priority');
      const items = [{ header: candidates.length ? "Tâches d'aujourd'hui" : "Aucune tâche aujourd'hui" }];
      candidates.slice(0, 8).forEach((t) => items.push({ label: t.title || 'Sans titre', icon: 'star', onClick: () => S.update(() => { findTask(t.id).focus = true; }) }));
      items.push({ sep: true }, { label: 'Nouvelle priorité', icon: 'plus', onClick: () => createTask({ scope: 'day', period: ref, focus: true }) });
      U.menu(el, items);
    },

    'new-task'() { createTask(newTaskContext()); },

    'new-event'(el) {
      const ref = D.today();
      const date = (el && el.dataset.date) || (route.view === 'calendar' ? route.date : ref);
      let start = el && el.dataset.time;
      if (!start) start = date === ref ? D.minToTime(Math.min(23 * 60, (new Date().getHours() + 1) * 60)) : '09:00';
      const ev = M.newEvent({ date, start, end: D.minToTime(D.timeToMin(start) + 60) });
      S.update((s) => s.events.push(ev));
      P.open('event', ev.id, { isNew: true, date });
    },

    'new-goal'(el) {
      const horizon = (el && el.dataset.horizon) || (route.view === 'goals' && route.horizon !== 'all' ? route.horizon : 'year');
      const h = M.HORIZONS[M.HORIZON_RANK[horizon]];
      const g = M.newGoal({ horizon, period: h.scope ? D.periodOf(h.scope, D.today()) : null });
      S.update((s) => s.goals.push(g));
      P.open('goal', g.id, { isNew: true });
    },

    'toggle-cal-tasks': () => S.update((s) => { s.settings.calTasks = !s.settings.calTasks; }),
    'goto-day': (el) => { location.hash = '#/calendar/day/' + el.dataset.date; },
    cell(el) {
      if (matchMedia('(max-width: 640px)').matches) location.hash = '#/calendar/day/' + el.dataset.date;
      else A['new-event'](el);
    },
    slot(el, e) {
      const y = e.clientY - el.getBoundingClientRect().top;
      const min = Math.max(0, Math.min(23 * 60, Math.floor((y / HOUR_H) * 2) * 30));
      A['new-event']({ dataset: { date: el.dataset.date, time: D.minToTime(min) } });
    },

    'open-search': () => openPalette(),
    'open-settings': () => openSettings(),
    'toggle-theme'() {
      S.update((s) => { s.settings.theme = isDark() ? 'light' : 'dark'; });
      applyTheme();
      renderSidebar();
    },
    'toggle-nav': () => document.querySelector('.app').classList.toggle('nav-open'),
    'close-nav': () => document.querySelector('.app').classList.remove('nav-open'),

    'set-theme'(el) {
      S.update((s) => { s.settings.theme = el.dataset.theme; });
      applyTheme();
      renderSidebar();
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    },
    'sync-now'() { G.sync(); },
    'sync-off'() {
      if (!confirm('Arrêter la synchronisation sur cet appareil ?\nLes données restent ici et dans le gist ; le jeton est oublié.')) return;
      G.disconnect();
    },
    'export-data'() {
      U.download('organisation-' + D.today() + '.json', JSON.stringify(S.state, null, 2));
      U.toast('Export téléchargé');
    },
    'reset-data'() {
      if (!confirm('Effacer définitivement toutes vos tâches, événements et objectifs ?\nPensez à exporter une sauvegarde avant.')) return;
      P.close();
      S.backupNow('effacement');
      const settings = S.state.settings;
      S.replace(Object.assign(M.emptyState(), { settings }));
      U.closeTop();
      U.toast('Toutes les données ont été effacées');
    },
    'restore-backup'(el) {
      const at = Number(el.dataset.at);
      if (!confirm('Restaurer la sauvegarde du ' + backupDate(at) + ' ?\nVos données actuelles seront remplacées. Elles sont d\'abord sauvegardées, vous pourrez donc revenir en arrière.')) return;
      P.close();
      if (!S.restore(at)) { U.toast('Sauvegarde introuvable'); return; }
      applyTheme();
      U.closeTop();
      U.toast('Sauvegarde du ' + backupDate(at) + ' restaurée');
    },
  });

  // ---------------------------------------------------------------- Recherche (Ctrl+K)

  const NAV = [
    ["Aujourd'hui", 'today', '#/today'],
    ['Calendrier', 'calendar', '#/calendar'],
    ['Objectifs', 'target', '#/goals'],
    ['Tâches sans date', 'inbox', '#/tasks/inbox'],
    ['Tâches du jour', 'day', '#/tasks/day'],
    ['Tâches de la semaine', 'week', '#/tasks/week'],
    ['Tâches du mois', 'month', '#/tasks/month'],
    ["Tâches de l'année", 'year', '#/tasks/year'],
  ];

  function openPalette() {
    if (document.querySelector('.palette')) return;
    const m = U.modal({
      cls: 'palette',
      body: '<div class="palette-input">' + icon('search') + '<input type="text" placeholder="Rechercher une tâche, un événement, un objectif… ou créer" aria-label="Rechercher"><kbd>Échap</kbd></div>'
        + '<div class="palette-results" role="listbox"></div>'
        + '<div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>Entrée</kbd> ouvrir</span></div>',
    });
    const input = m.el.querySelector('input');
    const box = m.el.querySelector('.palette-results');
    let items = [];
    let sel = 0;

    function build(q) {
      const s = S.state;
      const query = q.trim();
      items = [];
      if (query) {
        items.push({ group: 'Créer', icon: 'plus', label: 'Nouvelle tâche « ' + query + ' »', hint: 'Sans date', run: () => {
          const p = M.parseQuickTitle(query);
          S.update((st) => st.tasks.push(M.newTask({ title: p.title || query, tags: p.tags, priority: p.priority })));
          U.toast('Tâche ajoutée dans « Sans date »');
        } });
        const r = M.search(s, query);
        r.tasks.forEach((t) => items.push({ group: 'Tâches', icon: t.done ? 'check' : 'circle', label: t.title || 'Sans titre', hint: C.listLabel(t), run: () => P.open('task', t.id) }));
        r.events.forEach((e) => items.push({ group: 'Événements', icon: 'calendar', label: e.title || 'Sans titre', hint: C.dayLabel(e.date) + (e.repeat ? ' · récurrent' : ''), run: () => { location.hash = '#/calendar/week/' + e.date; P.open('event', e.id, { date: e.date }); } }));
        r.goals.forEach((g) => items.push({ group: 'Objectifs', icon: 'target', label: g.title || 'Sans titre', hint: M.goalPeriodLabel(g), run: () => P.open('goal', g.id) }));
        NAV.filter(([l]) => M.norm(l).includes(M.norm(query))).forEach(([l, ic, href]) => items.push({ group: 'Aller à', icon: ic, label: l, run: () => { location.hash = href; } }));
      } else {
        items.push(
          { group: 'Créer', icon: 'check', label: 'Nouvelle tâche', hint: 'N', run: () => A['new-task']() },
          { group: 'Créer', icon: 'calendar', label: 'Nouvel événement', hint: 'E', run: () => A['new-event']() },
          { group: 'Créer', icon: 'target', label: 'Nouvel objectif', hint: 'O', run: () => A['new-goal']() },
        );
        NAV.forEach(([l, ic, href]) => items.push({ group: 'Aller à', icon: ic, label: l, run: () => { location.hash = href; } }));
      }
      sel = Math.min(sel, Math.max(0, items.length - 1));
      draw();
    }

    function draw() {
      let html = '';
      let group = null;
      items.forEach((it, i) => {
        if (it.group !== group) { group = it.group; html += '<div class="palette-group">' + esc(group) + '</div>'; }
        html += '<button type="button" class="palette-item' + (i === sel ? ' sel' : '') + '" data-i="' + i + '" role="option" aria-selected="' + (i === sel) + '">'
          + icon(it.icon) + '<span class="t">' + esc(it.label) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</button>';
      });
      box.innerHTML = html || '<div class="empty" style="padding:24px">Aucun résultat</div>';
      const cur = box.querySelector('.sel');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    function run(i) {
      const it = items[i];
      if (!it) return;
      m.close();
      it.run();
    }

    input.addEventListener('input', () => { sel = 0; build(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) run(Number(b.dataset.i)); });
    build('');
    input.focus();
  }

  // ---------------------------------------------------------------- Paramètres

  function openSettings() {
    const st = S.state.settings;
    const mod = U.isMac ? '⌘' : 'Ctrl';
    const shortcuts = [
      ['Rechercher', [mod, 'K']], ['Nouvelle tâche', ['N']], ['Nouvel événement', ['E']], ['Nouvel objectif', ['O']],
      ["Aller à Aujourd'hui", ['T']], ['Période précédente / suivante', ['←', '→']], ['Fermer', ['Échap']],
    ];
    const m = U.modal({
      title: 'Paramètres',
      body: '<div class="modal-body">'
        + '<div class="settings-row"><div><h3>Votre prénom</h3><p>Pour le message d\'accueil.</p></div><input type="text" id="set-name" value="' + esc(st.name) + '" placeholder="Prénom" aria-label="Prénom"></div>'
        + '<div class="settings-row"><div><h3>Apparence</h3><p>Clair, sombre ou selon le système.</p></div><div class="seg">'
        + [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => '<button type="button" data-act="set-theme" data-theme="' + v + '" class="' + (st.theme === v ? 'on' : '') + '">' + l + '</button>').join('')
        + '</div></div>'
        + '<div class="settings-row" id="set-sync">' + syncRow() + '</div>'
        + '<div class="settings-row"><div><h3>Sauvegarde</h3><p>' + (S.persistent
          ? 'Vos données sont enregistrées dans ce navigateur, sur cet appareil. Exportez-les de temps en temps pour garder une copie.'
          : 'Le stockage du navigateur est indisponible : vos données ne seront pas conservées après fermeture.') + '</p></div>'
        + '<div class="settings-actions"><button type="button" class="btn btn-sm" data-act="export-data">' + icon('download') + 'Exporter</button>'
        + '<label class="btn btn-sm">' + icon('upload') + 'Importer<input type="file" accept="application/json,.json" id="set-import" hidden></label></div></div>'
        + '<div class="settings-row" style="display:block">' + backupRow() + '</div>'
        + '<div class="settings-row"><div><h3>Tout effacer</h3><p>Supprime toutes les tâches, événements et objectifs.</p></div>'
        + '<button type="button" class="btn btn-sm btn-danger" data-act="reset-data">' + icon('trash') + 'Effacer</button></div>'
        + '<div class="settings-row" style="display:block"><h3>Raccourcis clavier</h3><div class="shortcuts">'
        + shortcuts.map(([l, keys]) => '<span>' + l + '</span><span>' + keys.map((k) => '<kbd>' + k + '</kbd>').join('') + '</span>').join('')
        + '</div></div></div>',
      onClose: () => stopSync(),
    });
    const syncEl = m.el.querySelector('#set-sync');
    const stopSync = G.onChange(() => { syncEl.innerHTML = syncRow(); });
    syncEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = syncEl.querySelector('#sync-token');
      const btn = syncEl.querySelector('button[type="submit"]');
      if (!input.value.trim()) return;
      btn.disabled = true;
      btn.textContent = 'Connexion…';
      try {
        await G.connect(input.value);
        U.toast('Synchronisation activée');
      } catch (err) {
        U.toast('Connexion impossible : ' + err.message);
      }
      syncEl.innerHTML = syncRow();
    });
    m.el.querySelector('#set-name').addEventListener('input', (e) => S.update((s) => { s.settings.name = e.target.value.trim(); }));
    m.el.querySelector('#set-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch (err) { U.toast('Fichier illisible : ce n\'est pas un JSON valide.'); return; }
        if (!M.isValidState(data)) { U.toast('Ce fichier ne ressemble pas à une sauvegarde de l\'application.'); return; }
        if (!confirm('Remplacer toutes vos données actuelles par celles de « ' + file.name + ' » ?')) return;
        P.close();
        S.backupNow('import');
        S.replace(data);
        applyTheme();
        m.close();
        U.toast('Données importées : ' + data.tasks.length + ' tâches, ' + data.events.length + ' événements, ' + data.goals.length + ' objectifs');
      };
      reader.readAsText(file);
    });
  }

  const backupDate = (at) => new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function backupRow() {
    const list = S.backups();
    const count = (d, key, one, many) => {
      const n = Array.isArray(d[key]) ? d[key].length : 0;
      return n + ' ' + (n > 1 ? many : one);
    };
    return '<h3>Sauvegardes automatiques</h3><p>Avant chaque mise à jour de l\'app, une fois par jour, et avant un import ou un effacement. '
      + 'Les 10 dernières restent sur cet appareil.</p>'
      + (list.length
        ? '<div class="backup-list">' + list.map((b) => '<div class="backup-item"><div><b>' + esc(backupDate(b.at)) + '</b>'
          + '<span>' + esc((M.BACKUP_REASONS[b.reason] || 'Sauvegarde') + ' · ' + count(b.data, 'tasks', 'tâche', 'tâches') + ', '
            + count(b.data, 'events', 'événement', 'événements') + ', ' + count(b.data, 'goals', 'objectif', 'objectifs')) + '</span></div>'
          + '<button type="button" class="btn btn-sm" data-act="restore-backup" data-at="' + b.at + '">Restaurer</button></div>').join('') + '</div>'
        : '<p>Aucune sauvegarde pour l\'instant : la première sera créée à la prochaine ouverture de l\'app, dès qu\'il y aura des données.</p>');
  }

  function syncRow() {
    const intro = '<div><h3>Synchronisation</h3>';
    if (!G.connected) {
      return intro + '<p>Retrouvez les mêmes données sur le téléphone et l\'ordinateur, via un gist secret de votre compte GitHub. '
        + '<a href="' + G.TOKEN_URL + '" target="_blank" rel="noopener">Créez un jeton</a> avec le seul droit « gist », puis collez-le sur chaque appareil.</p></div>'
        + '<form class="settings-actions"><input type="password" id="sync-token" placeholder="Jeton GitHub" autocomplete="off" spellcheck="false" aria-label="Jeton GitHub">'
        + '<button type="submit" class="btn btn-sm btn-primary">Connecter</button></form>';
    }
    const label = {
      idle: 'Connectée', syncing: 'Synchronisation…', ok: 'À jour',
      offline: 'Hors ligne : les modifications partiront au retour du réseau', error: 'Erreur : ' + G.message,
    }[G.status] || '';
    const at = G.lastSync ? ' · dernière synchro ' + new Date(G.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return intro + '<p>' + esc(label + at) + '</p></div>'
      + '<div class="settings-actions"><button type="button" class="btn btn-sm" data-act="sync-now">' + icon('repeat') + 'Synchroniser</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" data-act="sync-off">Déconnecter</button></div>';
  }

  // ---------------------------------------------------------------- Événements globaux

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    const inPeek = !!el.closest('.peek');
    fn(el, e, { inPeek });
    if (inPeek && P.current) P.render();
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && V.changes[el.dataset.change]) V.changes[el.dataset.change](el.value, el);
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="add-task"]');
    if (!f) return;
    e.preventDefault();
    const input = f.querySelector('input');
    const raw = input.value.trim();
    if (!raw) return;
    const q = M.parseQuickTitle(raw);
    const t = M.newTask({ title: q.title || raw, tags: q.tags, priority: q.priority, scope: f.dataset.scope, period: f.dataset.period || null, focus: f.dataset.focus === '1' });
    input.value = '';
    S.update((s) => s.tasks.push(t));
  });

  // Glisser-déposer pour réordonner une liste (ordre manuel).
  let dragRow = null;
  const clearDrop = () => document.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  document.addEventListener('dragstart', (e) => {
    const row = e.target.closest && e.target.closest('.task[draggable="true"]');
    if (!row) return;
    dragRow = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  });
  document.addEventListener('dragend', () => {
    if (dragRow) dragRow.classList.remove('dragging');
    dragRow = null;
    clearDrop();
  });
  document.addEventListener('dragover', (e) => {
    if (!dragRow) return;
    const row = e.target.closest('.task[draggable="true"]');
    if (!row || row === dragRow || row.parentElement !== dragRow.parentElement) return;
    e.preventDefault();
    clearDrop();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY > r.top + r.height / 2 ? 'drop-after' : 'drop-before');
  });
  document.addEventListener('drop', (e) => {
    if (!dragRow) return;
    const row = e.target.closest('.task[draggable="true"]');
    if (!row || row === dragRow) return;
    e.preventDefault();
    const after = row.classList.contains('drop-after');
    const ids = [...row.parentElement.querySelectorAll('.task[draggable="true"]')].map((x) => x.dataset.id).filter((id) => id !== dragRow.dataset.id);
    ids.splice(ids.indexOf(row.dataset.id) + (after ? 1 : 0), 0, dragRow.dataset.id);
    S.update((s) => ids.forEach((id, i) => { const t = M.findTask(s, id); if (t) t.order = i; }));
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'Escape') {
      if (U.closeTop()) return;
      if (P.current) { P.close(); return; }
      A['close-nav']();
      return;
    }
    if (e.key === 'Enter' && e.target.matches('[data-act]:not(button):not(a):not(input)')) { e.preventDefault(); e.target.click(); return; }
    if (U.isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || U.hasLayer()) return;
    switch (e.key) {
      case 'n': case 'N': e.preventDefault(); A['new-task'](); break;
      case 'e': case 'E': e.preventDefault(); A['new-event'](); break;
      case 'o': case 'O': e.preventDefault(); A['new-goal'](); break;
      case '/': e.preventDefault(); openPalette(); break;
      case 't': case 'T': location.hash = '#/today'; break;
      case 'ArrowLeft': case 'ArrowRight': {
        if (P.current) return;
        const nav = document.querySelectorAll('#view .period-nav a.icon-btn');
        if (nav.length === 2) location.hash = nav[e.key === 'ArrowLeft' ? 0 : 1].getAttribute('href');
        break;
      }
    }
  });

  // ---------------------------------------------------------------- Démarrage

  S.load();
  applyTheme();
  P.mount();
  S.subscribe(render);
  S.subscribe(applyTheme); // le thème peut arriver d'un autre appareil
  G.start();
  window.addEventListener('hashchange', () => { A['close-nav'](); U.closeMenu(); render(); });
  darkQuery.addEventListener('change', () => { applyTheme(); renderSidebar(); });

  // Changement de jour et ligne « maintenant » du calendrier.
  setInterval(() => {
    if (D.today() !== lastDay) { lastDay = D.today(); render(); return; }
    const line = document.querySelector('.now-line');
    if (line) { const n = new Date(); line.style.top = ((n.getHours() * 60 + n.getMinutes()) / 60) * HOUR_H + 'px'; }
  }, 60000);

  window.App = { render, get route() { return route; } };
  render();
})();
