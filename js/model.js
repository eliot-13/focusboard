// Logique métier pure : création des éléments, récurrence, progression des objectifs, recherche.
// Fonctionne dans le navigateur (global M) et dans Node (module.exports).
(function (root, factory) {
  const D = typeof module === 'object' && module.exports ? require('./dates.js') : root.D;
  const api = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.M = api;
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const SCOPES = ['inbox', 'day', 'week', 'month', 'year'];
  const SCOPE_LABEL = { inbox: 'Sans date', day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année' };

  const REPEATS = {
    inbox: [],
    day: [['daily', 'Tous les jours'], ['weekdays', 'Jours ouvrés (lun.–ven.)'], ['weekly', 'Chaque semaine'], ['monthly', 'Chaque mois']],
    week: [['weekly', 'Chaque semaine']],
    month: [['monthly', 'Chaque mois']],
    year: [['yearly', 'Chaque année']],
  };
  const SCOPE_REPEAT = { week: 'weekly', month: 'monthly', year: 'yearly' };

  const PRIORITIES = [
    { id: 0, label: 'Aucune' },
    { id: 1, label: 'Basse', color: 'blue' },
    { id: 2, label: 'Moyenne', color: 'yellow' },
    { id: 3, label: 'Haute', color: 'red' },
  ];

  // Horizons des objectifs, du plus court au plus long. `scope` = période associée.
  const HORIZONS = [
    { id: 'month', label: 'Mois', section: 'Mensuels', scope: 'month' },
    { id: 'quarter', label: 'Trimestre', section: 'Trimestriels', scope: 'quarter' },
    { id: 'year', label: 'Année', section: 'Annuels', scope: 'year' },
    { id: '3y', label: '3 ans', section: 'À 3 ans' },
    { id: '5y', label: '5 ans', section: 'À 5 ans' },
    { id: 'life', label: 'Vie', section: 'Vision de vie' },
  ];
  const HORIZON_RANK = Object.fromEntries(HORIZONS.map((h, i) => [h.id, i]));

  const AREAS = [
    { id: 'sante', label: 'Santé', color: 'green' },
    { id: 'carriere', label: 'Carrière', color: 'blue' },
    { id: 'finances', label: 'Finances', color: 'yellow' },
    { id: 'relations', label: 'Relations', color: 'red' },
    { id: 'perso', label: 'Développement perso', color: 'purple' },
    { id: 'apprentissage', label: 'Apprentissage', color: 'teal' },
    { id: 'loisirs', label: 'Loisirs', color: 'orange' },
    { id: 'maison', label: 'Maison', color: 'brown' },
    { id: 'autre', label: 'Autre', color: 'gray' },
  ];

  const GOAL_STATUS = [
    { id: 'active', label: 'En cours', color: 'blue' },
    { id: 'paused', label: 'En pause', color: 'yellow' },
    { id: 'done', label: 'Atteint', color: 'green' },
    { id: 'dropped', label: 'Abandonné', color: 'gray' },
  ];

  const EVENT_COLORS = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'teal'];
  const EVENT_REPEATS = [['', 'Ne se répète pas'], ['daily', 'Tous les jours'], ['weekdays', 'Jours ouvrés'], ['weekly', 'Chaque semaine'], ['monthly', 'Chaque mois'], ['yearly', 'Chaque année']];

  let counter = 0;
  function uid() {
    counter = (counter + 1) % 1296;
    return Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function defaultSettings() {
    return { name: '', theme: 'system', showDone: true, sort: 'manual', calView: 'month', calTasks: true };
  }

  function emptyState() {
    return { version: 1, tasks: [], events: [], goals: [], settings: defaultSettings(), settingsAt: 0, deleted: {} };
  }

  function isValidState(obj) {
    return !!obj && typeof obj === 'object' && Array.isArray(obj.tasks) && Array.isArray(obj.events) && Array.isArray(obj.goals);
  }

  // Complète les champs manquants (anciennes sauvegardes, import).
  function normalize(raw) {
    if (!isValidState(raw)) return emptyState();
    return {
      version: 1,
      tasks: raw.tasks.map((t) => newTask(t)),
      events: raw.events.map((e) => newEvent(e)),
      goals: raw.goals.map((g) => newGoal(g)),
      settings: Object.assign(defaultSettings(), raw.settings || {}),
      settingsAt: Number(raw.settingsAt) || 0,
      deleted: Object.assign({}, raw.deleted),
    };
  }

  function newTask(f) {
    return Object.assign({
      id: uid(), title: '', notes: '', done: false, doneAt: null, createdAt: Date.now(),
      scope: 'inbox', period: null, priority: 0, due: null, time: null, tags: [], subtasks: [],
      goalId: null, repeat: null, spawnedId: null, focus: false, order: Date.now(), updatedAt: 0,
    }, f);
  }

  function newEvent(f) {
    return Object.assign({
      id: uid(), title: '', date: D.today(), endDate: null, allDay: false, start: '09:00', end: '10:00',
      color: 'blue', location: '', notes: '', repeat: null, repeatUntil: null, exceptions: [], createdAt: Date.now(), updatedAt: 0,
    }, f);
  }

  function newGoal(f) {
    return Object.assign({
      id: uid(), title: '', why: '', horizon: 'year', period: D.periodOf('year', D.today()), area: 'autre',
      status: 'active', deadline: null, metric: null, milestones: [], parentId: null, notes: '',
      createdAt: Date.now(), doneAt: null, updatedAt: 0,
    }, f);
  }

  // « Courir 10 km #sport !! » → { title: 'Courir 10 km', tags: ['sport'], priority: 2 }
  function parseQuickTitle(text) {
    const tags = [];
    let priority = 0;
    const words = [];
    for (const w of text.trim().split(/\s+/)) {
      if (/^#[^\s#]+$/.test(w)) tags.push(w.slice(1));
      else if (/^!{1,3}$/.test(w)) priority = w.length;
      else if (w) words.push(w);
    }
    return { title: words.join(' '), tags, priority };
  }

  // Date à laquelle une tâche apparaît dans le calendrier.
  function taskDate(t) {
    return t.due || (t.scope === 'day' ? t.period : null);
  }

  function findTask(state, id) {
    return state.tasks.find((t) => t.id === id);
  }

  // Prochaine occurrence d'une tâche répétée (non ajoutée à l'état).
  function nextOccurrence(t) {
    if (!t.repeat || t.scope === 'inbox') return null;
    const copy = Object.assign({}, t, {
      id: uid(), done: false, doneAt: null, spawnedId: null, focus: false, createdAt: Date.now(), order: Date.now(),
      subtasks: t.subtasks.map((s) => Object.assign({}, s, { id: uid(), done: false })),
      tags: t.tags.slice(),
    });
    if (t.scope === 'day') copy.period = D.nextRepeat(t.repeat, t.period);
    else copy.period = D.shiftPeriod(t.scope, t.period, 1);
    if (t.due) copy.due = D.nextRepeat(t.scope === 'day' ? t.repeat : SCOPE_REPEAT[t.scope], t.due);
    return copy;
  }

  // Coche / décoche. Une tâche répétée cochée crée sa prochaine occurrence (une seule fois).
  function toggleTask(state, id, ref) {
    const t = findTask(state, id);
    if (!t) return null;
    t.done = !t.done;
    t.doneAt = t.done ? (ref || D.today()) : null;
    if (t.done && t.repeat && !t.spawnedId) {
      const next = nextOccurrence(t);
      if (next) {
        state.tasks.push(next);
        t.spawnedId = next.id;
        return next;
      }
    }
    return null;
  }

  function moveTask(t, scope, period) {
    t.scope = scope;
    t.period = scope === 'inbox' ? null : period;
    if (!REPEATS[scope].some(([id]) => id === t.repeat)) t.repeat = null;
    if (scope !== 'day') t.focus = false;
    t.order = Date.now();
  }

  function tasksIn(state, scope, period) {
    return state.tasks.filter((t) => t.scope === scope && (scope === 'inbox' || t.period === period));
  }

  // Tâches non terminées de périodes passées pour ce type de liste.
  function overdueTasks(state, scope, ref) {
    if (scope === 'inbox') return [];
    const cur = D.periodOf(scope, ref || D.today());
    return state.tasks
      .filter((t) => t.scope === scope && !t.done && t.period < cur)
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : a.order - b.order));
  }

  function sortTasks(list, mode) {
    const byOrder = (a, b) => a.order - b.order;
    const cmp = {
      manual: byOrder,
      priority: (a, b) => b.priority - a.priority || byOrder(a, b),
      due: (a, b) => {
        const da = a.due ? a.due + (a.time || '') : '~';
        const db = b.due ? b.due + (b.time || '') : '~';
        return da < db ? -1 : da > db ? 1 : byOrder(a, b);
      },
    }[mode] || byOrder;
    return list.slice().sort(cmp);
  }

  function dueStatus(t, ref) {
    if (!t.due || t.done) return null;
    ref = ref || D.today();
    return t.due < ref ? 'overdue' : t.due === ref ? 'today' : 'future';
  }

  // ---- Objectifs

  function goalPeriodLabel(g) {
    const h = HORIZONS[HORIZON_RANK[g.horizon]];
    if (h && h.scope && g.period) return D.periodLabel(h.scope, g.period);
    return h ? h.label : '';
  }

  // Progression 0..1 et sa source : mesure > jalons > sous-objectifs > tâches liées.
  function goalProgress(g, state, depth) {
    depth = depth || 0;
    if (g.status === 'done') return { value: 1, source: 'Atteint' };
    const m = g.metric;
    if (m && isFinite(m.target) && m.target !== null && m.target !== '' && Number(m.target) !== Number(m.start || 0)) {
      const start = Number(m.start || 0);
      const v = (Number(m.current || 0) - start) / (Number(m.target) - start);
      return { value: Math.max(0, Math.min(1, v)), source: 'Mesure' };
    }
    if (g.milestones.length) {
      return { value: g.milestones.filter((x) => x.done).length / g.milestones.length, source: 'Jalons' };
    }
    const children = state.goals.filter((c) => c.parentId === g.id && c.status !== 'dropped');
    if (children.length && depth < 6) {
      const sum = children.reduce((s, c) => s + goalProgress(c, state, depth + 1).value, 0);
      return { value: sum / children.length, source: 'Sous-objectifs' };
    }
    const tasks = state.tasks.filter((t) => t.goalId === g.id);
    if (tasks.length) return { value: tasks.filter((t) => t.done).length / tasks.length, source: 'Tâches liées' };
    return { value: 0, source: null };
  }

  function isDescendant(state, goalId, ancestorId) {
    let cur = state.goals.find((g) => g.id === goalId);
    for (let i = 0; cur && i < 20; i++) {
      if (cur.parentId === ancestorId) return true;
      cur = state.goals.find((g) => g.id === cur.parentId);
    }
    return false;
  }

  // Objectifs pouvant servir de parent : horizon plus long, sans créer de boucle.
  function parentCandidates(state, g) {
    return state.goals.filter((p) => p.id !== g.id && p.status !== 'dropped'
      && HORIZON_RANK[p.horizon] > HORIZON_RANK[g.horizon] && !isDescendant(state, p.id, g.id));
  }

  // ---- Calendrier

  function eventsOn(state, key) {
    return state.events.filter((e) => D.occursOn(e, key)).sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
    });
  }

  function tasksOn(state, key) {
    return state.tasks.filter((t) => taskDate(t) === key);
  }

  // Colonnes pour les événements qui se chevauchent dans la vue semaine/jour.
  function layoutDay(items) {
    const sorted = items.slice().sort((a, b) => a.s - b.s || b.e - a.e);
    const out = [];
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      const cols = [];
      for (const it of cluster) {
        let c = cols.findIndex((end) => end <= it.s);
        if (c === -1) { c = cols.length; cols.push(0); }
        cols[c] = it.e;
        it.col = c;
      }
      for (const it of cluster) { it.cols = cols.length; out.push(it); }
      cluster = [];
    };
    for (const it of sorted) {
      if (cluster.length && it.s >= clusterEnd) flush();
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.e);
    }
    if (cluster.length) flush();
    return out;
  }

  // ---- Synchronisation entre appareils
  // Chaque élément porte `updatedAt` ; une suppression laisse une trace dans `deleted` { id: date }.
  // La fusion garde, élément par élément, la version modifiée en dernier.

  const COLLECTIONS = ['tasks', 'events', 'goals'];

  // Compare l'état enregistré précédemment (`base`) au nouvel état et date ce qui a changé.
  function stamp(base, next, now) {
    // Un état remplacé (import, annulation) ne doit pas perdre les suppressions déjà connues.
    for (const [id, at] of Object.entries(base.deleted)) if (!(id in next.deleted)) next.deleted[id] = at;
    for (const c of COLLECTIONS) {
      const before = new Map(base[c].map((x) => [x.id, JSON.stringify(x)]));
      const ids = new Set();
      for (const x of next[c]) {
        ids.add(x.id);
        if (before.get(x.id) !== JSON.stringify(x)) {
          x.updatedAt = now;
          delete next.deleted[x.id];
        }
      }
      for (const id of before.keys()) if (!ids.has(id)) next.deleted[id] = now;
    }
    if (JSON.stringify(base.settings) !== JSON.stringify(next.settings)) next.settingsAt = now;
    return next;
  }

  // Version la plus récente ; à égalité, choix déterministe pour que les appareils convergent.
  function newer(a, b) {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
  }

  function merge(a, b) {
    const deleted = Object.assign({}, a.deleted);
    for (const [id, at] of Object.entries(b.deleted)) if (!(deleted[id] >= at)) deleted[id] = at;
    const out = {
      version: 1,
      settings: b.settingsAt > a.settingsAt ? b.settings : a.settings,
      settingsAt: Math.max(a.settingsAt, b.settingsAt),
    };
    for (const c of COLLECTIONS) {
      const map = new Map(a[c].map((x) => [x.id, x]));
      for (const x of b[c]) map.set(x.id, map.has(x.id) ? newer(map.get(x.id), x) : x);
      out[c] = [];
      for (const x of map.values()) {
        if (deleted[x.id] >= x.updatedAt) continue;
        delete deleted[x.id]; // modifié après sa suppression : on le garde
        out[c].push(x);
      }
    }
    out.deleted = deleted;
    return normalize(JSON.parse(JSON.stringify(out)));
  }

  // JSON indépendant de l'ordre des tableaux, pour comparer deux états.
  function serialize(state) {
    const byId = (x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
    const copy = Object.assign({}, state);
    for (const c of COLLECTIONS) copy[c] = state[c].slice().sort(byId);
    copy.deleted = Object.fromEntries(Object.entries(state.deleted || {}).sort());
    return JSON.stringify(copy);
  }

  // ---- Recherche (insensible à la casse et aux accents)

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function search(state, q, limit) {
    limit = limit || 6;
    const n = norm(q).trim();
    if (!n) return { tasks: [], events: [], goals: [] };
    const hit = (...fields) => fields.some((f) => norm(Array.isArray(f) ? f.join(' ') : f).includes(n));
    return {
      tasks: state.tasks.filter((t) => hit(t.title, t.notes, t.tags)).sort((a, b) => a.done - b.done).slice(0, limit),
      events: state.events.filter((e) => hit(e.title, e.location, e.notes)).slice(0, limit),
      goals: state.goals.filter((g) => hit(g.title, g.why, g.notes)).slice(0, limit),
    };
  }

  return {
    SCOPES, SCOPE_LABEL, REPEATS, PRIORITIES, HORIZONS, HORIZON_RANK, AREAS, GOAL_STATUS, EVENT_COLORS, EVENT_REPEATS,
    uid, emptyState, isValidState, normalize, newTask, newEvent, newGoal, parseQuickTitle, taskDate, findTask,
    nextOccurrence, toggleTask, moveTask, tasksIn, overdueTasks, sortTasks, dueStatus,
    goalPeriodLabel, goalProgress, parentCandidates, eventsOn, tasksOn, layoutDay, norm, search,
    stamp, merge, serialize,
  };
});
