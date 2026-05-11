# Roadmap — @pellebot/homebridge-fritz-platform

Ausgehend vom aktuellen Stand: ein funktionsfähiger HB-2.0-Minimal-Patch-Fork läuft produktiv auf einem M4-Mac mit 12 DECT-Thermostaten, 1 Lampe, 2 Tempsensoren. Code ist in `feat/hb2-minimal-patch` mit 9 Commits, noch nicht öffentlich gepublished.

**Distribution-Modell:**
- GitHub-Repo: **public** unter `PelleBot/homebridge-fritz-platform-ng` (oder gewähltem Namen)
- npm-Paket: **`@pellebot/homebridge-fritz-platform`**, anfangs nur unter `beta`-Tag (technisch im Index, aber nicht als "latest" — frühe Nutzer brauchen explizit `@beta`)
- Migration zu `latest`-Tag nach 2-4 Wochen produktiver Bestätigung

Die Roadmap ist in Phasen organisiert; **Phase 0 ist zwingend abzuschließen bevor Phase 1+** an die Community geht.

---

## Phase 0 — GitHub-Setup & Erstes Public Release

*Ziel: das Plugin ist auf GitHub + npm öffentlich, mit minimaler Dokumentation, läuft für jeden HB-2.0-Nutzer ohne Konfigurations-Schmerzen.*

### 0.1 Repository-Initialisierung

- [ ] Maintainer entscheidet finalen Repo-Namen + npm-Paket-Namen (Vorschlag: `homebridge-fritz-platform-ng` oder `@PelleBot/homebridge-fritz-platform-ng`)
- [ ] Neues GitHub-Repo unter `PelleBot/<name>` erstellen (public, MIT-License erbt von Upstream)
- [ ] Lokales Repo pushen, `feat/hb2-minimal-patch` als `main` setzen oder als Default-Branch konfigurieren
- [ ] Tag `v6.1.0-hb2patch.0` für aktuellen Stand setzen (markiert "running productively on M4")

### 0.2 Branch-Protection & CI-Skeleton

- [ ] Branch-Protection für `main`: PR-only, mindestens 1 Review (kann der LLM-Bot sein), Status-Checks erforderlich
- [ ] GitHub Actions Workflow `ci.yml`:
  - Trigger: PR, push to main
  - Steps: `npm ci`, `npm run lint`, `node --check src/**/*.js`, `node -e "import('./index.mjs')"`
  - Matrix: Node 22.x + 24.x
- [ ] GitHub Actions Workflow `release.yml` (manueller Trigger):
  - Erstellt Tag, Changelog-Entry, publisht auf npm mit konfigurierbarem Tag (`latest`/`beta`/`next`)

### 0.3 LLM-Briefing-File

**Kein GitHub-Auto-Trigger** in dieser Variante — Claude wird vom Maintainer manuell invoked (Cowork-Session lokal). Stattdessen brauchen wir nur den Briefing-Kontext im Repo:

- [x] `AGENTS.md` ins Repo-Root — Operating-Manual für Claude-Sessions (Scope, Konventionen, Fallstricke, Tonalität)
- [x] `CONCEPT.md` mit dem Solo-Maintainer-+-LLM-Modell beschrieben (kein Bot-Account)
- [x] `CLAUDE.md` als historisches Migration-Briefing erhalten (kann später in `docs/archive/` verschoben werden)

### 0.4 Docs & Templates (alle ✓ erstellt)

- [x] **README.md** komplett neu mit Scope, Migration-Hinweis, SeydX-Attribution, Lizenz-Erklärung
- [x] **CHANGELOG.md** mit v6.1.0-hb2patch.0 Release-Notes, historischer Original-Changelog erhalten
- [x] **CONTRIBUTING.md** mit Workflow, Konventionen, Out-of-Scope-Hinweisen
- [x] **LICENSE** mit Dual-Copyright (SeydX 2020 + PelleBot 2026), MIT unverändert
- [x] **.github/ISSUE_TEMPLATE/bug_report.yml** — strukturiertes Formular
- [x] **.github/ISSUE_TEMPLATE/feature_request.yml** — strukturiertes Formular
- [x] **.github/PULL_REQUEST_TEMPLATE.md** — PR-Checkliste
- [x] **.github/workflows/ci.yml** — Lint + Syntax + Plugin-Load auf Node 22 und 24

### 0.5 npm-Publish-Setup

- [ ] npm-Account-Setup, 2FA aktiviert
- [ ] **Scope-Reservierung**: `@pellebot/*` scope auf npm anlegen (kostenfrei für public packages)
- [ ] `.npmignore` checken — keine `.git`, `node_modules`, Test-Configs, lokale Backups, `homebridge-fritz-platform-*.tgz`
- [ ] Erstes Publish: `npm publish --tag beta --access public`
- [ ] Verifikation: `npm install @pellebot/homebridge-fritz-platform@beta` auf Test-System läuft
- [ ] Wichtig: NICHT mit `npm publish` (ohne `--tag beta`) — sonst wird `latest`-Tag gesetzt, was wir absichtlich vermeiden bis Burn-in durch ist

---

## Phase 1 — Stabilisierung & Tests

*Ziel: Foundation solide genug für Community-Use, keine peinlichen Lücken.*

### 1.1 Test-Infrastruktur

- [ ] Mock für FritzBox AHA-API (XML-Responses für alle DECT-Geräte-Typen)
- [ ] Mock für TR-064-SOAP-Endpoints (für die router/-Init, auch wenn der nicht aktiv genutzt wird)
- [ ] Unit-Tests für `smarthome.config.js` (Validierung der accTypes)
- [ ] Integration-Tests: Plugin-Load + 1 Accessory pro Typ, gegen Mocks
- [ ] Test-Coverage-Threshold in CI: mindestens 30% initial, Ziel 60% nach 6 Monaten

### 1.2 `custom.types.js` ES6-Port

- [ ] 22 Custom-Characteristics auf ES6-Klassen portieren (Pattern: wie eve.types.js, mit `declare`-Helper)
- [ ] Service.Switch-Override **nicht** portieren (HAP-v2-Risiko, nicht nötig)
- [ ] Test: produktive Config mit `hide: false` auf Router muss wieder funktionieren (= Router-Toggles in HomeKit sichtbar)
- [ ] Dokumentieren in CHANGELOG: "Router-Toggles (Wifi/DECT/etc.) wieder verfügbar"

### 1.3 fakegato-history Alternative

- [ ] Recherche: existieren aktiv gewartete HAP-v2-kompatible Forks?
- [ ] Falls ja: integrieren statt unseres NoOp-Stubs
- [ ] Falls nein: Entscheidung treffen — eigenen Mini-Fork vendoren ODER Eve-History endgültig aufgeben
- [ ] Dokumentieren: was Nutzer in der Eve App sehen können / nicht können

### 1.4 Bestehende Issues aus dem Upstream-Repo durchforsten

- [ ] Liste der 93 offenen Issues im Upstream-Repo (`seydx/homebridge-fritz-platform`) durchgehen
- [ ] Kategorisieren: Was ist im Fork-Scope, was nicht (Callmonitor, Presence etc. = nicht)
- [ ] In unserem Fork als Issues neu eröffnen, mit Verweis aufs Upstream-Original
- [ ] Triage durch LLM-Agent: was ist behoben durch unsere Migration, was bleibt offen
- [ ] Stale-Issues schließen mit klarer Begründung

### 1.5 Logging-Verbesserungen

- [ ] Strukturiertes Logging (Level, Component, Message-Format konsistent)
- [ ] Debug-Mode mit AHA-API-XML-Dump
- [ ] Sensitive-Data-Filter: niemals Credentials oder PINs in Logs
- [ ] Doc: wie man Bug-Reports mit sinnvollen Logs erstellt

---

## Phase 2 — Feature-Polish & DX

*Ziel: das Plugin ist genauso komfortabel zu benutzen wie Upstream-v6 in seinen besten Tagen, plus moderne Verbesserungen.*

### 2.1 Config-Schema

- [ ] `config.schema.json` von Out-of-Scope-Subsystemen bereinigen (callmonitor, presence, network, wol, childlock, extras) — die werden im Plugin eh nicht mehr gelesen, sollten dann auch nicht in der Config-UI angeboten werden
- [ ] Field-Hilfetexte verbessern (z.B. AIN-Format-Erklärung)
- [ ] energy-meter accType ins Schema aufnehmen (mit Hinweis "experimental, Apple Home zeigt Werte nicht nativ")

### 2.2 Accessory-Code-Pfade konsolidieren

- [ ] Doppelter Code in den 13 `*.accessory.js`-Files identifizieren
- [ ] Helper-Funktionen extrahieren (Battery-Service-Setup, HistoryService-Bootstrap, etc.)
- [ ] Keine funktionalen Änderungen, nur Reduktion der Code-Duplikation
- [ ] Vorher/Nachher LOC-Vergleich dokumentieren

### 2.3 Energy-Meter erweitern

- [ ] LightSensor-Variante als Optional-Mode hinter Config-Flag (`displayMode: "lightsensor"`) — für Nutzer die explizit Apple Home stock Display wollen
- [ ] Strom-Richtung (positiv vs negativ) sauberer auf Bezug/Einspeisung mappen
- [ ] Watt-Werte glätten (Moving Average optional) gegen FritzBox-Spikes
- [ ] Test mit echter Fritz!Smart Energy 250 sobald jemand aus der Community Zugriff hat

### 2.4 Performance & Observability

- [ ] Polling-Intervall-Konfiguration pro Device-Typ (statt globaler `polling.timer`)
- [ ] Metrics-Endpunkt? (Prometheus-Format, optional) — z.B. für Home-Assistant-Integration
- [ ] Crash-Recovery: was passiert wenn FritzBox 10 min unerreichbar ist?

---

## Phase 3 — Community & Wartungsbetrieb

*Ziel: Plugin ist eigenständig, Maintainer-Aufwand stabil bei ~2-4h/Monat.*

### 3.1 Issue-Triage-Workflow live nehmen

- [ ] LLM-Agent läuft auf jedes neue Issue mit ~5 Min Antwortzeit
- [ ] Maintainer-Review-SLA: 48h für nicht-Eskalations-Fälle, sofort für kritische
- [ ] Wöchentlicher Triage-Lauf eingerichtet (Cron + Claude über alle offenen Issues)

### 3.2 Release-Kadenz

- [ ] Patch-Releases (Bugfixes): alle 2-4 Wochen wenn Bedarf
- [ ] Minor-Releases: alle 2-3 Monate (neue Features, größere Tests)
- [ ] Major-Releases: nur bei zwingenden Breaking Changes (HB 3.0, Node-Version-Drop, etc.)

### 3.3 Telemetrie & Health (optional, opt-in)

- [ ] Optional anonyme Telemetrie zu Plugin-Versions-Verteilung (zur Steuerung der EOL-Politik)
- [ ] Klare Opt-in-Doku, default OFF
- [ ] Niemals: User-IPs, FritzBox-IPs, AINs, Geräte-Namen — nur Plugin-Version + Node-Version

### 3.4 Dokumentation für Power-User

- [ ] FAQ-Seite mit häufigen Fragen aus Issue-Tracker
- [ ] "Wie schreibe ich einen guten Bug-Report" — Vorbild für Issue-Reporter
- [ ] "Welche FritzBox-Modelle/Firmware sind getestet" — Kompatibilitäts-Matrix
- [ ] Migration-Guide von Upstream-v6.0.19 → unserem Fork

---

## Backlog (nicht priorisiert, gesammelte Ideen)

- **OBIS-Energy-Meter Phase 2**: wenn Apple jemals native Power-Anzeige bringt, Energy 250 vollständig integrieren
- **Matter-Bridge-Variante**: über homebridge-matterbridge zusätzlich exposable machen
- **Web-Dashboard**: kleines separates UI für Live-Werte, ergänzend zu Eve App
- **Home-Assistant-Integration**: Wenn jemand aus der Community parallel HA nutzt, eine Brücke skizzieren
- **i18n der Logs**: Deutsche + englische Log-Texte
- **Out-of-Scope-Subsysteme wieder anbieten**: Callmonitor / Presence — nur falls signifikante Community-Nachfrage entsteht, sonst NICHT (Komplexitäts-Falle)

---

## Was wir explizit NICHT machen

Klare Absagen helfen, Scope-Creep zu vermeiden:

- **Kein vollständiger Rewrite**. CommonJS bleibt im `src/`-Baum. ESM nur Außenhaut.
- **Kein Support für FritzBox-Modelle vor 7390 / FRITZ!OS 7.x**. Zu viele API-Quirks.
- **Keine Multi-FritzBox-Setups**. Ein FritzBox-Master, fertig.
- **Keine Zigbee-/Z-Wave-Integration**. Nur DECT + TR-064 + AHA-HTTP.
- **Kein Backwards-Compat auf HB 1.6.x**. Wenn HB 1.x Probleme hat, ist das ein "upgrade auf HB 1.8.5+"-Hinweis im Issue.
- **Keine GUI im Plugin selbst**. Config UI X ist das Front-End, da wir uns nicht reinhängen.

---

## Schnellster Pfad zu Phase 0 abgeschlossen

Wenn du **diesen Sonntag** (Wochenende ~4-6h Zeit) zum öffentlichen Release kommen willst, ist das die Reihenfolge:

1. (15 min) GitHub-Repo erstellen, lokales Repo pushen, Tag setzen
2. (45 min) README.md + CHANGELOG.md schreiben (Claude kann dir Drafts erstellen)
3. (30 min) Issue-Templates + CONTRIBUTING.md (Claude liefert Drafts)
4. (45 min) CI-Workflow `ci.yml` schreiben + testen
5. (30 min) AGENTS.md aus aktueller CLAUDE.md + diesen Docs zusammenführen
6. (30 min) Claude-Integration: Anthropic-Token anlegen, Workflow für Issue-Triage einsetzen
7. (45 min) Erstes npm-Publish unter `beta`-Tag
8. (60 min) Test-Install auf einer 2. Maschine (z.B. einer Linux-VM) gegen eine echte FritzBox, Smoke-Test
9. (30 min) Announcement-Post (Homebridge-Discord, vielleicht Reddit r/homebridge)

Phase 1+2+3 sind dann iterativer Maintenance-Aufwand über die nächsten 3-6 Monate.
