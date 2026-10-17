// Synchronisation entre appareils (G) via un gist secret GitHub.
// Le jeton reste dans le localStorage de chaque appareil (clé à part, jamais exportée ni synchronisée).
// Les données locales restent la référence : sans réseau, l'application fonctionne comme avant.
(function () {
  'use strict';

  const KEY = 'organise.sync';
  const FILE = 'organise.json';
  const API = 'https://api.github.com';
  const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Organisation';

  let conf = readConf(); // { token, gistId, lastSync }
  let status = conf.gistId ? 'idle' : 'off'; // off | idle | syncing | ok | offline | error
  let message = '';
  let timer = null;
  let running = null;
  let again = false;
  const listeners = [];

  function readConf() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function writeConf() {
    try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch (e) { /* stockage indisponible */ }
  }
  function setStatus(s, msg) {
    const wasError = status === 'error';
    status = s;
    message = msg || '';
    if (s === 'error' && !wasError) U.toast('Synchronisation : ' + message);
    listeners.forEach((fn) => fn());
  }

  async function api(path, opts) {
    const res = await fetch(API + path, Object.assign({ cache: 'no-store' }, opts, {
      headers: { Authorization: 'Bearer ' + conf.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    }));
    if (res.status === 401) throw new Error('jeton refusé par GitHub (expiré ou révoqué).');
    if (res.status === 403 || res.status === 404) throw new Error('accès au gist impossible : vérifiez que le jeton a le droit « gist ».');
    if (!res.ok) throw new Error('GitHub a répondu ' + res.status + '.');
    return res.json();
  }

  // Réutilise le gist d'un autre appareil déjà connecté, sinon en crée un secret.
  async function findOrCreate() {
    for (let page = 1; page <= 10; page++) {
      const list = await api('/gists?per_page=100&page=' + page);
      const found = list.find((g) => g.files && g.files[FILE]);
      if (found) return found.id;
      if (list.length < 100) break;
    }
    const created = await api('/gists', {
      method: 'POST',
      body: JSON.stringify({ description: 'Organisation : données synchronisées', public: false, files: { [FILE]: { content: M.serialize(S.state) } } }),
    });
    return created.id;
  }

  async function readRemote() {
    const gist = await api('/gists/' + conf.gistId);
    const file = gist.files[FILE];
    if (!file) return null;
    // Au-delà d'environ 1 Mo, l'API tronque le contenu : il faut le lire à part.
    const text = file.truncated ? await (await fetch(file.raw_url, { cache: 'no-store' })).text() : file.content;
    const data = JSON.parse(text);
    return M.isValidState(data) ? M.normalize(data) : null;
  }

  async function run() {
    const remote = await readRemote();
    if (remote && S.merge(remote)) refreshPeek();
    const out = M.serialize(S.state);
    if (!remote || out !== M.serialize(remote)) {
      await api('/gists/' + conf.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: out } } }) });
    }
  }

  // Ne réaffiche pas le panneau latéral pendant une saisie dedans.
  function refreshPeek() {
    const panel = document.querySelector('.peek');
    if (window.P && P.current && !(panel && panel.contains(document.activeElement))) P.render();
  }

  function sync() {
    if (!G.connected) return Promise.resolve();
    if (running) { again = true; return running; }
    clearTimeout(timer);
    if (!navigator.onLine) { setStatus('offline'); return Promise.resolve(); }
    setStatus('syncing');
    running = run().then(() => {
      conf.lastSync = Date.now();
      writeConf();
      setStatus('ok');
    }, (e) => {
      if (e instanceof TypeError) setStatus('offline'); // réseau coupé ou GitHub injoignable
      else setStatus('error', e instanceof SyntaxError ? 'le fichier du gist est illisible.' : e.message);
    }).finally(() => {
      running = null;
      if (again) { again = false; sync(); }
    });
    return running;
  }

  const G = {
    TOKEN_URL,
    get connected() { return !!(conf.token && conf.gistId); },
    get status() { return status; },
    get message() { return message; },
    get lastSync() { return conf.lastSync || null; },
    onChange(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    sync,
    // Appelé après chaque enregistrement local : envoie les modifications peu après.
    schedule() {
      if (!G.connected) return;
      clearTimeout(timer);
      timer = setTimeout(sync, 2000);
    },
    async connect(token) {
      conf = { token: token.trim() };
      try {
        conf.gistId = await findOrCreate();
      } catch (e) {
        conf = {};
        throw e instanceof TypeError ? new Error('GitHub injoignable : vérifiez la connexion.') : e;
      }
      writeConf();
      await sync();
    },
    disconnect() {
      clearTimeout(timer);
      conf = {};
      try { localStorage.removeItem(KEY); } catch (e) { /* rien à effacer */ }
      setStatus('off');
    },
    start() {
      sync();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
      window.addEventListener('online', sync);
      // Rattrape les modifications de l'autre appareil pendant que l'application est ouverte.
      setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60000);
    },
  };

  window.G = G;
})();
