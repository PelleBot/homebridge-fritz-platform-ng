# @pellini/homebridge-fritz-platform — LLM-co-maintained Open-Source-Projekt

*GitHub-Repo public, npm-Release als beta unter `@pellini/homebridge-fritz-platform`.*

## Vision

Ein **wartungsfähiges Comeback** des seit Juni 2022 verwaisten `seydx/homebridge-fritz-platform`-Plugins. Ziel ist nicht ein vollständiger Rewrite, sondern eine **strukturell stabile Basis**, die mit modernen Homebridge-Versionen (≥2.0) und Node-Versionen (22/24) läuft, von der Community wieder genutzt werden kann und in der **Issue-Triage, Bugfixes und Releases von einem LLM-Agent automatisiert** werden — mit menschlicher Endkontrolle.

Die Hypothese: Ein gut gewartetes Plugin braucht keine 40h pro Woche eines Voll-Maintainers. Es braucht **konsistente, schnelle, korrekte Reaktion** auf Issues und Code-Reviews. Das ist eine Aufgabe, für die ein LLM gut geeignet ist, wenn der Rahmen stimmt.

**Wichtige Klarstellung zur Autonomie:** Der LLM-Agent arbeitet **nicht autonom**. Der Maintainer ist Operator und gibt jede Anweisung manuell — typischerweise via Claude Desktop / Cowork / Claude Code auf seinem eigenen Rechner. Der LLM produziert dann Files (Code, Docs, Issue-Antworten, PR-Reviews), die der Maintainer prüft und committed/postet. Es gibt **keine GitHub-Actions-Auto-Trigger** auf Claude, keinen Bot-Account der unaufgefordert in Issues kommentiert.

Im Resultat: der LLM **verantwortet die Files im Repo** (Code-Qualität, Docs-Aktualität, Konsistenz), der Maintainer entscheidet was gemacht wird und wann.

## Rollen

| Rolle | Verantwortung |
|---|---|
| **Maintainer (PelleBot, menschlich)** | Repo-Owner, Operator (entscheidet was passiert), Kommunikation mit Community in Issues/PRs, npm-Publish-Credentials, Strategie, Final-Merge in `main`, Eskalations-Instanz |
| **LLM-Agent (Claude, on-demand)** | Wird vom Maintainer manuell invoked (lokal via Cowork/Claude Code). Schreibt Code-Patches, Docs, Issue-Antworten, PR-Reviews als **Vorschläge** in lokale Files / Drafts. Maintainer reviewed + applied. Verantwortet **Konsistenz und Qualität der Files** im Repo. |
| **Community-Contributors** | Bug-Reports, Feature-Requests, gelegentliche Pull-Requests, alle via GitHub Issues / PRs |

Der LLM-Agent ist **kein Bot-Account auf GitHub**. Es gibt keine automatischen Antworten auf Issues. Die Community sieht den Maintainer als Ansprechpartner; intern nutzt der Maintainer Claude als Werkzeug zur Beschleunigung.

## Architektur

```
┌────────────────────────────────────────────────────────────────┐
│  GitHub Repository: PelleBot/homebridge-fritz-platform          │
│  (public, MIT, branch-protected main, PR-only)                 │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────┐
│  GitHub Actions (kein Claude!)      │
│  - CI: lint + node --check + tests  │
│  - Manuelles Release-Publish        │
└─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────┐
│  npm Registry                       │
│  @pellini/homebridge-fritz-platform │
│  Tag: `beta` (unlisted),            │
│  später `latest` nach Burn-in       │
└─────────────────────────────────────┘


Separat dazu, am Rechner des Maintainers:

┌─────────────────────────────────────┐
│  PelleBot' M4 / Claude Desktop       │
│  - Cowork-Sessions auf dem Repo     │
│  - Claude Code für tiefere Tasks    │
│  - AGENTS.md als Briefing-Kontext   │
└─────────────────────────────────────┘
            │
            │ User: "Read this issue, propose response"
            │ User: "Write a fix for #42"
            │ User: "Review PR #17 — security risks?"
            ▼
       Claude liefert Files / Texte
            │
            ▼
   Maintainer reviewed + commited/posted
            │
            ▼
       GitHub Repo / Issue-Antwort
```

### Wann Claude eingesetzt wird

Vier typische Situationen, alle vom Maintainer initiiert:

1. **Neues Issue** → Maintainer fragt Claude lokal: "Lies dieses Issue, schreib mir einen Vorschlag für die Antwort und welche Labels sinnvoll sind." → Claude liefert Antwort-Draft + Label-Vorschlag → Maintainer postet/labelt selbst auf GitHub.
2. **Bug zu fixen** → Maintainer beschreibt Claude den Bug, gibt Reproducer-Logs → Claude schreibt Patch als lokalen Branch → Maintainer reviewed Diff, pushed selbst und öffnet PR.
3. **PR von Contributor reviewen** → Maintainer wirft Diff in Claude-Session: "Sicherheits-Risiken? Stilkonflikte? Test-Coverage?" → Claude liefert strukturierte Review → Maintainer postet eigene Worte auf GitHub.
4. **Release vorbereiten** → Maintainer fragt Claude: "Welche Commits seit Tag X? Schreib Changelog-Entry." → Claude generiert Changelog-Section → Maintainer fügt ein, taggt, publisht via Workflow.

In **keiner** dieser Situationen interagiert Claude direkt mit GitHub. Maintainer ist immer der mensch-sichtbare Akteur.

### AGENTS.md im Repo

Datei im Repo-Root, primär für **Claude-Sessions des Maintainers** (nicht für GitHub Actions). Inhalte:

- Projekt-Scope (DECT-only, was bewusst rausfällt)
- Architektur-Übersicht (welche Files machen was, Migration-Kontext von v6.0.19 → v6.1.x)
- Konventionen (Code-Style, Commit-Format, Eve-Charakteristiken via String-Literalen)
- Bekannte Fallstricke (z.B. "fakegato-history ist HAP-v2-inkompatibel, gestubbt; custom.types.js noch nicht ES6-portiert")
- Maintainer-Präferenzen (lieber konservativ, kleinere PRs, ehrlich über Limitationen kommunizieren)
- Welche Antwort-Tonalität in Issue-Antworten (z.B. "freundlich-präzise, immer mit Quellen wenn HAP-Spec zitiert wird")

`AGENTS.md` ist im Repo öffentlich — andere LLM-Maintainer können das Pattern adoptieren. Die Datei dient gleichzeitig als Transparenz-Statement: "So wird dieses Projekt gewartet."

## Workflows (Patterns)

### Issue-Triage

Wenn ein User ein neues Issue öffnet:

1. Auto-Labels: `needs-triage`, ggf. `bug` oder `feature` aus Template-Auswahl
2. Claude antwortet binnen ~5 Minuten mit:
   - Bestätigung dass das Issue gesehen wurde
   - Klärungsfragen falls Reproducer fehlt (HB-Version, Node-Version, Logs, Config-Auszug)
   - Falls Reproducer mitgegeben: Versuch der Reproduktion in CI-Sandbox
   - Verlinkung auf ähnliche Issues
3. Maintainer (oder Claude bei wiederholten Lauf) bestätigt nach 24-48h und entscheidet:
   - `confirmed` (wird angegangen)
   - `wont-fix` (mit Begründung)
   - `needs-more-info` (auf User warten)
   - `duplicate` (verlinken, schließen)

### Pull-Request-Lifecycle

**Claude-initiierter PR (häufiger Fall für Bugfixes):**
1. Claude erstellt Branch `claude/fix-<issue-nr>` mit Patch
2. CI läuft (lint, build, automated tests gegen Sandbox-FritzBox-Mock)
3. Claude schreibt PR-Beschreibung mit: Root-Cause, Fix-Approach, Test-Coverage, Risiko-Einschätzung
4. Maintainer reviewed (typisch 1-15 min), merged oder kommentiert
5. Bei Merge: Auto-Changelog-Entry, kein automatisches Release

**Community-PR:**
1. Contributor öffnet PR
2. CI läuft
3. Claude schreibt Initial-Review: Code-Quality, Konventionen, mögliche Regressionen, Tests vorhanden?
4. Maintainer entscheidet (review weiter, Änderungen anfordern, mergen)

### Release-Management

- **Patch-Release** (z.B. 6.1.0 → 6.1.1): Maintainer triggert `Release Patch`-Workflow, Claude erstellt Changelog-Eintrag aus den seit letztem Release gemergten PRs
- **Minor-Release** (6.1.x → 6.2.0): Wie Patch, plus Claude prüft auf Breaking Changes (sollte keine geben)
- **Major-Release** (6.x → 7.0.0): Vollständiges Konzept-Review nötig, Maintainer-only

Versions-Tags auf npm:
- `latest` — stabilste Version
- `beta` — frischer Code, getestet aber nicht in Mehrheits-Use
- `next` — experimentelle Features

### Eskalations-Patterns (LLM → Mensch)

Claude eskaliert immer wenn:
- Issue erwähnt Datenverlust, Sicherheits-Vorfall, oder Schaden an physischer Hardware
- PR ändert die HAP-Bridge-Identity-Logik (Risiko für alle bestehenden Pairings)
- Community-User ist aggressiv / beleidigend
- Technische Entscheidung würde signifikanten Refactor auslösen (>500 LOC oder >5 Files)
- Lizenz-/Copyright-Frage taucht auf
- npm-Publish-Konflikt mit anderen Plugins

Bei diesen Eskalations-Triggern stoppt Claude die automatische Antwort und schreibt stattdessen einen GitHub-Mention an den Maintainer mit Kontext.

## Governance & Sicherheits-Grenzen

Was Claude **darf**:
- Code-Patches als PRs vorschlagen
- Issues kommentieren, labeln, klären
- PRs reviewen (Comments only, kein Merge)
- Changelog-Einträge entwerfen
- Docs aktualisieren
- Stale-Issues nach klarer Policy schließen

Was Claude **nicht darf**:
- Direkt in `main` pushen
- Releases publishen
- Issues ohne Maintainer-Approval als `wont-fix` schließen
- Kommunizieren mit externen Maintainer-Accounts (z.B. Original-Upstream)
- Plugin-Konfiguration **bestehender User** aus der Ferne ändern (gibt's eh nicht; nur zur Klarheit)
- Auf private/sensible Inhalte zugreifen (Tokens, Credentials, PII)

Was nur der **Maintainer (PelleBot)** darf:
- Final-Merge in `main`
- Release-Trigger (manueller Workflow-Run)
- Branch-Protection-Settings ändern
- npm-Publish-Credentials verwalten
- Repo-Permissions / Collaborators verwalten
- Issues schließen die nicht eindeutig stale sind

## Kosten- und Aufwandsmodell

Da Claude **on-demand vom Maintainer** invoked wird (kein GitHub-Action-Auto-Trigger), fällt die LLM-Cost in die regulären Claude-Subscription / API-Calls des Maintainers. Es gibt **keine separaten Projekt-Kosten** für den LLM-Einsatz.

**Realistische Maintainer-Zeit-Schätzung:**
- ~30-60 min pro neues Issue (lesen, Claude-Session, antworten, ggf. Label)
- ~60-120 min pro Bugfix (Reproduzieren, Claude-Session für Patch, Review, PR öffnen + mergen)
- ~30 min pro Release (Changelog generieren mit Claude, npm-Publish triggern, Announcement)

Bei moderater Aktivität (~10 Issues/Monat, ~4 PRs/Monat, ~1 Release/Monat): **~10-15h Maintainer-Zeit pro Monat**.

Wenn diese Zeit ohne LLM-Unterstützung kommt: realistisch eher 25-40h/Monat. Der LLM-Boost spart also signifikant — ohne dass Cost-/Compliance-Risiken durch Auto-Bots entstehen.

## Definition of "Productive Version"

Ein Release ist *productive-ready* wenn:

1. Plugin lädt unter Homebridge 1.6.0+ und 2.0.0+
2. Node 22 und Node 24 supported
3. CI green: Lint, Unit Tests, Integration Tests gegen FritzBox-Mock
4. Alle DECT-Geräte-Typen funktional (Thermostat, Lightbulb, Outlet, Temperature, Humidity, Switch, Window, Smoke, Contact, Button, Blind)
5. README erklärt Installation, Config-Beispiele, bekannte Limitationen
6. CHANGELOG dokumentiert alle Änderungen seit letztem Release
7. Maintainer hat mit eigener produktiver Instanz mindestens 48h problemfrei laufen lassen

## Risiken & Bekannte Beschränkungen

- **LLM-Fehlentscheidungen**: Claude kann falsche technische Schlüsse ziehen. Mitigation: Maintainer-Review bei allem was nicht eindeutig ist.
- **Tonalität gegenüber Community**: Claude kann zu formal oder zu informell sein. Mitigation: Stil-Guide in `AGENTS.md`, regelmäßige Checks durch Maintainer.
- **Reproducer-Fähigkeit**: Komplexe FritzBox-spezifische Bugs sind ohne echte Hardware schwer zu reproduzieren. Mitigation: Mock-Layer + klare Reproducer-Templates für Issue-Reporter.
- **Aufgabe der Beta-Maintainerschaft**: Wenn `@seydx` jemals zurückkommt, wie verhalten wir uns? — Antwort: Original-Repo erkennen wir als Upstream-Inspiration an, unser Fork hat eigenständige Roadmap, Brücken bleiben offen.
- **HomeKit-Plattform-Lock-in**: Wenn Apple HomeKit signifikant ändert oder einstellt, müssen wir reagieren. Mitigation: konservative Architektur, keine zu tiefen HAP-Spezifika.

## Erfolgs-Metriken (12-Monats-Horizont)

- 1.500+ wöchentliche npm-Downloads (Vergleich: Original-Plugin hatte vor Stillstand ~400)
- Median-Antwortzeit auf neue Issues: <12h
- Median-PR-Review-Zeit: <48h
- 4-8 Releases im Jahr
- Keine kritischen Security-Issues unbeantwortet >7 Tage
- Maintainer-Aufwand: <5h/Monat
