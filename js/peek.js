// Panneau latéral d'édition (tâche, événement, objectif), comme une page Notion ouverte sur le côté.
(function () {
  'use strict';

  const { icon, esc } = U;
  const HZ = Object.fromEntries(M.HORIZONS.map((h) => [h.id, h]));
  const COLLECTION = { task: 'tasks', event: 'events', goal: 'goals' };

  let panel = null;
  let current = null; // { kind, id, opts }
  const stack = [];   // panneaux précédents (navigation objectif → tâche liée → retour)

  const find = (kind, id) => S.state[COLLECTION[kind]].find((x) => x.id === id);
  const created = (ts) => D.formatShort(D.toKey(new Date(ts))) + ' ' + new Date(ts).getFullYear();

  // Un élément créé puis laissé sans titre est supprimé à la fermeture.
  function cleanupNew(c) {
    if (!c || !c.opts.isNew) return;
    const item = find(c.kind, c.id);
    if (item && !item.title.trim()) {
      S.update((s) => { s[COLLECTION[c.kind]] = s[COLLECTION[c.kind]].filter((x) => x.id !== c.id); });
    }
  }

  const P = {
    get current() { return current; },

    open(kind, id, opts) {
      opts = opts || {};
      if (current && current.kind === kind && current.id === id) return;
      if (current && opts.fromPeek) stack.push(current);
      else {
        if (current) cleanupNew(current);
        stack.forEach(cleanupNew);
        stack.length = 0;
      }
      current = { kind, id, opts };
      P.render();
      requestAnimationFrame(() => panel.classList.add('open'));
      if (opts.isNew) setTimeout(() => { const t = panel.querySelector('.peek-title'); if (t) t.focus(); }, 80);
    },

    close() {
      if (!current) return;
      const closing = [current].concat(stack);
      current = null;
      stack.length = 0;
      panel.classList.remove('open');
      closing.forEach(cleanupNew);
    },

    back() {
      const prev = stack.pop();
      if (!prev) { P.close(); return; }
      const leaving = current;
      current = prev;
      cleanupNew(leaving);
      P.render();
    },

    render() {
      if (!current) return;
      const item = find(current.kind, current.id);
      if (!item) { P.close(); return; }
      const scroll = panel.querySelector('.peek-body');
      const top = scroll ? scroll.scrollTop : 0;
      panel.innerHTML = bar(item) + '<div class="peek-body">' + RENDER[current.kind](item, current.opts) + '</div>';
      panel.querySelectorAll('textarea').forEach(U.autosize);
      panel.querySelector('.peek-body').scrollTop = top;
    },
  };

  // ---------------------------------------------------------------- Gabarits

  const prop = (ic, label, val) => '<div class="prop"><div class="prop-label">' + icon(ic) + label + '</div><div class="prop-val">' + val + '</div></div>';

  function select(f, options, value, extra) {
    return '<select data-f="' + f + '"' + (extra || '') + '>' + options.map(([v, l]) =>
      '<option value="' + esc(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  }

  function checklist(items, prefix, addPlaceholder) {
    return '<div class="checklist">' + items.map((x) =>
      '<div class="check-item' + (x.done ? ' done' : '') + '">'
      + '<button type="button" class="check' + (x.done ? ' on' : '') + '" data-act="toggle-' + prefix + '" data-item="' + x.id + '" aria-label="Cocher">' + icon('check') + '</button>'
      + '<input type="text" data-f="' + prefix + ':' + x.id + '" value="' + esc(x.title) + '" aria-label="Intitulé">'
      + '<button type="button" class="icon-btn" data-act="remove-' + prefix + '" data-item="' + x.id + '" aria-label="Supprimer">' + icon('x') + '</button></div>').join('')
      + '<div class="add-row" style="padding-left:0">' + icon('plus') + '<input type="text" data-add="' + prefix + '" placeholder="' + esc(addPlaceholder) + '" aria-label="' + esc(addPlaceholder) + '"></div></div>';
  }

  function titleArea(item) {
    return '<textarea class="peek-title" data-f="title" rows="1" placeholder="Sans titre" aria-label="Titre">' + esc(item.title) + '</textarea>';
  }

  function bar(item) {
    const k = current.kind;
    const label = k === 'task' ? 'Tâche · ' + C.listLabel(item) : k === 'event' ? 'Événement' : 'Objectif · ' + HZ[item.horizon].label;
    return '<div class="peek-bar">'
      + (stack.length ? '<button type="button" class="icon-btn" data-act="peek-back" title="Retour" aria-label="Retour">' + icon('back') + '</button>' : '')
      + '<div class="peek-kind">' + icon(k === 'task' ? 'check' : k === 'event' ? 'calendar' : 'target') + esc(label) + '</div><div class="grow"></div>'
      + (k === 'task' ? '<button type="button" class="icon-btn" data-act="dup-task" title="Dupliquer" aria-label="Dupliquer">' + icon('copy') + '</button>' : '')
      + '<button type="button" class="icon-btn" data-act="peek-delete" title="Supprimer" aria-label="Supprimer">' + icon('trash') + '</button>'
      + '<button type="button" class="icon-btn" data-act="peek-close" title="Fermer (Échap)" aria-label="Fermer">' + icon('x') + '</button></div>';
  }

  function goalProgressBlock(g) {
    const p = M.goalProgress(g, S.state);
    return '<div class="pct">' + C.pct(p.value) + '</div><div style="flex:1">' + C.progressBar(p.value, 'lg')
      + '<small>' + (p.source ? 'Calculée depuis : ' + p.source.toLowerCase() : 'Ajoutez une mesure, des jalons, des sous-objectifs ou des tâches liées pour suivre la progression.') + '</small></div>';
  }

  const RENDER = {
    task(t) {
      const s = S.state;
      const periodDate = t.scope === 'inbox' ? '' : t.scope === 'day' ? t.period : D.periodRange(t.scope, t.period)[0];
      const goals = s.goals.filter((g) => g.status === 'active' || g.id === t.goalId);
      let h = '<div class="peek-title-row"><button type="button" class="check' + (t.done ? ' on' : '') + '" data-act="toggle-task" data-id="' + t.id + '" aria-label="Terminer">' + icon('check') + '</button>' + titleArea(t) + '</div>';
      h += '<div class="props">';
      h += prop(t.scope === 'inbox' ? 'inbox' : t.scope, 'Liste', select('scope', M.SCOPES.map((x) => [x, M.SCOPE_LABEL[x]]), t.scope, ' data-rerender'));
      if (t.scope !== 'inbox') {
        h += prop('calendar', 'Période', '<input type="date" data-f="periodDate" data-rerender value="' + periodDate + '" aria-label="Période">'
          + (t.scope !== 'day' ? '<span class="hint">' + esc(D.periodLabel(t.scope, t.period)) + '</span>' : ''));
      }
      h += prop('flag', 'Priorité', select('priority', M.PRIORITIES.map((p) => [p.id, p.label]), t.priority));
      h += prop('clock', t.scope === 'day' ? 'Heure · échéance' : 'Échéance',
        (t.scope !== 'day' ? '<input type="date" data-f="due" value="' + (t.due || '') + '" aria-label="Échéance">' : '')
        + '<input type="time" data-f="time" value="' + (t.time || '') + '" aria-label="Heure">'
        + (t.scope === 'day' ? '<input type="date" data-f="due" value="' + (t.due || '') + '" aria-label="Échéance">' : ''));
      if (t.scope !== 'inbox') h += prop('repeat', 'Répéter', select('repeat', [['', 'Ne se répète pas']].concat(M.REPEATS[t.scope]), t.repeat || '', ' data-rerender'));
      h += prop('tag', 'Étiquettes', '<input type="text" data-f="tags" value="' + esc(t.tags.join(', ')) + '" placeholder="sport, admin…" aria-label="Étiquettes">');
      h += prop('target', 'Objectif', select('goalId', [['', 'Aucun']].concat(goals.map((g) => [g.id, g.title || 'Sans titre'])), t.goalId || ''));
      if (t.scope === 'day') h += prop('star', 'Focus du jour', '<input type="checkbox" data-f="focus"' + (t.focus ? ' checked' : '') + ' aria-label="Focus du jour">');
      h += '</div>';
      h += '<div class="block-title"><span>Sous-tâches</span><span>' + (t.subtasks.length ? t.subtasks.filter((x) => x.done).length + '/' + t.subtasks.length : '') + '</span></div>'
        + checklist(t.subtasks, 'sub', 'Ajouter une sous-tâche');
      h += '<div class="block-title"><span>Notes</span></div><textarea class="note-area" data-f="notes" placeholder="Détails, liens, idées…" aria-label="Notes">' + esc(t.notes) + '</textarea>';
      if (t.repeat) h += '<div class="peek-info">' + icon('repeat') + '<span style="flex:1">Une fois cochée, la tâche réapparaît automatiquement à la période suivante.</span></div>';
      h += '<div class="peek-foot"><span>Créée le ' + created(t.createdAt) + (t.doneAt ? ' · terminée le ' + D.formatShort(t.doneAt) : '') + '</span></div>';
      return h;
    },

    event(e, opts) {
      let h = titleArea(e) + '<div class="props">';
      h += prop('calendar', 'Date', '<input type="date" data-f="date" data-rerender value="' + e.date + '" aria-label="Date">');
      h += prop('clock', 'Journée entière', '<input type="checkbox" data-f="allDay" data-rerender' + (e.allDay ? ' checked' : '') + ' aria-label="Journée entière">');
      if (!e.allDay) {
        h += prop('clock', 'Horaire', '<input type="time" data-f="start" data-rerender value="' + e.start + '" aria-label="Début"><span class="hint">à</span><input type="time" data-f="end" data-rerender value="' + e.end + '" aria-label="Fin">');
      }
      if (!e.repeat) {
        h += prop('arrow', "Jusqu'au", '<input type="date" data-f="endDate" data-rerender value="' + (e.endDate || '') + '" min="' + e.date + '" aria-label="Date de fin"><span class="hint">sur plusieurs jours</span>');
      }
      h += prop('repeat', 'Répéter', select('repeat', M.EVENT_REPEATS, e.repeat || '', ' data-rerender'));
      if (e.repeat) h += prop('repeat', 'Fin de la série', '<input type="date" data-f="repeatUntil" value="' + (e.repeatUntil || '') + '" min="' + e.date + '" aria-label="Fin de la série"><span class="hint">vide = sans fin</span>');
      h += prop('palette', 'Couleur', '<div class="swatches">' + M.EVENT_COLORS.map((c) =>
        '<button type="button" class="swatch c-' + c + (e.color === c ? ' on' : '') + '" data-act="ev-color" data-color="' + c + '" aria-label="' + c + '"></button>').join('') + '</div>');
      h += prop('pin', 'Lieu', '<input type="text" data-f="location" value="' + esc(e.location) + '" placeholder="Adresse, salle, lien…" aria-label="Lieu">');
      h += '</div>';
      if (e.repeat && opts.date) {
        h += '<div class="peek-info"><span>Événement récurrent : les modifications s\'appliquent à toute la série.</span>'
          + '<button type="button" class="btn btn-sm" data-act="skip-occurrence">Retirer le ' + D.formatShort(opts.date) + ' seulement</button></div>';
      }
      h += '<div class="block-title"><span>Notes</span></div><textarea class="note-area" data-f="notes" placeholder="Ordre du jour, personnes, liens…" aria-label="Notes">' + esc(e.notes) + '</textarea>';
      h += '<div class="peek-foot"><span>Créé le ' + created(e.createdAt) + '</span></div>';
      return h;
    },

    goal(g) {
      const s = S.state;
      const h0 = HZ[g.horizon];
      const children = s.goals.filter((c) => c.parentId === g.id);
      const linked = s.tasks.filter((t) => t.goalId === g.id).sort((a, b) => a.done - b.done || a.order - b.order);
      const parents = M.parentCandidates(s, g);
      let h = titleArea(g) + '<div class="big-progress" id="goal-progress">' + goalProgressBlock(g) + '</div><div class="props">';
      h += prop('status', 'Statut', select('status', M.GOAL_STATUS.map((x) => [x.id, x.label]), g.status, ' data-rerender'));
      h += prop('year', 'Horizon', select('horizon', M.HORIZONS.map((x) => [x.id, x.label]), g.horizon, ' data-rerender'));
      if (h0.scope) {
        h += prop('calendar', 'Période', '<input type="date" data-f="periodDate" data-rerender value="' + (g.period ? D.periodRange(h0.scope, g.period)[0] : '') + '" aria-label="Période">'
          + '<span class="hint">' + esc(M.goalPeriodLabel(g)) + '</span>');
      }
      h += prop('grid', 'Domaine', select('area', M.AREAS.map((a) => [a.id, a.label]), g.area));
      h += prop('clock', 'Échéance', '<input type="date" data-f="deadline" value="' + (g.deadline || '') + '" aria-label="Échéance">');
      h += prop('parent', 'Contribue à', select('parentId', [['', 'Aucun objectif']].concat(parents.map((p) => [p.id, (p.title || 'Sans titre') + ' · ' + HZ[p.horizon].label])), g.parentId || ''));
      h += '</div>';

      h += '<div class="block-title"><span>Pourquoi c\'est important</span></div>'
        + '<textarea class="note-area why-area" data-f="why" placeholder="Ce que cet objectif changera pour moi…" aria-label="Pourquoi">' + esc(g.why) + '</textarea>';

      h += '<div class="block-title"><span>Mesure</span>' + (g.metric ? '<button type="button" class="btn btn-ghost btn-sm" data-act="metric-off">Retirer</button>' : '') + '</div>';
      if (g.metric) {
        const m = g.metric;
        const field = (k, label, type) => '<label>' + label + '<input type="' + type + '" data-f="m:' + k + '" value="' + esc(m[k] == null ? '' : m[k]) + '"' + (type === 'number' ? ' step="any"' : '') + '></label>';
        h += '<div class="metric">' + field('start', 'Départ', 'number') + field('current', 'Actuel', 'number') + field('target', 'Cible', 'number') + field('unit', 'Unité', 'text') + '</div>'
          + '<div class="metric-step"><button type="button" class="btn btn-sm" data-act="metric-step" data-step="-1">− 1</button><button type="button" class="btn btn-sm" data-act="metric-step" data-step="1">+ 1</button></div>';
      } else {
        h += '<p class="muted" style="font-size:13.5px;margin:4px 0 8px">Suivez une valeur chiffrée : livres lus, kilos, euros épargnés, kilomètres…</p>'
          + '<button type="button" class="btn btn-sm" data-act="metric-on">' + icon('chart') + 'Ajouter une mesure</button>';
      }

      h += '<div class="block-title"><span>Jalons</span><span>' + (g.milestones.length ? g.milestones.filter((x) => x.done).length + '/' + g.milestones.length : '') + '</span></div>'
        + checklist(g.milestones, 'ms', 'Ajouter un jalon');

      if (M.HORIZON_RANK[g.horizon] > 0) {
        h += '<div class="block-title"><span>Sous-objectifs</span><button type="button" class="btn btn-ghost btn-sm" data-act="new-child-goal">' + icon('plus') + 'Ajouter</button></div>'
          + (children.length ? children.map((c) => {
            const p = M.goalProgress(c, s);
            return '<div class="child-goal" data-act="open-goal" data-id="' + c.id + '" tabindex="0"><span class="tag c-' + (C.STATUS[c.status].color) + '">' + HZ[c.horizon].label + '</span>'
              + '<span class="t">' + esc(c.title || 'Sans titre') + '</span>' + C.progressBar(p.value) + '<small>' + C.pct(p.value) + '</small></div>';
          }).join('') : '<p class="muted" style="font-size:13.5px;margin:4px 0">Découpez cet objectif en objectifs plus courts.</p>');
      }

      h += '<div class="block-title"><span>Tâches liées</span><span>' + (linked.length ? linked.filter((t) => t.done).length + '/' + linked.length : '') + '</span></div>'
        + '<div class="task-list linked-list">' + linked.map((t) => C.taskRow(t, { showList: true, hideGoal: true, noFocus: true })).join('') + '</div>'
        + '<div class="add-row">' + icon('plus') + '<input type="text" data-add="linked" placeholder="Ajouter une tâche liée (dans « Sans date »)" aria-label="Ajouter une tâche liée"></div>';

      h += '<div class="block-title"><span>Notes et bilan</span></div><textarea class="note-area" data-f="notes" placeholder="Obstacles, apprentissages, bilan…" aria-label="Notes">' + esc(g.notes) + '</textarea>';
      h += '<div class="peek-foot"><span>Créé le ' + created(g.createdAt) + (g.doneAt ? ' · atteint le ' + D.formatShort(g.doneAt) : '') + '</span>'
        + '<button type="button" class="btn ' + (g.status === 'done' ? '' : 'btn-primary') + ' btn-sm" data-act="goal-done">' + icon('check') + (g.status === 'done' ? 'Rouvrir' : 'Marquer comme atteint') + '</button></div>';
      return h;
    },
  };

  // ---------------------------------------------------------------- Modifications

  const SET = {
    task(t, f, v) {
      if (f.startsWith('sub:')) { const x = t.subtasks.find((st) => st.id === f.slice(4)); if (x) x.title = v; return; }
      switch (f) {
        case 'title': case 'notes': t[f] = v; break;
        case 'scope': {
          let base = D.today();
          if (t.scope !== 'inbox' && t.period) {
            const [a, b] = D.periodRange(t.scope, t.period);
            if (base < a || base > b) base = a;
          }
          M.moveTask(t, v, v === 'inbox' ? null : D.periodOf(v, base));
          break;
        }
        case 'periodDate': if (v) t.period = D.periodOf(t.scope, v); break;
        case 'priority': t.priority = Number(v); break;
        case 'due': t.due = v || null; break;
        case 'time': t.time = v || null; break;
        case 'repeat': t.repeat = v || null; break;
        case 'tags': t.tags = v.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean); break;
        case 'goalId': t.goalId = v || null; break;
        case 'focus': t.focus = !!v; break;
      }
    },
    event(e, f, v) {
      switch (f) {
        case 'title': case 'notes': case 'location': e[f] = v; break;
        case 'date':
          if (!v) break;
          e.date = v;
          if (e.endDate && e.endDate <= v) e.endDate = null;
          if (e.repeatUntil && e.repeatUntil < v) e.repeatUntil = null;
          break;
        case 'endDate': e.endDate = v && v > e.date ? v : null; break;
        case 'allDay': e.allDay = !!v; break;
        case 'start':
          if (!v) break;
          e.start = v;
          if (D.timeToMin(e.end) <= D.timeToMin(v)) e.end = D.minToTime(D.timeToMin(v) + 60);
          break;
        case 'end':
          if (!v) break;
          e.end = D.timeToMin(v) > D.timeToMin(e.start) ? v : D.minToTime(D.timeToMin(e.start) + 30);
          break;
        case 'repeat': e.repeat = v || null; if (e.repeat) e.endDate = null; break;
        case 'repeatUntil': e.repeatUntil = v || null; break;
      }
    },
    goal(g, f, v, s) {
      if (f.startsWith('ms:')) { const x = g.milestones.find((m) => m.id === f.slice(3)); if (x) x.title = v; return; }
      if (f.startsWith('m:')) {
        const k = f.slice(2);
        g.metric[k] = k === 'unit' ? v : v === '' ? '' : Number(v);
        return;
      }
      switch (f) {
        case 'title': case 'why': case 'notes': g[f] = v; break;
        case 'status': g.status = v; g.doneAt = v === 'done' ? D.today() : null; break;
        case 'horizon': {
          g.horizon = v;
          g.period = HZ[v].scope ? D.periodOf(HZ[v].scope, D.today()) : null;
          const p = g.parentId && s.goals.find((x) => x.id === g.parentId);
          if (!p || M.HORIZON_RANK[p.horizon] <= M.HORIZON_RANK[v]) g.parentId = null;
          break;
        }
        case 'periodDate': if (v && HZ[g.horizon].scope) g.period = D.periodOf(HZ[g.horizon].scope, v); break;
        case 'area': g.area = v; break;
        case 'deadline': g.deadline = v || null; break;
        case 'parentId': g.parentId = v || null; break;
      }
    },
  };

  function onField(e) {
    const el = e.target.closest('[data-f]');
    if (!el || !current) return;
    const isText = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number'));
    if (e.type === 'input' && !isText) return;
    if (e.type === 'change' && isText) return;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    const { kind, id } = current;
    S.update((s) => { const item = find(kind, id); if (item) SET[kind](item, el.dataset.f, val, s); });
    if (el.tagName === 'TEXTAREA') U.autosize(el);
    if ('rerender' in el.dataset) P.render();
    else if (kind === 'goal') {
      const block = panel.querySelector('#goal-progress');
      if (block) block.innerHTML = goalProgressBlock(find(kind, id));
    }
  }

  function addItem(type, text) {
    const { kind, id } = current;
    S.update((s) => {
      const item = find(kind, id);
      if (!item) return;
      if (type === 'sub') item.subtasks.push({ id: M.uid(), title: text, done: false });
      if (type === 'ms') item.milestones.push({ id: M.uid(), title: text, done: false });
      if (type === 'linked') {
        const q = M.parseQuickTitle(text);
        s.tasks.push(M.newTask({ title: q.title || text, tags: q.tags, priority: q.priority, goalId: item.id }));
      }
    });
  }

  function onKey(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (t.classList.contains('peek-title')) { e.preventDefault(); t.blur(); return; }
    if (t.dataset.add) {
      e.preventDefault();
      const v = t.value.trim();
      if (!v) return;
      const type = t.dataset.add;
      addItem(type, v);
      P.render();
      const next = panel.querySelector('[data-add="' + type + '"]');
      if (next) next.focus();
      return;
    }
    const f = t.dataset.f || '';
    if (f.startsWith('sub:') || f.startsWith('ms:')) {
      e.preventDefault();
      const add = t.closest('.checklist').querySelector('[data-add]');
      if (add) add.focus();
    }
  }

  // ---------------------------------------------------------------- Actions du panneau

  const item = () => current && find(current.kind, current.id);
  const toggleIn = (list, id) => { const x = list.find((y) => y.id === id); if (x) x.done = !x.done; };

  Object.assign(A, {
    'peek-close': () => P.close(),
    'peek-back': () => P.back(),
    'peek-delete'() {
      const { kind, id } = current;
      P.close();
      if (!find(kind, id)) return; // élément vide déjà retiré à la fermeture
      const label = { task: 'Tâche supprimée', event: 'Événement supprimé', goal: 'Objectif supprimé' }[kind];
      S.undoable(label, (s) => {
        s[COLLECTION[kind]] = s[COLLECTION[kind]].filter((x) => x.id !== id);
        if (kind === 'goal') {
          s.goals.forEach((g) => { if (g.parentId === id) g.parentId = null; });
          s.tasks.forEach((t) => { if (t.goalId === id) t.goalId = null; });
        }
      });
    },
    'dup-task'() {
      const t = item();
      const copy = M.newTask(JSON.parse(JSON.stringify(t)));
      Object.assign(copy, { id: M.uid(), title: t.title + ' (copie)', done: false, doneAt: null, spawnedId: null, createdAt: Date.now(), order: Date.now() });
      copy.subtasks.forEach((x) => { x.id = M.uid(); x.done = false; });
      S.update((s) => s.tasks.push(copy));
      P.open('task', copy.id, { fromPeek: true });
      U.toast('Tâche dupliquée');
    },
    'toggle-sub': (el) => S.update(() => toggleIn(item().subtasks, el.dataset.item)),
    'remove-sub': (el) => S.update(() => { const t = item(); t.subtasks = t.subtasks.filter((x) => x.id !== el.dataset.item); }),
    'toggle-ms': (el) => S.update(() => toggleIn(item().milestones, el.dataset.item)),
    'remove-ms': (el) => S.update(() => { const g = item(); g.milestones = g.milestones.filter((x) => x.id !== el.dataset.item); }),
    'ev-color': (el) => S.update(() => { item().color = el.dataset.color; }),
    'skip-occurrence'() {
      const date = current.opts.date;
      const id = current.id;
      P.close();
      S.undoable('Occurrence du ' + D.formatShort(date) + ' retirée', (s) => {
        const e = s.events.find((x) => x.id === id);
        if (e && !e.exceptions.includes(date)) e.exceptions.push(date);
      });
    },
    'metric-on': () => S.update(() => { item().metric = { start: 0, current: 0, target: '', unit: '' }; }),
    'metric-off': () => S.update(() => { item().metric = null; }),
    'metric-step': (el) => S.update(() => {
      const m = item().metric;
      m.current = Math.round((Number(m.current || 0) + Number(el.dataset.step)) * 1000) / 1000;
    }),
    'goal-done'() {
      const g = item();
      const done = g.status !== 'done';
      S.update(() => { g.status = done ? 'done' : 'active'; g.doneAt = done ? D.today() : null; });
      if (done) U.toast('Bravo, objectif atteint');
    },
    'new-child-goal'() {
      const g = item();
      const rank = Math.max(0, M.HORIZON_RANK[g.horizon] - 1);
      const h = M.HORIZONS[rank];
      const child = M.newGoal({ horizon: h.id, period: h.scope ? D.periodOf(h.scope, D.today()) : null, parentId: g.id, area: g.area });
      S.update((s) => s.goals.push(child));
      P.open('goal', child.id, { isNew: true, fromPeek: true });
    },
  });

  // ---------------------------------------------------------------- Montage

  P.mount = function () {
    panel = document.createElement('aside');
    panel.className = 'peek';
    panel.setAttribute('aria-label', 'Détail');
    document.getElementById('peek-root').appendChild(panel);
    panel.addEventListener('input', onField);
    panel.addEventListener('change', onField);
    panel.addEventListener('keydown', onKey);
    // Clic en dehors du panneau : fermeture (sauf menus, modales, notifications).
    document.addEventListener('mousedown', (e) => {
      if (!current || panel.contains(e.target)) return;
      if (e.target.closest('.menu, .modal-scrim, .toast, .fab')) return;
      P.close();
    });
  };

  window.P = P;
})();
