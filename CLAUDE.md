# To-do + calendrier

Plateforme personnelle d'organisation, style Notion sobre : tâches par période, calendrier, objectifs par horizon.

## Stack
- HTML, CSS et JavaScript sans framework, sans dépendance ni build. Scripts classiques (pas de modules ES) pour que `index.html` s'ouvre aussi en `file://`.
- Données dans `localStorage`, clé `organise.v1` : `{ version, tasks[], events[], goals[], settings, settingsAt, deleted }`. Export/import JSON depuis les Paramètres.
- Synchro entre appareils : gist secret GitHub (fichier `organise.json`). Chaque élément a `updatedAt` (ms), les suppressions laissent une trace dans `deleted { id: ms }`, et la fusion garde la version la plus récente élément par élément (`M.stamp`, `M.merge`). Le jeton GitHub est dans la clé `organise.sync`, jamais exportée ni synchronisée.
- Sauvegardes automatiques locales (clé `organise.backups`, 10 max) : à l'ouverture d'une nouvelle version, une fois par jour, et avant import, effacement ou restauration (`M.backupReason`, `M.addBackup`, `S.restore`). Restauration depuis les Paramètres ; elle redate les éléments pour l'emporter sur la synchro.
- PWA : `manifest.webmanifest` et `sw.js` (cache puis mise à jour en arrière-plan, ne touche pas à l'API GitHub). Si un fichier est ajouté, l'ajouter à `SHELL` dans `sw.js`.
- Dates en clés locales `AAAA-MM-JJ`. Périodes : jour `AAAA-MM-JJ`, semaine ISO `AAAA-Wss`, mois `AAAA-MM`, trimestre `AAAA-Qn`, année `AAAA`.

## Structure
- `js/dates.js` (D) et `js/model.js` (M) : logique pure, testée, utilisable dans Node et le navigateur.
- `js/core.js` : stockage (S), interface (U), composants (C), registre d'actions (A). `S.save` date les modifications ; `S.merge` applique l'état d'un autre appareil.
- `js/sync.js` (G) : client Gist, synchro à l'ouverture, au retour sur l'app, toutes les 60 s et 2 s après chaque modification.
- `js/views.js` (V) : Aujourd'hui, Tâches, Calendrier, Objectifs. `js/peek.js` (P) : panneau d'édition latéral.
- `js/app.js` : routage par hash (`#/today`, `#/tasks/week/2026-W42`, `#/calendar/month/2026-10-16`, `#/goals/year`), raccourcis, recherche, paramètres.
- Interactions : attributs `data-act="nom"` → fonction `A['nom']`, délégation globale dans `app.js`.

## Commandes
- Lancer : ouvrir `index.html`, ou `python -m http.server 8765` puis http://localhost:8765 (service worker et installation seulement en http(s))
- Tester : `node --test` (tests dans `tests/`)

## Publier
- Avant chaque `git push` : `node --test` vert, puis augmenter `APP_VERSION` dans `js/core.js` (déclenche la sauvegarde « Avant une mise à jour » sur chaque appareil).
- GitHub Pages met en ligne en ~1 min ; les apps installées voient la nouveauté à l'ouverture suivante.

## Principes
- Projet personnel : rester simple. Pas de fonctionnalité ni d'abstraction qui ne sert pas maintenant.
- Une fonctionnalité à la fois, testée avant de passer à la suivante. Toute logique de date ou de données va dans `dates.js` / `model.js` avec un test.
- Avant d'ajouter une dépendance, vérifier qu'on ne peut pas s'en passer.
- Design : tokens de couleur dans `:root` (clair + sombre), pastels uniquement pour le sens (étiquettes, événements), pas d'emoji.
