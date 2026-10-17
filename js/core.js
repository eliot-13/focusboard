// Noyau : stockage (S), interface (U : icônes, menus, modales, notifications), composants partagés (C)
// et registre d'actions (A) déclenchées par les attributs data-act.
(function () {
  'use strict';

  // ---------------------------------------------------------------- Stockage

  const KEY = 'organise.v1';
  let state = M.emptyState();
  let base = M.emptyState(); // dernier état enregistré, pour dater les modifications
  let persistent = true;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());
  const snapshot = () => JSON.parse(JSON.stringify(state));

  function write() {
    if (!persistent) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      persistent = false;
      U.toast('Enregistrement impossible : les modifications seront perdues à la fermeture.');
    }
  }

  const S = {
    get state() { return state; },
    get persistent() { return persistent; },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        state = raw ? M.normalize(JSON.parse(raw)) : M.emptyState();
      } catch (e) {
        state = M.emptyState();
        persistent = false;
      }
      base = snapshot();
    },
    save() {
      M.stamp(base, state, Date.now());
      base = snapshot();
      write();
      if (window.G) G.schedule();
    },
    update(fn) {
      fn(state);
      S.save();
      emit();
    },
    replace(next) {
      state = M.normalize(next);
      S.save();
      emit();
    },
    // Fusionne l'état reçu d'un autre appareil. Renvoie true si l'état local a changé.
    merge(remote) {
      const merged = M.merge(state, remote);
      if (M.serialize(merged) === M.serialize(state)) return false;
      state = merged;
      base = snapshot();
      write();
      emit();
      return true;
    },
    // Modification annulable depuis la notification.
    undoable(message, fn) {
      const snap = JSON.stringify(state);
      S.update(fn);
      U.toast(message, 'Annuler', () => S.replace(JSON.parse(snap)));
    },
    subscribe(fn) { listeners.push(fn); },
  };

  // Synchronise les onglets ouverts en parallèle.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { S.load(); emit(); }
  });

  // ---------------------------------------------------------------- Icônes

  const CAL = '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>';
  const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z';
  const PATHS = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    calendar: CAL,
    day: CAL + '<rect x="7" y="12.5" width="4" height="4" rx="0.8" fill="currentColor" stroke="none"/>',
    week: CAL + '<rect x="6.5" y="13" width="11" height="3.2" rx="0.8" fill="currentColor" stroke="none"/>',
    month: CAL + '<path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01M16.5 17h.01" stroke-width="2.8"/>',
    year: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>',
    inbox: '<path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/><path d="M5.5 4.5h13L21 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-5.5z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/>',
    settings: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    star: '<path d="' + STAR + '"/>',
    starFill: '<path d="' + STAR + '" fill="currentColor"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></g>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    note: '<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>',
    list: '<path d="M11 6h9M11 12h9M11 18h9"/><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/>',
    tag: '<path d="M3 12.5v-8A1.5 1.5 0 0 1 4.5 3h8l8.5 8.5-9.5 9.5z"/><circle cx="8" cy="8" r="1.5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.5-7.5 10-7.5 10z"/>',
    chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
    status: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    parent: '<path d="M6 4v8a4 4 0 0 0 4 4h9M15 12l4 4-4 4"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="10" r="1.2" fill="currentColor"/>',
  };

  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
      + (cls ? ' class="' + cls + '"' : '') + '>' + (PATHS[name] || '') + '</svg>';
  }

  // ---------------------------------------------------------------- Interface

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  function toast(message, actionLabel, onAction) {
    const root = document.getElementById('toast-root');
    while (root.children.length >= 3) root.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>' + esc(message) + '</span>' + (actionLabel ? '<button type="button">' + esc(actionLabel) + '</button>' : '');
    if (actionLabel) {
      el.querySelector('button').addEventListener('click', () => { el.remove(); onAction(); });
    }
    root.appendChild(el);
    setTimeout(() => el.remove(), actionLabel ? 6000 : 3500);
  }

  let openMenu = null;
  let menuCleanup = null;

  function closeMenu() {
    if (!openMenu) return false;
    openMenu.remove();
    openMenu = null;
    if (menuCleanup) menuCleanup();
    return true;
  }

  // items : { label, icon, hint, danger, onClick } | { sep: true } | { header: 'Titre' }
  function menu(anchor, items) {
    closeMenu();
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => {
      if (it.sep) return '<div class="menu-sep"></div>';
      if (it.header) return '<div class="menu-label">' + esc(it.header) + '</div>';
      return '<button type="button" class="menu-item' + (it.danger ? ' danger' : '') + '" role="menuitem" data-i="' + i + '">'
        + (it.icon ? icon(it.icon) : '') + '<span>' + esc(it.label) + '</span>'
        + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</button>';
    }).join('');
    document.body.appendChild(el);

    const r = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8));
    let top = r.bottom + 4;
    if (top + el.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 4);
    el.style.left = left + 'px';
    el.style.top = top + 'px';

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      e.stopPropagation();
      closeMenu();
      items[Number(b.dataset.i)].onClick();
    });
    el.addEventListener('keydown', (e) => {
      const btns = [...el.querySelectorAll('.menu-item')];
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    });
    const outside = (e) => { if (!el.contains(e.target)) closeMenu(); };
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    menuCleanup = () => document.removeEventListener('mousedown', outside);
    openMenu = el;
    const first = el.querySelector('.menu-item');
    if (first) first.focus({ preventScroll: true });
  }

  const modals = [];

  function modal(opts) {
    const prevFocus = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML = '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '">'
      + (opts.title ? '<div class="modal-head"><h2>' + esc(opts.title) + '</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">' + icon('x') + '</button></div>' : '')
      + opts.body + '</div>';
    document.getElementById('modal-root').appendChild(scrim);
    const m = {
      el: scrim.querySelector('.modal'),
      close() {
        scrim.remove();
        modals.splice(modals.indexOf(m), 1);
        if (opts.onClose) opts.onClose();
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      },
    };
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) m.close(); });
    scrim.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) m.close(); });
    modals.push(m);
    return m;
  }

  // Ferme le calque le plus haut (menu puis modale). Renvoie true si quelque chose a été fermé.
  function closeTop() {
    if (closeMenu()) return true;
    if (modals.length) { modals[modals.length - 1].close(); return true; }
    return false;
  }

  function hasLayer() {
    return !!openMenu || modals.length > 0;
  }

  function isTyping(e) {
    const t = e.target;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  window.S = S;
  window.U = { icon, esc, toast, menu, closeMenu, modal, closeTop, hasLayer, isTyping, autosize, download, isMac };
  window.A = {};

  // ---------------------------------------------------------------- Composants

  const AREA = Object.fromEntries(M.AREAS.map((a) => [a.id, a]));
  const PRIO = Object.fromEntries(M.PRIORITIES.map((p) => [p.id, p]));
  const STATUS = Object.fromEntries(M.GOAL_STATUS.map((s) => [s.id, s]));
  const REPEAT_LABEL = Object.fromEntries([].concat(...Object.values(M.REPEATS)).concat(M.EVENT_REPEATS));

  const pct = (v) => Math.round(v * 100) + ' %';

  function progressBar(v, cls) {
    return '<div class="progress ' + (cls || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v * 100) + '">'
      + '<span style="transform:scaleX(' + Math.max(0, Math.min(1, v)).toFixed(3) + ')"></span></div>';
  }

  function dayLabel(key) {
    const ref = D.today();
    if (key === ref) return "Aujourd'hui";
    if (key === D.addDays(ref, 1)) return 'Demain';
    if (key === D.addDays(ref, -1)) return 'Hier';
    const s = D.formatShort(key);
    return key.slice(0, 4) === ref.slice(0, 4) ? s : s + ' ' + key.slice(0, 4);
  }

  // Libellé court de la liste d'une tâche (« Cette semaine », « 3 nov. », « Sans date »…).
  function listLabel(t) {
    if (t.scope === 'inbox') return 'Sans date';
    const rel = D.relativeLabel(t.scope, t.period);
    if (rel) return rel;
    if (t.scope === 'day') return dayLabel(t.period);
    if (t.scope === 'week') return 'Semaine ' + Number(t.period.slice(6));
    return D.periodLabel(t.scope, t.period);
  }

  function taskRow(t, opts) {
    opts = opts || {};
    const s = S.state;
    const meta = [];
    if (opts.showList) meta.push('<span class="meta">' + icon(t.scope === 'inbox' ? 'inbox' : t.scope) + esc(listLabel(t)) + '</span>');
    if (t.priority) {
      const p = PRIO[t.priority];
      meta.push('<span class="meta prio c-' + p.color + '">' + icon('flag') + p.label + '</span>');
    }
    if (t.due) {
      const st = M.dueStatus(t);
      meta.push('<span class="meta ' + (st || '') + '">' + icon('clock') + esc(dayLabel(t.due)) + (t.time ? ' · ' + t.time : '') + '</span>');
    } else if (t.time) {
      meta.push('<span class="meta">' + icon('clock') + t.time + '</span>');
    }
    if (t.repeat) meta.push('<span class="meta">' + icon('repeat') + esc(REPEAT_LABEL[t.repeat] || '') + '</span>');
    if (t.subtasks.length) {
      meta.push('<span class="meta">' + icon('list') + t.subtasks.filter((x) => x.done).length + '/' + t.subtasks.length + '</span>');
    }
    if (t.goalId && !opts.hideGoal) {
      const g = s.goals.find((x) => x.id === t.goalId);
      if (g) meta.push('<span class="meta">' + icon('target') + esc(g.title || 'Objectif') + '</span>');
    }
    t.tags.forEach((tag) => meta.push('<span class="meta">#' + esc(tag) + '</span>'));
    if (t.notes) meta.push('<span class="meta" title="Notes">' + icon('note') + '</span>');

    const actions = [];
    if (t.scope === 'day' && !opts.noFocus) {
      actions.push('<button type="button" class="icon-btn' + (t.focus ? ' on' : ' hide-touch') + '" data-act="focus-task" title="' + (t.focus ? 'Retirer du focus' : 'Ajouter au focus du jour') + '" aria-label="Focus du jour">' + icon(t.focus ? 'starFill' : 'star') + '</button>');
    }
    actions.push('<button type="button" class="icon-btn" data-act="move-task" title="Déplacer ou reporter" aria-label="Déplacer">' + icon('arrow') + '</button>');
    actions.push('<button type="button" class="icon-btn hide-touch" data-act="delete-task" title="Supprimer" aria-label="Supprimer">' + icon('trash') + '</button>');

    return '<div class="task' + (t.done ? ' done' : '') + '" data-act="open-task" data-id="' + t.id + '" tabindex="0"' + (opts.draggable ? ' draggable="true"' : '') + '>'
      + (opts.draggable ? '<span class="grip" aria-hidden="true">' + icon('grip') + '</span>' : '')
      + '<button type="button" class="check" data-act="toggle-task" aria-label="' + (t.done ? 'Marquer comme non terminée' : 'Marquer comme terminée') + '">' + icon('check') + '</button>'
      + '<div class="task-body"><div class="task-title">' + (t.title ? esc(t.title) : '<span class="muted">Sans titre</span>') + '</div>'
      + (meta.length ? '<div class="task-meta">' + meta.join('') + '</div>' : '') + '</div>'
      + '<div class="task-actions">' + actions.join('') + '</div></div>';
  }

  // Champ d'ajout rapide. `key` permet de garder le focus après l'ajout.
  function addRow(scope, period, opts) {
    opts = opts || {};
    const key = scope + ':' + (period || '') + (opts.focus ? ':focus' : '') + (opts.suffix || '');
    return '<form class="add-row" data-form="add-task" data-key="' + key + '" data-scope="' + scope + '" data-period="' + (period || '') + '"' + (opts.focus ? ' data-focus="1"' : '') + ' autocomplete="off">'
      + icon('plus') + '<input name="title" placeholder="' + esc(opts.placeholder || 'Ajouter une tâche') + '" aria-label="Nouvelle tâche" enterkeyhint="done"></form>'
      + '<div class="add-hint">Entrée pour ajouter · <span class="mono">#étiquette</span> · <span class="mono">!</span> à <span class="mono">!!!</span> pour la priorité</div>';
  }

  function goalCard(g, i) {
    const s = S.state;
    const area = AREA[g.area] || AREA.autre;
    const p = M.goalProgress(g, s);
    const parent = g.parentId && s.goals.find((x) => x.id === g.parentId);
    const foot = ['<b>' + pct(p.value) + '</b>'];
    if (g.metric && g.metric.target !== '' && g.metric.target != null) {
      foot.push(esc(g.metric.current || 0) + ' / ' + esc(g.metric.target) + (g.metric.unit ? ' ' + esc(g.metric.unit) : ''));
    } else if (g.milestones.length) {
      foot.push(g.milestones.filter((x) => x.done).length + '/' + g.milestones.length + ' jalons');
    }
    if (g.deadline && g.status === 'active') {
      const d = D.diffDays(D.today(), g.deadline);
      foot.push(d < 0 ? '<span class="late">Échéance dépassée</span>' : d === 0 ? "Échéance aujourd'hui" : d + ' j restants');
    }
    if (g.status !== 'active') foot.push(STATUS[g.status].label);
    return '<article class="goal-card' + (g.status === 'done' ? ' is-done' : '') + '" data-act="open-goal" data-id="' + g.id + '" tabindex="0" style="--i:' + (i || 0) + '">'
      + '<div class="goal-top"><span class="tag c-' + area.color + '">' + esc(area.label) + '</span><span class="period">' + esc(M.goalPeriodLabel(g)) + '</span></div>'
      + '<h3>' + (g.title ? esc(g.title) : '<span class="muted">Sans titre</span>') + '</h3>'
      + (g.why ? '<p class="goal-why">' + esc(g.why) + '</p>' : '')
      + progressBar(p.value)
      + '<div class="goal-foot">' + foot.join('<span aria-hidden="true">·</span>') + '</div>'
      + (parent ? '<div class="goal-parent">' + icon('parent') + esc(parent.title || 'Objectif parent') + '</div>' : '')
      + '</article>';
  }

  function empty(iconName, title, text) {
    return '<div class="empty">' + icon(iconName) + '<strong>' + esc(title) + '</strong>' + esc(text || '') + '</div>';
  }

  function timeRange(ev) {
    return ev.allDay ? 'Journée' : ev.start + ' – ' + ev.end;
  }

  window.C = { AREA, PRIO, STATUS, REPEAT_LABEL, pct, progressBar, dayLabel, listLabel, taskRow, addRow, goalCard, empty, timeRange };
})();
