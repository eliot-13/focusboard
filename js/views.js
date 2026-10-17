// Vues principales : Aujourd'hui, Tâches, Calendrier, Objectifs.
// Chaque vue expose render(route) → HTML et, si besoin, mount(élément, route, nouvelleRoute).
(function () {
  'use strict';

  const { icon, esc } = U;
  const V = {};
  const HOUR_H = 48;

  const nowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

  // ================================================================ Aujourd'hui

  V.today = {
    title: () => "Aujourd'hui",
    render() {
      const s = S.state;
      const ref = D.today();
      const h = new Date().getHours();
      const greet = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
      const name = s.settings.name ? ', ' + esc(s.settings.name) : '';

      const dayTasks = M.sortTasks(M.tasksIn(s, 'day', ref), s.settings.sort);
      const undone = dayTasks.filter((t) => !t.done);
      const doneToday = dayTasks.filter((t) => t.done);
      const overdue = M.overdueTasks(s, 'day', ref);
      const dueToday = s.tasks.filter((t) => t.due === ref && !(t.scope === 'day' && t.period === ref));
      const lateDue = s.tasks.filter((t) => !t.done && t.due && t.due < ref && t.scope !== 'day');
      const events = M.eventsOn(s, ref);
      const focus = dayTasks.filter((t) => t.focus).slice(0, 3);
      const completed = s.tasks.filter((t) => t.doneAt === ref).length;

      const stats = [
        '<span><b>' + undone.length + '</b> ' + (undone.length > 1 ? 'tâches restantes' : 'tâche restante') + '</span>',
        '<span><b>' + events.length + '</b> ' + (events.length > 1 ? 'événements' : 'événement') + '</span>',
        '<span><b>' + completed + '</b> ' + (completed > 1 ? 'terminées' : 'terminée') + " aujourd'hui</span>",
      ];
      if (overdue.length + lateDue.length) stats.push('<span style="color:var(--red-tx)"><b style="color:inherit">' + (overdue.length + lateDue.length) + '</b> en retard</span>');

      // Focus du jour : 3 emplacements
      let slots = '';
      for (let i = 0; i < 3; i++) {
        const t = focus[i];
        slots += t
          ? '<div class="focus-slot focus-task' + (t.done ? ' done' : '') + '" data-act="open-task" data-id="' + t.id + '" tabindex="0">'
            + '<button type="button" class="check" data-act="toggle-task" aria-label="Terminer">' + icon('check') + '</button>'
            + '<span class="focus-text">' + esc(t.title || 'Sans titre') + '</span>'
            + '<button type="button" class="icon-btn" data-act="focus-task" title="Retirer du focus" aria-label="Retirer du focus">' + icon('x') + '</button></div>'
          : '<button type="button" class="focus-slot" data-act="pick-focus"><span class="num">' + (i + 1) + '</span>Choisir une priorité</button>';
      }

      // Agenda du jour : événements + tâches avec heure
      const nowMin = nowMinutes();
      const agendaItems = events.map((e) => ({ sort: e.allDay ? '' : e.start, html:
        '<div class="mini-ev c-' + e.color + (!e.allDay && D.timeToMin(e.end) < nowMin ? ' past' : '') + '" data-act="open-event" data-id="' + e.id + '" data-date="' + ref + '" tabindex="0">'
        + '<time>' + (e.allDay ? 'Journée' : e.start) + '</time><div><div class="t"><span class="dot"></span><span>' + esc(e.title || 'Sans titre') + '</span></div>'
        + (e.location || !e.allDay ? '<small>' + (e.allDay ? '' : e.start + ' – ' + e.end) + (e.location ? (e.allDay ? '' : ' · ') + esc(e.location) : '') + '</small>' : '') + '</div></div>' }))
        .concat(dayTasks.filter((t) => t.time).map((t) => ({ sort: t.time, html:
          '<div class="mini-ev" data-act="open-task" data-id="' + t.id + '" tabindex="0"><time>' + t.time + '</time><div class="t">'
          + '<span class="dot" style="background:var(--faint)"></span><span' + (t.done ? ' style="text-decoration:line-through;color:var(--faint)"' : '') + '>' + esc(t.title || 'Sans titre') + '</span></div></div>' })))
        .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
      const tomorrow = M.eventsOn(s, D.addDays(ref, 1)).length;

      // Avancement des listes en cours
      const periodRow = (scope, label) => {
        const p = D.periodOf(scope, ref);
        const list = M.tasksIn(s, scope, p);
        const done = list.filter((t) => t.done).length;
        return '<a class="goal-mini" href="#/tasks/' + scope + '/' + p + '" style="display:block"><div class="goal-mini-row"><span>' + label + '</span><span>' + done + '/' + list.length + '</span></div>'
          + C.progressBar(list.length ? done / list.length : 0) + '</a>';
      };
      const weekUndone = M.sortTasks(M.tasksIn(s, 'week', D.periodOf('week', ref)).filter((t) => !t.done), 'priority').slice(0, 3);

      // Objectifs actifs : échéance la plus proche d'abord
      const goals = s.goals.filter((g) => g.status === 'active').sort((a, b) => {
        const da = a.deadline || '9999', db = b.deadline || '9999';
        return da < db ? -1 : da > db ? 1 : M.HORIZON_RANK[a.horizon] - M.HORIZON_RANK[b.horizon];
      }).slice(0, 5);

      const doneOpen = s.settings.showDone;

      return '<header class="page-head">'
        + '<div class="crumb">' + icon('today') + "Aujourd'hui</div>"
        + '<h1 class="page-title">' + greet + name + '.</h1>'
        + '<p class="page-sub">' + D.cap(D.formatLong(ref)) + ' · Semaine ' + D.isoWeek(ref).week + '</p>'
        + '<div class="today-stats">' + stats.join('') + '</div></header>'
        + '<div class="today-grid"><div class="today-col">'

        + '<section class="card" style="--i:0"><div class="card-head"><div class="card-title">' + icon('star') + 'Focus du jour</div>'
        + '<span class="muted" style="font-size:12.5px">Les trois choses qui comptent</span></div>'
        + '<div class="focus-slots">' + slots + '</div></section>'

        + '<section class="card" style="--i:1"><div class="card-head"><div class="card-title">' + icon('day') + 'Tâches du jour</div>'
        + '<a class="card-link" href="#/tasks/day/' + ref + '">Ouvrir la liste' + icon('right') + '</a></div>'
        + (dayTasks.length ? '<div class="stat" style="margin-bottom:8px">' + C.progressBar(doneToday.length / dayTasks.length) + '<span>' + doneToday.length + '/' + dayTasks.length + '</span></div>' : '')
        + '<div class="task-list">' + undone.map((t) => C.taskRow(t)).join('') + '</div>'
        + C.addRow('day', ref, { placeholder: "Ajouter une tâche pour aujourd'hui" })
        + (overdue.length ? '<div class="notice"><span>' + plural(overdue.length, 'tâche non terminée', 'tâches non terminées') + ' des jours précédents</span>'
          + '<button type="button" class="btn btn-sm" data-act="reschedule" data-scope="day" data-to="' + ref + '">Reporter à aujourd\'hui</button></div>'
          + '<div class="task-list">' + overdue.map((t) => C.taskRow(t, { showList: true })).join('') + '</div>' : '')
        + (lateDue.length ? '<div class="section-head"><span>Échéances dépassées</span></div><div class="task-list">' + lateDue.map((t) => C.taskRow(t, { showList: true })).join('') + '</div>' : '')
        + (dueToday.length ? '<div class="section-head"><span>À rendre aujourd\'hui · autres listes</span></div><div class="task-list">' + dueToday.map((t) => C.taskRow(t, { showList: true })).join('') + '</div>' : '')
        + (doneToday.length ? '<div class="section-head"><button type="button" class="collapse' + (doneOpen ? '' : ' closed') + '" data-act="toggle-done">' + icon('down') + 'Terminées · ' + doneToday.length + '</button></div>'
          + (doneOpen ? '<div class="task-list">' + doneToday.map((t) => C.taskRow(t)).join('') + '</div>' : '') : '')
        + '</section></div>'

        + '<div class="today-col">'
        + '<section class="card" style="--i:2"><div class="card-head"><div class="card-title">' + icon('calendar') + 'Agenda</div>'
        + '<button type="button" class="icon-btn" data-act="new-event" data-date="' + ref + '" title="Nouvel événement" aria-label="Nouvel événement">' + icon('plus') + '</button></div>'
        + (agendaItems.length ? '<div class="mini-agenda">' + agendaItems.map((x) => x.html).join('') + '</div>' : '<p class="muted" style="margin:0;font-size:13.5px">Rien de prévu aujourd\'hui.</p>')
        + '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12.5px"><span class="muted">Demain : ' + plural(tomorrow, 'événement', 'événements') + '</span>'
        + '<a class="card-link" href="#/calendar/week/' + ref + '">Calendrier' + icon('right') + '</a></div></section>'

        + '<section class="card" style="--i:3"><div class="card-head"><div class="card-title">' + icon('week') + 'Périodes en cours</div></div>'
        + periodRow('week', 'Cette semaine') + periodRow('month', 'Ce mois-ci') + periodRow('year', 'Cette année')
        + (weekUndone.length ? '<div class="section-head" style="margin-top:14px;padding:0"><span>À faire cette semaine</span></div><div class="task-list">' + weekUndone.map((t) => C.taskRow(t)).join('') + '</div>' : '')
        + '</section>'

        + '<section class="card" style="--i:4"><div class="card-head"><div class="card-title">' + icon('target') + 'Objectifs en cours</div>'
        + '<a class="card-link" href="#/goals">Tout voir' + icon('right') + '</a></div>'
        + (goals.length
          ? goals.map((g) => {
            const p = M.goalProgress(g, s);
            return '<div class="goal-mini" data-act="open-goal" data-id="' + g.id + '" tabindex="0"><div class="goal-mini-row"><span>' + esc(g.title || 'Sans titre') + '</span><span>' + C.pct(p.value) + '</span></div>' + C.progressBar(p.value) + '</div>';
          }).join('')
          : '<p class="muted" style="margin:0 0 10px;font-size:13.5px">Aucun objectif en cours.</p><button type="button" class="btn btn-sm" data-act="new-goal">' + icon('plus') + 'Définir un objectif</button>')
        + '</section></div></div>';
    },
  };

  // ================================================================ Tâches

  const SCOPE_NAV = [['inbox', 'Sans date'], ['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']];
  const CURRENT_LABEL = { day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', year: 'Cette année' };
  const EMPTY_TEXT = {
    inbox: 'Notez ici tout ce qui vous passe par la tête. Vous le planifierez plus tard.',
    day: 'Ajoutez ce que vous voulez accomplir ce jour-là.',
    week: 'Les tâches à boucler dans la semaine, sans jour précis.',
    month: 'Ce qui doit être fait dans le mois.',
    year: "Les grands chantiers de l'année.",
  };

  V.tasks = {
    title: (r) => (r.scope === 'inbox' ? 'Sans date' : 'Tâches · ' + M.SCOPE_LABEL[r.scope]),
    render(r) {
      const s = S.state;
      const ref = D.today();
      const scope = r.scope;
      const cur = scope === 'inbox' ? null : D.periodOf(scope, ref);
      const period = scope === 'inbox' ? null : r.period || cur;
      const all = M.tasksIn(s, scope, period);
      const sort = s.settings.sort;
      const undone = M.sortTasks(all.filter((t) => !t.done), sort);
      const done = all.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
      const rel = period && D.relativeLabel(scope, period);
      const title = scope === 'inbox' ? 'Sans date' : rel || D.periodLabel(scope, period);
      const sub = scope === 'inbox' ? EMPTY_TEXT.inbox : rel ? D.periodLabel(scope, period) : '';

      let html = '<header class="page-head"><div class="crumb">' + icon(scope === 'inbox' ? 'inbox' : scope) + 'Tâches · ' + M.SCOPE_LABEL[scope] + '</div>'
        + '<div class="page-head-row"><div><h1 class="page-title">' + esc(title) + '</h1>' + (sub ? '<p class="page-sub">' + esc(sub) + '</p>' : '') + '</div>';
      if (scope !== 'inbox') {
        html += '<div class="period-nav">'
          + '<a class="icon-btn" href="#/tasks/' + scope + '/' + D.shiftPeriod(scope, period, -1) + '" title="Période précédente" aria-label="Période précédente">' + icon('left') + '</a>'
          + '<a class="btn btn-sm" href="#/tasks/' + scope + '/' + cur + '">' + CURRENT_LABEL[scope] + '</a>'
          + '<a class="icon-btn" href="#/tasks/' + scope + '/' + D.shiftPeriod(scope, period, 1) + '" title="Période suivante" aria-label="Période suivante">' + icon('right') + '</a></div>';
      }
      html += '</div></header>';

      html += '<div class="toolbar"><nav class="seg" aria-label="Listes">' + SCOPE_NAV.map(([id, l]) => '<a href="#/tasks/' + id + '" class="' + (id === scope ? 'on' : '') + '">' + l + '</a>').join('') + '</nav>'
        + '<div class="grow"></div>'
        + (all.length ? '<div class="stat">' + C.progressBar(done.length / all.length) + '<span>' + done.length + '/' + all.length + '</span></div>' : '')
        + '<select class="select-inline" data-change="sort" aria-label="Trier">'
        + [['manual', 'Ordre manuel'], ['priority', 'Par priorité'], ['due', 'Par échéance']].map(([v, l]) => '<option value="' + v + '"' + (sort === v ? ' selected' : '') + '>' + l + '</option>').join('')
        + '</select></div>';

      // Agenda du jour dans la liste du jour
      if (scope === 'day') {
        const evs = M.eventsOn(s, period);
        if (evs.length) {
          html += '<div class="card" style="padding:10px 16px;margin:14px 0 6px"><div class="mini-agenda">' + evs.map((e) =>
            '<div class="mini-ev c-' + e.color + '" data-act="open-event" data-id="' + e.id + '" data-date="' + period + '" tabindex="0"><time>' + (e.allDay ? 'Journée' : e.start) + '</time>'
            + '<div class="t"><span class="dot"></span><span>' + esc(e.title || 'Sans titre') + '</span></div></div>').join('') + '</div></div>';
        }
      }

      // Aperçu des jours dans la liste de la semaine
      if (scope === 'week') {
        const start = D.weekKeyStart(period);
        html += '<div class="week-strip">';
        for (let i = 0; i < 7; i++) {
          const k = D.addDays(start, i);
          const list = M.tasksIn(s, 'day', k);
          const n = list.filter((t) => t.done).length;
          html += '<a class="wday' + (k === ref ? ' today' : '') + '" href="#/tasks/day/' + k + '"><span>' + D.DAYS_SHORT[D.weekday(k)] + '</span><b>' + Number(k.slice(8)) + '</b>'
            + '<small>' + (list.length ? n + '/' + list.length : '–') + '</small></a>';
        }
        html += '</div>';
      }

      // Retards
      if (scope !== 'inbox' && period === cur) {
        const overdue = M.overdueTasks(s, scope, ref);
        if (overdue.length) {
          html += '<div class="notice"><span>' + plural(overdue.length, 'tâche non terminée', 'tâches non terminées') + ' des périodes précédentes</span>'
            + '<button type="button" class="btn btn-sm" data-act="reschedule" data-scope="' + scope + '" data-to="' + cur + '">Tout reporter ici</button></div>'
            + '<div class="task-list">' + overdue.map((t) => C.taskRow(t, { showList: true })).join('') + '</div>'
            + '<div class="section-head"><span>' + esc(title) + '</span></div>';
        }
      }
      if (scope !== 'inbox' && period < cur && undone.length) {
        html += '<div class="notice"><span>Période passée · ' + plural(undone.length, 'tâche non terminée', 'tâches non terminées') + '</span>'
          + '<button type="button" class="btn btn-sm" data-act="reschedule" data-scope="' + scope + '" data-from="' + period + '" data-to="' + cur + '">Reporter : ' + CURRENT_LABEL[scope].toLowerCase() + '</button></div>';
      }

      if (!all.length) {
        html += C.addRow(scope, period) + C.empty(scope === 'inbox' ? 'inbox' : scope, 'Rien pour l\'instant', EMPTY_TEXT[scope]);
      } else {
        html += '<div class="task-list">' + undone.map((t) => C.taskRow(t, { draggable: sort === 'manual' })).join('') + '</div>' + C.addRow(scope, period);
      }

      if (done.length) {
        const open = s.settings.showDone;
        html += '<div class="section-head"><button type="button" class="collapse' + (open ? '' : ' closed') + '" data-act="toggle-done">' + icon('down') + 'Terminées · ' + done.length + '</button></div>'
          + (open ? '<div class="task-list">' + done.map((t) => C.taskRow(t)).join('') + '</div>' : '');
      }
      return html;
    },
  };

  // ================================================================ Calendrier

  const CAL_MODES = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['agenda', 'Agenda']];

  // Événements + tâches datées d'un jour, triés : journée entière, horaires, tâches sans heure.
  function dayItems(s, k, withTasks) {
    const evs = M.eventsOn(s, k).map((ev) => ({ kind: 'event', ev, sort: ev.allDay ? '' : ev.start }));
    const tasks = withTasks ? M.tasksOn(s, k).map((t) => ({ kind: 'task', task: t, sort: t.time || '99' })) : [];
    return evs.concat(tasks).sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  }

  function calItem(it, k) {
    if (it.kind === 'event') {
      const e = it.ev;
      const title = esc(e.title || 'Sans titre');
      return e.allDay
        ? '<button type="button" class="cal-item ev-allday c-' + e.color + '" data-act="open-event" data-id="' + e.id + '" data-date="' + k + '" title="' + title + '"><span>' + title + '</span></button>'
        : '<button type="button" class="cal-item ev-timed c-' + e.color + '" data-act="open-event" data-id="' + e.id + '" data-date="' + k + '" title="' + e.start + ' ' + title + '"><span class="dot"></span><time>' + e.start + '</time><span>' + title + '</span></button>';
    }
    const t = it.task;
    const title = esc(t.title || 'Sans titre');
    return '<button type="button" class="cal-item task-item' + (t.done ? ' done' : '') + '" data-act="open-task" data-id="' + t.id + '" title="' + title + '">'
      + '<span class="mini-check" data-act="toggle-task">' + icon('check') + '</span>' + (t.time ? '<time>' + t.time + '</time>' : '') + '<span>' + title + '</span></button>';
  }

  function monthView(s, anchor, withTasks) {
    const ref = D.today();
    const y = Number(anchor.slice(0, 4));
    const m = Number(anchor.slice(5, 7));
    const days = D.monthGrid(y, m);
    const rows = days.length / 7;
    const max = rows > 5 ? 2 : 3;
    let html = '<div class="month" style="grid-template-rows:auto repeat(' + rows + ',minmax(0,1fr))">';
    for (let i = 1; i <= 7; i++) html += '<div class="month-dow">' + D.DAYS_SHORT[i % 7] + '</div>';
    for (const k of days) {
      const items = dayItems(s, k, withTasks);
      const wd = D.weekday(k);
      const cls = ['mcell'];
      if (Number(k.slice(5, 7)) !== m) cls.push('out');
      if (k === ref) cls.push('today');
      if (wd === 0 || wd === 6) cls.push('weekend');
      const shown = items.length > max + 1 ? items.slice(0, max) : items;
      html += '<div class="' + cls.join(' ') + '" data-act="cell" data-date="' + k + '">'
        + '<div class="mcell-top"><button type="button" class="dnum" data-act="goto-day" data-date="' + k + '" aria-label="' + D.formatLong(k) + '">' + Number(k.slice(8)) + '</button></div>'
        + shown.map((it) => calItem(it, k)).join('')
        + (items.length > shown.length ? '<button type="button" class="cal-more" data-act="goto-day" data-date="' + k + '">+ ' + (items.length - shown.length) + ' autres</button>' : '')
        + '<div class="mdots">' + items.slice(0, 4).map((it) => '<span class="dot ' + (it.kind === 'event' ? 'c-' + it.ev.color : '') + '"></span>').join('') + '</div>'
        + '</div>';
    }
    return html + '</div>';
  }

  function timeGrid(s, days, withTasks) {
    const ref = D.today();
    const nowMin = nowMinutes();
    let head = '<div class="thead"><div></div>';
    let allday = '<div class="tallday"><div>Journée</div>';
    let cols = '';
    for (const k of days) {
      const wd = D.weekday(k);
      head += '<div class="' + (k === ref ? 'today' : '') + '"><a class="dlabel" href="#/calendar/day/' + k + '">' + D.DAYS_SHORT[wd] + ' <b>' + Number(k.slice(8)) + '</b></a></div>';

      const items = dayItems(s, k, withTasks);
      const flat = items.filter((it) => (it.kind === 'event' ? it.ev.allDay : !it.task.time));
      allday += '<div>' + flat.map((it) => calItem(it, k)).join('') + '</div>';

      const timed = items.filter((it) => (it.kind === 'event' ? !it.ev.allDay : !!it.task.time)).map((it) => {
        const st = D.timeToMin(it.kind === 'event' ? it.ev.start : it.task.time);
        let en = it.kind === 'event' ? D.timeToMin(it.ev.end) : st + 30;
        if (en <= st) en = Math.min(24 * 60, st + (it.kind === 'event' ? 60 : 30));
        return Object.assign(it, { s: st, e: Math.max(en, st + 15) });
      });
      const blocks = M.layoutDay(timed).map((it) => {
        const style = 'top:' + (it.s / 60) * HOUR_H + 'px;height:' + Math.max(18, ((it.e - it.s) / 60) * HOUR_H - 2) + 'px;'
          + 'left:calc(' + (it.col / it.cols) * 100 + '% + 2px);width:calc(' + 100 / it.cols + '% - 4px)';
        if (it.kind === 'event') {
          const e = it.ev;
          return '<button type="button" class="tev c-' + e.color + '" style="' + style + '" data-act="open-event" data-id="' + e.id + '" data-date="' + k + '">'
            + '<b>' + esc(e.title || 'Sans titre') + '</b><small>' + e.start + ' – ' + e.end + (e.location ? ' · ' + esc(e.location) : '') + '</small></button>';
        }
        const t = it.task;
        return '<button type="button" class="tev task-block' + (t.done ? ' done' : '') + '" style="' + style + '" data-act="open-task" data-id="' + t.id + '">'
          + '<b>' + esc(t.title || 'Sans titre') + '</b><small>' + t.time + '</small></button>';
      }).join('');
      cols += '<div class="tcol' + (wd === 0 || wd === 6 ? ' weekend' : '') + '" data-act="slot" data-date="' + k + '">' + blocks
        + (k === ref ? '<div class="now-line" style="top:' + (nowMin / 60) * HOUR_H + 'px"></div>' : '') + '</div>';
    }
    let gutter = '<div class="tgutter">';
    for (let h = 1; h < 24; h++) gutter += '<span style="top:' + h * HOUR_H + 'px">' + D.pad(h) + ':00</span>';
    gutter += '</div>';

    // Un seul conteneur défilant : l'en-tête reste collé en haut et aligné avec les colonnes.
    return '<div class="tgrid-wrap"><div class="tgrid-scroll" data-keep-scroll="tgrid"><div class="tgrid' + (days.length === 1 ? ' cols-1' : '') + '" style="--n:' + days.length + '">'
      + '<div class="tsticky">' + head + '</div>' + allday + '</div></div>'
      + '<div class="tcols">' + gutter + cols + '</div></div></div></div>';
  }

  function agendaView(s, start, withTasks) {
    const ref = D.today();
    let html = '';
    for (let i = 0; i < 28; i++) {
      const k = D.addDays(start, i);
      const items = dayItems(s, k, withTasks);
      if (!items.length) continue;
      html += '<div class="agenda-day' + (k === ref ? ' today' : '') + '"><div class="agenda-date"><b>' + Number(k.slice(8)) + '</b>'
        + '<span>' + D.DAYS_SHORT[D.weekday(k)] + ' ' + D.MONTHS_SHORT[Number(k.slice(5, 7)) - 1] + '</span></div><div class="agenda-items">'
        + items.map((it) => {
          if (it.kind === 'event') {
            const e = it.ev;
            return '<button type="button" class="agenda-item c-' + e.color + '" data-act="open-event" data-id="' + e.id + '" data-date="' + k + '"><time>' + C.timeRange(e) + '</time>'
              + '<span class="t"><span class="dot"></span><span>' + esc(e.title || 'Sans titre') + '</span>' + (e.location ? '<small>· ' + esc(e.location) + '</small>' : '') + '</span></button>';
          }
          const t = it.task;
          return '<div class="agenda-item' + (t.done ? ' done' : '') + '" data-act="open-task" data-id="' + t.id + '" tabindex="0"><time>' + (t.time || 'Tâche') + '</time>'
            + '<span class="t"><button type="button" class="check' + (t.done ? ' on' : '') + '" data-act="toggle-task" aria-label="Terminer">' + icon('check') + '</button>'
            + '<span' + (t.done ? ' style="text-decoration:line-through;color:var(--faint)"' : '') + '>' + esc(t.title || 'Sans titre') + '</span></span></div>';
        }).join('') + '</div></div>';
    }
    return html ? '<div class="agenda">' + html + '</div>' : C.empty('calendar', 'Rien de prévu', 'Aucun élément sur les quatre prochaines semaines.');
  }

  function rangeTitle(a, b) {
    const [ya, ma] = [a.slice(0, 4), Number(a.slice(5, 7))];
    const [yb, mb] = [b.slice(0, 4), Number(b.slice(5, 7))];
    if (ya !== yb) return D.formatShort(a) + ' ' + ya + ' – ' + D.formatShort(b) + ' ' + yb;
    if (ma !== mb) return D.formatShort(a) + ' – ' + D.formatShort(b) + ' ' + yb;
    return Number(a.slice(8)) + ' – ' + Number(b.slice(8)) + ' ' + D.MONTHS[mb - 1] + ' ' + yb;
  }

  V.calendar = {
    wide: true,
    title: () => 'Calendrier',
    render(r) {
      const s = S.state;
      const mode = r.mode;
      const anchor = r.date;
      const withTasks = s.settings.calTasks;
      let title, step, body;
      if (mode === 'month') {
        title = D.cap(D.MONTHS[Number(anchor.slice(5, 7)) - 1]) + ' ' + anchor.slice(0, 4);
        step = (n) => D.addMonths(anchor, n);
        body = monthView(s, anchor, withTasks);
      } else if (mode === 'week') {
        const st = D.startOfWeek(anchor);
        const days = [0, 1, 2, 3, 4, 5, 6].map((i) => D.addDays(st, i));
        title = rangeTitle(days[0], days[6]);
        step = (n) => D.addDays(anchor, 7 * n);
        body = timeGrid(s, days, withTasks);
      } else if (mode === 'day') {
        title = D.cap(D.formatLong(anchor));
        step = (n) => D.addDays(anchor, n);
        body = timeGrid(s, [anchor], withTasks);
      } else {
        title = 'À partir du ' + D.formatShort(anchor);
        step = (n) => D.addDays(anchor, 28 * n);
        body = agendaView(s, anchor, withTasks);
      }
      return '<div class="cal-head"><h1 class="cal-title">' + esc(title) + '</h1>'
        + '<div class="period-nav"><a class="icon-btn" href="#/calendar/' + mode + '/' + step(-1) + '" aria-label="Précédent">' + icon('left') + '</a>'
        + '<a class="btn btn-sm" href="#/calendar/' + mode + '/' + D.today() + '">Aujourd\'hui</a>'
        + '<a class="icon-btn" href="#/calendar/' + mode + '/' + step(1) + '" aria-label="Suivant">' + icon('right') + '</a></div>'
        + '<div class="grow"></div><div class="cal-tools">'
        + '<button type="button" class="chip' + (withTasks ? ' on' : '') + '" data-act="toggle-cal-tasks" aria-pressed="' + withTasks + '">' + icon('check') + 'Tâches</button>'
        + '<nav class="seg" aria-label="Vue">' + CAL_MODES.map(([id, l]) => '<a href="#/calendar/' + id + '/' + anchor + '" class="' + (id === mode ? 'on' : '') + '">' + l + '</a>').join('') + '</nav>'
        + '<button type="button" class="btn btn-primary btn-sm" data-act="new-event" data-date="' + anchor + '">' + icon('plus') + 'Événement</button>'
        + '</div></div>' + body;
    },
    mount(el, r, isNewRoute) {
      const body = el.querySelector('.tgrid-scroll');
      if (body && isNewRoute) {
        const days = r.mode === 'day' ? [r.date] : [0, 1, 2, 3, 4, 5, 6].map((i) => D.addDays(D.startOfWeek(r.date), i));
        const hour = days.includes(D.today()) ? Math.max(0, new Date().getHours() - 2) : 7;
        body.scrollTop = hour * HOUR_H;
      }
    },
  };

  // ================================================================ Objectifs

  const goalFilter = { status: 'active', area: '' };

  V.goals = {
    title: () => 'Objectifs',
    render(r) {
      const s = S.state;
      const hz = r.horizon;
      const horizons = hz === 'all' ? M.HORIZONS : M.HORIZONS.filter((h) => h.id === hz);
      const match = (g) => (goalFilter.status === 'all' || g.status === goalFilter.status) && (!goalFilter.area || g.area === goalFilter.area);
      const canAdd = goalFilter.status === 'active' || goalFilter.status === 'all';
      const active = s.goals.filter((g) => g.status === 'active').length;
      const reached = s.goals.filter((g) => g.status === 'done' && String(g.doneAt).slice(0, 4) === D.today().slice(0, 4)).length;

      let html = '<header class="page-head"><div class="crumb">' + icon('target') + 'Objectifs</div>'
        + '<div class="page-head-row"><div><h1 class="page-title">Objectifs</h1>'
        + '<p class="page-sub">De la vision de vie au mois qui vient. Reliez chaque objectif à un plus grand, et vos tâches à vos objectifs.</p></div>'
        + '<button type="button" class="btn btn-primary" data-act="new-goal">' + icon('plus') + 'Nouvel objectif</button></div>'
        + '<div class="today-stats"><span><b>' + active + '</b> en cours</span><span><b>' + reached + '</b> ' + (reached > 1 ? 'atteints' : 'atteint') + ' cette année</span></div></header>';

      html += '<div class="toolbar"><nav class="seg" aria-label="Horizon"><a href="#/goals" class="' + (hz === 'all' ? 'on' : '') + '">Tous</a>'
        + M.HORIZONS.map((h) => '<a href="#/goals/' + h.id + '" class="' + (hz === h.id ? 'on' : '') + '">' + h.label + '</a>').join('') + '</nav>'
        + '<div class="grow"></div>'
        + '<select class="select-inline" data-change="goal-status" aria-label="Statut">'
        + [['active', 'En cours'], ['paused', 'En pause'], ['done', 'Atteints'], ['dropped', 'Abandonnés'], ['all', 'Tous les statuts']].map(([v, l]) => '<option value="' + v + '"' + (goalFilter.status === v ? ' selected' : '') + '>' + l + '</option>').join('')
        + '</select><select class="select-inline" data-change="goal-area" aria-label="Domaine"><option value="">Tous les domaines</option>'
        + M.AREAS.map((a) => '<option value="' + a.id + '"' + (goalFilter.area === a.id ? ' selected' : '') + '>' + a.label + '</option>').join('')
        + '</select></div>';

      let i = 0;
      for (const h of horizons) {
        const list = s.goals.filter((g) => g.horizon === h.id && match(g)).sort((a, b) => {
          const pa = a.period || '~', pb = b.period || '~';
          if (pa !== pb) return pa < pb ? -1 : 1;
          const da = a.deadline || '~', db = b.deadline || '~';
          return da < db ? -1 : da > db ? 1 : a.createdAt - b.createdAt;
        });
        if (!list.length && !canAdd) continue;
        html += '<section class="goal-section"><div class="goal-section-head"><h2>' + h.section + '</h2><span class="n">' + list.length + '</span>'
          + (canAdd ? '<button type="button" class="icon-btn" data-act="new-goal" data-horizon="' + h.id + '" title="Nouvel objectif" aria-label="Nouvel objectif ' + h.label + '">' + icon('plus') + '</button>' : '') + '</div>'
          + '<div class="goal-grid">' + list.map((g) => C.goalCard(g, i++)).join('')
          + (canAdd ? '<button type="button" class="goal-add" data-act="new-goal" data-horizon="' + h.id + '">' + icon('plus') + 'Ajouter</button>' : '')
          + '</div></section>';
      }
      if (!canAdd && !html.includes('goal-card')) html += C.empty('target', 'Aucun objectif', 'Aucun objectif ne correspond à ces filtres.');
      return html;
    },
  };

  // Sélecteurs (data-change)
  V.changes = {
    sort(v) { S.update((s) => { s.settings.sort = v; }); },
    'goal-status'(v) { goalFilter.status = v; App.render(); },
    'goal-area'(v) { goalFilter.area = v; App.render(); },
  };

  window.V = V;
})();
