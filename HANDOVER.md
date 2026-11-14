# Übergabe — @pellebot/homebridge-fritz-platform-hb2

Stand: 2026-11-14 · Anlass: Wechsel des Claude-Kontos auf **Claude Team**

Dieses Dokument richtet sich an die nächste Claude-Session (und an PelleBot). Es fasst zusammen, wo das Projekt steht, was offen ist und worauf beim Kontowechsel zu achten ist. Es ersetzt **nicht** `AGENTS.md` — die bleibt der Primärkontext und ist zuerst zu lesen.

---

## 1. Kurzüberblick

| | |
|---|---|
| Repo | `PelleBot/homebridge-fritz-platform-ng` (public, MIT, Default-Branch `main`) |
| npm-Paket | `@pellebot/homebridge-fritz-platform-hb2` |
| Neueste npm-Version | **1.2.0** (veröffentlicht 2026-05-14) |
| Neueste Version im Repo | **1.1.1** (`package.json`, Commit `3ff423f`) — siehe Abschnitt 3, Punkt 1 |
| Laufzeit | Homebridge 1.6+/2.x, Node `^22.12.0 \|\| ^24.0.0` |
| Produktivsystem | M4-Mac des Maintainers (12 Thermostate, 1 Lampe, 2 Tempsensoren, Smart Energy 250 OBIS-Reader, Router-Switches Gast-WLAN/WPS) |
| CI | `.github/workflows/ci.yml` — Syntax-Check, CJS-/ESM-Ladetest, Mock-Registrierung auf Node 22 + 24; Lint läuft, darf aber fehlschlagen |
| Tests | keine Unit-/Integrationstests (Roadmap Phase 1.1) |

Release-Historie (Details in `CHANGELOG.md`):

- **v1.0.0** (2026-05-13) — erstes Production-Release unter neuem Paketnamen
- **v1.1.0** (2026-05-13) — Custom-UI-Setup-Wizard in `homebridge-ui/` (5 Schritte: Verbindung, Geräte, Smart Energy 250, Router-Switches, Speichern)
- **v1.1.1** (2026-05-14) — neuer accType `energy-light` (LightSensor-Variante zu `energy-temperature`)
- **v1.2.0** (2026-05-14) — auf npm veröffentlicht, **Quellstand nicht im Repo**, kein CHANGELOG-Eintrag

---

## 2. Offene GitHub-Issues (Stand 2026-11-14, keine offenen PRs)

### #2 — Child-Bridge crasht bei `windowOpen: 1` (Bug, **höchste Priorität**)

- Gemeldet mit v1.2.0, HB 2.4.0, Node 22, FRITZ!Box 5590 Fiber / FRITZ!OS 8.02.
- Fehler: `TypeError: historyService.getInitialTime is not a function` in `src/accessories/smarthome/smarthome.handler.js:144`. Nach 5 Crashes stoppt Homebridge die Child-Bridge — das ganze Plugin fällt aus, solange ein Fenster offen ist.
- **Ursache (im Repo-Stand bestätigt):** Der fakegato-NoOp-Stub in `src/platform.js` (ca. Zeile 75–79) definiert nur `addEntry`, `cleanPersist`, `setExtraPersistedData`, `getExtraPersistedData`. `smarthome.handler.js` ruft im Contact/Window-Pfad zusätzlich `historyService.getInitialTime()` auf (Zeilen 108, 109, 126, 144, 145).
- **Vorschlag für den Fix:** Stub um `getInitialTime()` ergänzen (z.B. Zeitstempel beim Konstruieren speichern und zurückgeben). Minimal-invasiv, passt zum Minimal-Patch-Prinzip. Vorher prüfen, ob in v1.2.0 (Punkt 3.1) schon etwas geändert wurde.

### #1 — Setup-Wizard „Verbindung testen“ läuft endlos (Bug)

- Gemeldet mit v1.2.0, HB 1.11.14, Node 22, 7590 AX / FRITZ!OS 8.25, `ssl: true`.
- Manuelle Konfiguration funktioniert, nur der Wizard-Test hängt.
- Noch nicht analysiert. Erste Vermutung (unbestätigt): fehlender Timeout um den TR-064-/AHA-Aufruf in `homebridge-ui/server.js` oder SSL-Handshake mit selbstsigniertem Zertifikat. Der Test sollte in jedem Fall nach X Sekunden mit einer Fehlermeldung enden.
- Hinweis: Der Reporter hat Platzhalter statt echter Zugangsdaten gepostet — gut. Bei Rückfragen trotzdem an „Passwort REDACT“ erinnern.

### #3 — Node 26 unterstützen (Feature)

- Homebridge verweigert den Start, weil `engines.node` in `package.json` nur `^22.12.0 || ^24.0.0` erlaubt.
- Aufwand vermutlich klein: Node 26 in die CI-Matrix aufnehmen, Ladetests laufen lassen, dann `engines` erweitern. Risiko: `@seydx/fritzbox` 2.3.1 ist ohne Maintainer (AGENTS.md, Fallstrick 4) — auf Node 26 ausdrücklich testen.
- Laut AGENTS.md-Scope ist Node 22 + 24 festgelegt; Erweiterung auf 26 ist eine Scope-Änderung → **PelleBot entscheidet**, danach AGENTS.md anpassen.

---

## 3. Risiken und Unstimmigkeiten

1. **v1.2.0 fehlt im Repo.** npm meldet für 1.2.0 `gitHead = 3ff423f` (= Commit von v1.1.1). Das heißt: 1.2.0 wurde aus einem Arbeitsstand mit **nicht committeten Änderungen** gepublisht, vermutlich aus dem lokalen Klon auf dem M4. Es gibt weder Tag noch CHANGELOG-Eintrag noch Release-Notes.
   → **Vor jeder weiteren Änderung:** auf dem M4 im lokalen Klon `git status` / `git diff` prüfen und den 1.2.0-Stand committen (oder aus dem npm-Tarball rekonstruieren: `npm pack @pellebot/homebridge-fritz-platform-hb2@1.2.0`). Sonst überschreibt das nächste Release die 1.2.0-Änderungen stillschweigend.
2. **`AGENTS.md` ist teilweise veraltet.** Stand dort ist v1.0.0 (2026-05-13). Es fehlen u.a. `energy-temperature`/`energy-light` und `homebridge-ui/` im Architekturbaum. Nach dem Klären von Punkt 1 aktualisieren.
3. **`ROADMAP.md` Abschnitt 0.5 (npm-Setup)** ist noch unabgehakt, obwohl bereits vier Versionen veröffentlicht sind. Bei Gelegenheit nachziehen.
4. **Branch-Protection für `main`** ist laut Roadmap (0.2) noch nicht eingerichtet. Ein `release.yml` gibt es ebenfalls nicht — Releases laufen manuell.
5. **fakegato-Stub** (AGENTS.md, Fallstrick 1): Issue #2 zeigt, dass der Stub unvollständig ist. Nach dem Fix einmal alle `historyService.`-Aufrufe in den **aktiven** Pfaden (`src/accessories/smarthome/`, `router/`, `extras/`) gegen den Stub abgleichen (die toten Verzeichnisse `callmonitor/`, `presence/` werden nicht geladen).
6. **Lose Dateien im Repo-Root:** `.release-notes-v1.1.0.md` und `.release-notes-v1.1.1.md` — gewollt als Release-Text-Vorlagen? Sonst nach `docs/` verschieben oder löschen (Maintainer-Entscheidung).

---

## 4. Vorschlag für die nächsten Schritte (Reihenfolge)

1. 1.2.0-Stand auf dem M4 sichern und committen (Punkt 3.1).
2. Fix für **#2** (fakegato-Stub um `getInitialTime` ergänzen), als v1.2.1.
3. **#1** analysieren: Timeout und Fehlerausgabe im Wizard-Verbindungstest.
4. Entscheidung zu **#3** (Node 26), dann CI-Matrix + `engines`.
5. `AGENTS.md` und `ROADMAP.md` auf aktuellen Stand bringen.

---

## 5. Checkliste Kontowechsel auf Claude Team

Die technische Seite des Projekts ändert sich durch den Wechsel nicht. Betroffen sind nur die Zugänge von Claude:

- [ ] **GitHub-Zugang neu verbinden** im neuen Team-Konto (claude.ai → Einstellungen → Connectors/GitHub) und sicherstellen, dass die Claude-GitHub-App Zugriff auf `PelleBot/homebridge-fritz-platform-ng` hat.
- [ ] **Claude-Desktop-App auf dem M4** mit dem Team-Konto neu anmelden. Hintergrund: Am 2026-11-10 war der OAuth-Token der laufenden Remote-Control-Sitzungen abgelaufen („API Error: 401“). Die Sitzungen laufen in der Desktop-App (kein tmux, kein separates `claude remote-control`); ein Neustart der App per `osascript -e 'quit app "Claude"'` + `open -a Claude` bzw. Neu-Login in der App behebt das.
- [ ] **Projekt-Kontext ist im Repo** (`AGENTS.md`, `CONCEPT.md`, `ROADMAP.md`, `CHANGELOG.md`, dieses Dokument) — er wandert automatisch mit. Nicht verifiziert ist, ob alte Sitzungsverläufe des bisherigen Kontos im Team-Konto sichtbar bleiben; davon nicht ausgehen.
- [ ] **npm-Publish** bleibt beim Maintainer (lokaler npm-Login mit 2FA). Claude publisht nicht (AGENTS.md).
- [ ] **Keine Zugangsdaten** (FritzBox-Passwort, npm-Token, IPs) in Repo, Issues oder Sitzungs-Prompts übernehmen.

---

## 6. Lesereihenfolge für die nächste Session

1. `AGENTS.md` (Regeln, Scope, Eskalations-Trigger)
2. dieses Dokument (`HANDOVER.md`)
3. `CONCEPT.md`, `ROADMAP.md`
4. `CHANGELOG.md` (v1.1.0, v1.1.1)
5. je nach Aufgabe: `src/platform.js`, `src/accessories/smarthome/smarthome.handler.js`, `homebridge-ui/server.js`
