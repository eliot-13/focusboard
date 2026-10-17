// Utilitaires de dates. Toutes les dates sont des clés locales 'AAAA-MM-JJ'.
// Fonctionne dans le navigateur (global D) et dans Node (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.D = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Midi local : évite les décalages lors des changements d'heure.
  function parse(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function today() {
    return toKey(new Date());
  }

  function addDays(key, n) {
    const d = parse(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  // Ajoute n mois en ramenant le jour au dernier jour du mois si besoin (31 janv. + 1 = 28/29 févr.).
  function addMonths(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(y, m - 1 + n, 1, 12);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d, last));
    return toKey(t);
  }

  function diffDays(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  function weekday(key) {
    return parse(key).getDay();
  }

  // Semaines du lundi au dimanche.
  function startOfWeek(key) {
    return addDays(key, -((weekday(key) + 6) % 7));
  }

  function daysInMonth(y, m1) {
    return new Date(y, m1, 0).getDate();
  }

  // Numéro de semaine ISO 8601.
  function isoWeek(key) {
    const thursday = addDays(startOfWeek(key), 3);
    const year = Number(thursday.slice(0, 4));
    const week1 = startOfWeek(year + '-01-04');
    return { year, week: diffDays(week1, startOfWeek(key)) / 7 + 1 };
  }

  function weekKey(key) {
    const { year, week } = isoWeek(key);
    return year + '-W' + pad(week);
  }

  function weekKeyStart(wk) {
    const [y, w] = wk.split('-W').map(Number);
    return addDays(startOfWeek(y + '-01-04'), (w - 1) * 7);
  }

  // ---- Périodes : day 'AAAA-MM-JJ', week 'AAAA-Wss', month 'AAAA-MM', quarter 'AAAA-Qn', year 'AAAA'

  function periodOf(scope, key) {
    switch (scope) {
      case 'day': return key;
      case 'week': return weekKey(key);
      case 'month': return key.slice(0, 7);
      case 'quarter': return key.slice(0, 4) + '-Q' + (Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1);
      case 'year': return key.slice(0, 4);
      default: return null;
    }
  }

  function periodRange(scope, p) {
    switch (scope) {
      case 'day': return [p, p];
      case 'week': { const s = weekKeyStart(p); return [s, addDays(s, 6)]; }
      case 'month': {
        const [y, m] = p.split('-').map(Number);
        return [p + '-01', p + '-' + pad(daysInMonth(y, m))];
      }
      case 'quarter': {
        const y = Number(p.slice(0, 4));
        const q = Number(p.slice(6));
        const m1 = (q - 1) * 3 + 1;
        return [y + '-' + pad(m1) + '-01', y + '-' + pad(m1 + 2) + '-' + pad(daysInMonth(y, m1 + 2))];
      }
      case 'year': return [p + '-01-01', p + '-12-31'];
      default: return [null, null];
    }
  }

  function shiftPeriod(scope, p, n) {
    switch (scope) {
      case 'day': return addDays(p, n);
      case 'week': return weekKey(addDays(weekKeyStart(p), 7 * n));
      case 'month': return addMonths(p + '-01', n).slice(0, 7);
      case 'quarter': return periodOf('quarter', addMonths(periodRange('quarter', p)[0], 3 * n));
      case 'year': return String(Number(p) + n);
      default: return p;
    }
  }

  function isPastPeriod(scope, p, ref) {
    return periodRange(scope, p)[1] < (ref || today());
  }

  function formatShort(key) {
    const d = parse(key);
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  function formatLong(key) {
    const d = parse(key);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function periodLabel(scope, p) {
    switch (scope) {
      case 'day': return cap(formatLong(p));
      case 'week': {
        const [s, e] = periodRange('week', p);
        return 'Semaine ' + Number(p.slice(6)) + ' · ' + formatShort(s) + ' – ' + formatShort(e);
      }
      case 'month': return cap(MONTHS[Number(p.slice(5, 7)) - 1]) + ' ' + p.slice(0, 4);
      case 'quarter': return p.slice(5).replace('Q', 'T') + ' ' + p.slice(0, 4);
      case 'year': return p;
      default: return '';
    }
  }

  const RELATIVE = {
    day: { '-1': 'Hier', 0: "Aujourd'hui", 1: 'Demain' },
    week: { '-1': 'Semaine dernière', 0: 'Cette semaine', 1: 'Semaine prochaine' },
    month: { '-1': 'Le mois dernier', 0: 'Ce mois-ci', 1: 'Le mois prochain' },
    quarter: { '-1': 'Le trimestre dernier', 0: 'Ce trimestre', 1: 'Le trimestre prochain' },
    year: { '-1': "L'an dernier", 0: 'Cette année', 1: "L'an prochain" },
  };

  // Libellé relatif ('Cette semaine', 'Demain'…) ou null si la période est plus éloignée.
  function relativeLabel(scope, p, ref) {
    const cur = periodOf(scope, ref || today());
    for (const n of [-1, 0, 1]) {
      if (shiftPeriod(scope, cur, n) === p) return RELATIVE[scope][n];
    }
    return null;
  }

  // Prochaine date d'une tâche répétée.
  function nextRepeat(repeat, key) {
    switch (repeat) {
      case 'daily': return addDays(key, 1);
      case 'weekdays': {
        let k = addDays(key, 1);
        while (weekday(k) === 0 || weekday(k) === 6) k = addDays(k, 1);
        return k;
      }
      case 'weekly': return addDays(key, 7);
      case 'monthly': return addMonths(key, 1);
      case 'yearly': return addMonths(key, 12);
      default: return null;
    }
  }

  // L'événement a-t-il lieu ce jour-là (récurrence, plage de plusieurs jours, exceptions) ?
  function occursOn(ev, key) {
    if (key < ev.date) return false;
    if (ev.exceptions && ev.exceptions.includes(key)) return false;
    if (!ev.repeat) return key <= (ev.endDate || ev.date);
    if (ev.repeatUntil && key > ev.repeatUntil) return false;
    switch (ev.repeat) {
      case 'daily': return true;
      case 'weekdays': { const w = weekday(key); return w !== 0 && w !== 6; }
      case 'weekly': return weekday(key) === weekday(ev.date);
      case 'monthly': return key.slice(8) === ev.date.slice(8);
      case 'yearly': return key.slice(5) === ev.date.slice(5);
      default: return false;
    }
  }

  // Jours affichés dans la grille d'un mois (semaines complètes, 4 à 6 lignes).
  function monthGrid(y, m1) {
    const first = y + '-' + pad(m1) + '-01';
    const start = startOfWeek(first);
    const offset = diffDays(start, first);
    const rows = Math.ceil((offset + daysInMonth(y, m1)) / 7);
    const days = [];
    for (let i = 0; i < rows * 7; i++) days.push(addDays(start, i));
    return days;
  }

  function timeToMin(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function minToTime(min) {
    min = Math.max(0, Math.min(24 * 60 - 1, min));
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  }

  return {
    MONTHS, MONTHS_SHORT, DAYS, DAYS_SHORT, pad, cap,
    toKey, parse, today, addDays, addMonths, diffDays, weekday, startOfWeek, daysInMonth,
    isoWeek, weekKey, weekKeyStart,
    periodOf, periodRange, shiftPeriod, isPastPeriod, periodLabel, relativeLabel,
    formatShort, formatLong, nextRepeat, occursOn, monthGrid, timeToMin, minToTime,
  };
});
