// Tests de la logique pure. Lancer : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const M = require('../js/model.js');

test('semaines ISO, y compris aux changements d\'année', () => {
  assert.equal(D.weekKey('2026-10-16'), '2026-W42');
  assert.equal(D.weekKeyStart('2026-W42'), '2026-10-12');
  assert.equal(D.weekKey('2027-01-01'), '2026-W53');
  assert.equal(D.weekKey('2024-12-30'), '2025-W01');
  assert.equal(D.shiftPeriod('week', '2026-W53', 1), '2027-W01');
  assert.equal(D.shiftPeriod('week', '2027-W01', -1), '2026-W53');
});

test('ajout de mois avec fin de mois', () => {
  assert.equal(D.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(D.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(D.addMonths('2026-12-15', 1), '2027-01-15');
});

test('périodes : appartenance, bornes, décalage, libellés', () => {
  assert.equal(D.periodOf('quarter', '2026-10-16'), '2026-Q4');
  assert.deepEqual(D.periodRange('month', '2026-02'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(D.periodRange('quarter', '2026-Q4'), ['2026-10-01', '2026-12-31']);
  assert.equal(D.shiftPeriod('quarter', '2026-Q4', 1), '2027-Q1');
  assert.equal(D.shiftPeriod('month', '2026-12', 1), '2027-01');
  assert.equal(D.periodLabel('day', '2026-10-16'), 'Vendredi 16 octobre 2026');
  assert.equal(D.periodLabel('week', '2026-W42'), 'Semaine 42 · 12 oct. – 18 oct.');
  assert.equal(D.periodLabel('month', '2026-10'), 'Octobre 2026');
  assert.equal(D.relativeLabel('week', '2026-W43', '2026-10-16'), 'Semaine prochaine');
  assert.equal(D.relativeLabel('day', '2026-10-15', '2026-10-16'), 'Hier');
  assert.equal(D.relativeLabel('month', '2027-03', '2026-10-16'), null);
  assert.equal(D.isPastPeriod('week', '2026-W41', '2026-10-16'), true);
  assert.equal(D.isPastPeriod('week', '2026-W42', '2026-10-16'), false);
});

test('répétition : jours ouvrés sautent le week-end', () => {
  assert.equal(D.nextRepeat('weekdays', '2026-10-16'), '2026-10-19');
  assert.equal(D.nextRepeat('daily', '2026-12-31'), '2027-01-01');
  assert.equal(D.nextRepeat('monthly', '2026-01-31'), '2026-02-28');
});

test('grille du mois : semaines complètes uniquement', () => {
  const oct = D.monthGrid(2026, 10);
  assert.equal(oct.length, 35);
  assert.equal(oct[0], '2026-09-28');
  assert.equal(D.monthGrid(2027, 2).length, 28);
});

test('occurrences d\'événements : récurrence, plage, exceptions', () => {
  const weekly = M.newEvent({ date: '2026-10-12', repeat: 'weekly', exceptions: ['2026-10-26'], repeatUntil: '2026-11-30' });
  assert.ok(D.occursOn(weekly, '2026-10-19'));
  assert.ok(!D.occursOn(weekly, '2026-10-20'));
  assert.ok(!D.occursOn(weekly, '2026-10-26'));
  assert.ok(!D.occursOn(weekly, '2026-12-07'));
  assert.ok(!D.occursOn(weekly, '2026-10-05'));
  const monthly = M.newEvent({ date: '2026-01-31', repeat: 'monthly' });
  assert.ok(D.occursOn(monthly, '2026-03-31'));
  assert.ok(!D.occursOn(monthly, '2026-02-28'));
  const trip = M.newEvent({ date: '2026-10-20', endDate: '2026-10-23', allDay: true });
  assert.ok(D.occursOn(trip, '2026-10-22'));
  assert.ok(!D.occursOn(trip, '2026-10-24'));
});

test('saisie rapide : #étiquettes et ! priorité', () => {
  assert.deepEqual(M.parseQuickTitle('Courir 10 km #sport #santé !!'), { title: 'Courir 10 km', tags: ['sport', 'santé'], priority: 2 });
  assert.deepEqual(M.parseQuickTitle('Payer le loyer'), { title: 'Payer le loyer', tags: [], priority: 0 });
});

test('tâche répétée : cocher crée la suivante une seule fois', () => {
  const s = M.emptyState();
  const t = M.newTask({ title: 'Méditer', scope: 'day', period: '2026-10-16', repeat: 'weekdays', subtasks: [{ id: 'a', title: '10 min', done: true }] });
  s.tasks.push(t);
  const next = M.toggleTask(s, t.id, '2026-10-16');
  assert.equal(next.period, '2026-10-19');
  assert.equal(next.done, false);
  assert.equal(next.subtasks[0].done, false);
  M.toggleTask(s, t.id);
  M.toggleTask(s, t.id);
  assert.equal(s.tasks.length, 2);
});

test('tâche hebdo répétée avec échéance : période et échéance décalées', () => {
  const s = M.emptyState();
  const t = M.newTask({ scope: 'week', period: '2026-W42', repeat: 'weekly', due: '2026-10-16' });
  s.tasks.push(t);
  const next = M.toggleTask(s, t.id);
  assert.equal(next.period, '2026-W43');
  assert.equal(next.due, '2026-10-23');
});

test('tâches en retard et déplacement', () => {
  const s = M.emptyState();
  const old = M.newTask({ scope: 'day', period: '2026-10-14' });
  const done = M.newTask({ scope: 'day', period: '2026-10-13', done: true });
  const cur = M.newTask({ scope: 'day', period: '2026-10-16' });
  s.tasks.push(old, done, cur);
  assert.deepEqual(M.overdueTasks(s, 'day', '2026-10-16').map((t) => t.id), [old.id]);
  old.repeat = 'daily';
  M.moveTask(old, 'week', '2026-W42');
  assert.equal(old.period, '2026-W42');
  assert.equal(old.repeat, null);
  assert.deepEqual(M.overdueTasks(s, 'day', '2026-10-16'), []);
});

test('tri par priorité puis ordre manuel', () => {
  const a = M.newTask({ title: 'a', priority: 1, order: 1 });
  const b = M.newTask({ title: 'b', priority: 3, order: 2 });
  const c = M.newTask({ title: 'c', priority: 3, order: 0 });
  assert.deepEqual(M.sortTasks([a, b, c], 'priority').map((t) => t.title), ['c', 'b', 'a']);
  assert.deepEqual(M.sortTasks([a, b, c], 'manual').map((t) => t.title), ['c', 'a', 'b']);
});

test('progression des objectifs selon la source', () => {
  const s = M.emptyState();
  const weight = M.newGoal({ metric: { start: 80, current: 76, target: 72, unit: 'kg' } });
  assert.equal(M.goalProgress(weight, s).value, 0.5);
  const ms = M.newGoal({ milestones: [{ id: '1', done: true }, { id: '2', done: false }, { id: '3', done: false }, { id: '4', done: true }] });
  assert.equal(M.goalProgress(ms, s).value, 0.5);
  const parent = M.newGoal({ horizon: '5y' });
  const child1 = M.newGoal({ horizon: 'year', parentId: parent.id, status: 'done' });
  const child2 = M.newGoal({ horizon: 'year', parentId: parent.id });
  s.goals.push(parent, child1, child2);
  assert.equal(M.goalProgress(parent, s).value, 0.5);
  assert.equal(M.goalProgress(parent, s).source, 'Sous-objectifs');
  const g = M.newGoal({});
  s.tasks.push(M.newTask({ goalId: g.id, done: true }), M.newTask({ goalId: g.id }));
  assert.equal(M.goalProgress(g, s).value, 0.5);
  assert.equal(M.goalProgress(M.newGoal({}), s).value, 0);
});

test('parents possibles : horizon plus long et pas de boucle', () => {
  const s = M.emptyState();
  const life = M.newGoal({ horizon: 'life' });
  const y5 = M.newGoal({ horizon: '5y', parentId: life.id });
  const year = M.newGoal({ horizon: 'year', parentId: y5.id });
  s.goals.push(life, y5, year);
  assert.deepEqual(M.parentCandidates(s, year).map((g) => g.id).sort(), [life.id, y5.id].sort());
  assert.deepEqual(M.parentCandidates(s, life), []);
});

test('disposition des événements qui se chevauchent', () => {
  const out = M.layoutDay([{ id: 'a', s: 540, e: 600 }, { id: 'b', s: 570, e: 630 }, { id: 'c', s: 660, e: 720 }]);
  const by = Object.fromEntries(out.map((x) => [x.id, x]));
  assert.equal(by.a.cols, 2);
  assert.notEqual(by.a.col, by.b.col);
  assert.equal(by.c.cols, 1);
});

test('recherche insensible aux accents', () => {
  const s = M.emptyState();
  s.events.push(M.newEvent({ title: 'Réunion équipe' }));
  s.tasks.push(M.newTask({ title: 'Acheter du pain', tags: ['courses'] }));
  assert.equal(M.search(s, 'reunion').events.length, 1);
  assert.equal(M.search(s, 'COURSES').tasks.length, 1);
  assert.equal(M.search(s, '  ').tasks.length, 0);
});

test('normalisation : données invalides et champs manquants', () => {
  assert.deepEqual(M.normalize(null).tasks, []);
  assert.equal(M.isValidState({ tasks: [] }), false);
  const n = M.normalize({ tasks: [{ id: 'x', title: 'Ancien' }], events: [], goals: [] });
  assert.equal(n.tasks[0].title, 'Ancien');
  assert.deepEqual(n.tasks[0].subtasks, []);
  assert.equal(n.settings.theme, 'system');
});

// ---- Synchronisation : horodatage et fusion

const clone = (x) => JSON.parse(JSON.stringify(x));
const etat = (tasks, extra) => M.normalize(Object.assign({ tasks, events: [], goals: [] }, extra));

test('horodatage : seuls les éléments modifiés ou nouveaux changent, les suppressions laissent une trace', () => {
  const base = etat([{ id: 'a', title: 'A', updatedAt: 1 }, { id: 'b', title: 'B', updatedAt: 1 }, { id: 'c', title: 'C', updatedAt: 1 }]);
  const next = clone(base);
  next.tasks[0].title = 'A modifiée';
  next.tasks = next.tasks.filter((t) => t.id !== 'c');
  next.tasks.push(M.newTask({ id: 'd', title: 'D' }));
  M.stamp(base, next, 50);
  const by = Object.fromEntries(next.tasks.map((t) => [t.id, t.updatedAt]));
  assert.deepEqual(by, { a: 50, b: 1, d: 50 });
  assert.deepEqual(next.deleted, { c: 50 });
  assert.equal(next.settingsAt, 0);
  next.settings.name = 'Eliot';
  M.stamp(clone(next), next, 60);
  assert.equal(next.settingsAt, 0, 'base identique : rien ne change');
});

test('horodatage : réglages modifiés et suppression annulée', () => {
  const base = etat([{ id: 'a', title: 'A', updatedAt: 1 }]);
  const sansA = clone(base);
  sansA.tasks = [];
  sansA.settings.name = 'Eliot';
  M.stamp(base, sansA, 10);
  assert.equal(sansA.settingsAt, 10);
  assert.deepEqual(sansA.deleted, { a: 10 });
  // « Annuler » remet l'ancienne version : elle redevient la plus récente.
  const restaure = clone(base);
  M.stamp(sansA, restaure, 20);
  assert.equal(restaure.tasks[0].updatedAt, 20);
  assert.deepEqual(restaure.deleted, {});
});

test('fusion : le dernier modifié gagne, élément par élément', () => {
  const ici = etat([{ id: 'a', title: 'A ici', updatedAt: 30 }, { id: 'b', title: 'B ici', updatedAt: 5 }, { id: 'n1', title: 'Nouvelle ici', updatedAt: 7 }]);
  const la = etat([{ id: 'a', title: 'A là-bas', updatedAt: 20 }, { id: 'b', title: 'B là-bas', updatedAt: 9 }, { id: 'n2', title: 'Nouvelle là-bas', updatedAt: 8 }]);
  const m = M.merge(ici, la);
  const titles = Object.fromEntries(m.tasks.map((t) => [t.id, t.title]));
  assert.deepEqual(titles, { a: 'A ici', b: 'B là-bas', n1: 'Nouvelle ici', n2: 'Nouvelle là-bas' });
  assert.equal(M.serialize(m), M.serialize(M.merge(la, ici)), 'même résultat dans les deux sens');
});

test('fusion : suppressions propagées sauf si modifié après', () => {
  const ici = etat([{ id: 'b', title: 'B', updatedAt: 40 }], { deleted: { a: 30 } });
  const la = etat([{ id: 'a', title: 'A', updatedAt: 10 }], { deleted: { b: 20 } });
  const m = M.merge(ici, la);
  assert.deepEqual(m.tasks.map((t) => t.id), ['b'], 'a supprimée, b modifiée après sa suppression');
  assert.deepEqual(m.deleted, { a: 30 });
});

test('fusion : réglages les plus récents, événements et objectifs aussi', () => {
  const ici = M.normalize({ tasks: [], events: [{ id: 'e', title: 'Ici', updatedAt: 1 }], goals: [{ id: 'g', title: 'But', updatedAt: 5 }], settings: { name: 'Ancien' }, settingsAt: 1 });
  const la = M.normalize({ tasks: [], events: [{ id: 'e', title: 'Là', updatedAt: 2 }], goals: [], settings: { name: 'Nouveau' }, settingsAt: 2 });
  const m = M.merge(ici, la);
  assert.equal(m.events[0].title, 'Là');
  assert.equal(m.goals[0].title, 'But');
  assert.equal(m.settings.name, 'Nouveau');
  assert.equal(m.settingsAt, 2);
});

test('sérialisation stable : l\'ordre des tableaux ne compte pas', () => {
  const a = etat([{ id: 'x', updatedAt: 1 }, { id: 'y', updatedAt: 1 }]);
  const b = clone(a);
  b.tasks.reverse();
  assert.equal(M.serialize(a), M.serialize(b));
});

test('horodatage : un état remplacé (import, annulation) garde les traces de suppression', () => {
  const base = etat([{ id: 'a', title: 'A', updatedAt: 1 }], { deleted: { vieux: 5 } });
  const importe = etat([{ id: 'b', title: 'B' }]);
  M.stamp(base, importe, 30);
  assert.deepEqual(importe.deleted, { vieux: 5, a: 30 });
});

test("sauvegarde à l'ouverture : nouvelle version ou nouveau jour", () => {
  const now = new Date(2026, 9, 18, 15).getTime();
  const sameDay = [{ at: new Date(2026, 9, 18, 8).getTime() }];
  const yesterday = [{ at: new Date(2026, 9, 17, 23).getTime() }];
  assert.equal(M.backupReason([], { now, version: 'b' }), 'jour');
  assert.equal(M.backupReason(sameDay, { now, version: 'b', lastVersion: 'b' }), null);
  assert.equal(M.backupReason(sameDay, { now, version: 'b' }), null);
  assert.equal(M.backupReason(yesterday, { now, version: 'b', lastVersion: 'b' }), 'jour');
  assert.equal(M.backupReason(sameDay, { now, version: 'b', lastVersion: 'a' }), 'version');
});

test('ajout de sauvegarde : ignore le vide et les doublons, garde les 10 dernières', () => {
  const data = M.emptyState();
  data.tasks.push(M.newTask({ id: 't1', title: 'Garder' }));
  assert.equal(M.addBackup([], M.emptyState(), { now: 1, reason: 'jour' }), null);
  assert.equal(M.addBackup([], { tasks: 'abîmé' }, { now: 1, reason: 'jour' }), null);
  const one = M.addBackup([], data, { now: 1, reason: 'jour', version: 'a' });
  assert.equal(one.length, 1);
  assert.equal(one[0].data.tasks[0].title, 'Garder');
  assert.equal(M.addBackup(one, JSON.parse(JSON.stringify(data)), { now: 2, reason: 'version' }), null);
  let list = [{ at: 0, data: null }].concat(one);
  for (let i = 0; i < 12; i++) {
    const d = JSON.parse(JSON.stringify(data));
    d.tasks[0].title = 'v' + i;
    list = M.addBackup(list, d, { now: 10 + i, reason: 'jour' });
  }
  assert.equal(list.length, 10);
  assert.equal(list[0].data.tasks[0].title, 'v11');
  assert.ok(list.every((b) => b.data));
});

test("restauration : les éléments restaurés l'emportent sur la synchro", () => {
  const backup = M.emptyState();
  backup.tasks.push(M.newTask({ id: 'a', title: 'Ancien titre', updatedAt: 100 }));
  const current = M.normalize(JSON.parse(JSON.stringify(backup)));
  current.tasks[0].title = 'Titre abîmé';
  current.tasks[0].updatedAt = 500;
  current.tasks.push(M.newTask({ id: 'b', title: 'Créée après', updatedAt: 600 }));
  // Restaurer = remplacer l'état puis le dater, comme S.replace.
  const restored = M.stamp(current, M.normalize(JSON.parse(JSON.stringify(backup))), 1000);
  const remote = M.normalize(JSON.parse(JSON.stringify(current)));
  const merged = M.merge(restored, remote);
  assert.deepEqual(merged.tasks.map((t) => t.title), ['Ancien titre']);
  assert.equal(merged.deleted.b, 1000);
});
