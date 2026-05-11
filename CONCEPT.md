# homebridge-fritz-platform-ng — LLM-managed Open-Source-Projekt

*"ng" = next generation. Arbeitsname; finaler npm-Paketname noch zu entscheiden.*

## Vision

Ein **wartungsfähiges Comeback** des seit Juni 2022 verwaisten `seydx/homebridge-fritz-platform`-Plugins. Ziel ist nicht ein vollständiger Rewrite, sondern eine **strukturell stabile Basis**, die mit modernen Homebridge-Versionen (≥2.0) und Node-Versionen (22/24) läuft, von der Community wieder genutzt werden kann und in der **Issue-Triage, Bugfixes und Releases von einem LLM-Agent automatisiert** werden — mit menschlicher Endkontrolle.

Die Hypothese: Ein gut gewartetes Plugin braucht keine 40h pro Woche eines Voll-Maintainers. Es braucht **konsistente, schnelle, korrekte Reaktion** auf Issues und Code-Reviews. Das ist eine Aufgabe, für die ein LLM gut geeignet ist, wenn der Rahmen stimmt.

## Rollen

| Rolle | Verantwortung |
|---|---|
| **Maintainer (PelleBot, menschlich)** | Repo-Owner, Final-Sign-off für Merges + Releases, Eskalations-Instanz, npm-Publish-Credentials, Strategie-Entscheidungen, Tonalität gegenüber Community |
| **LLM-Agent (Claude)** | First-Responder auf Issues, technische Triage, Reproducer-Versuche, Code-Patches als PRs, Code-Review für Community-PRs, Changelog-Entwürfe, Docs-Updates |
| **Community-Contributors** | Bug-Reports, Feature-Requests, gelegentliche Pull-Requests, alle via GitHub Issues / PRs |

Wichtig: Der LLM-Agent ist **kein Auto-Merger**. Jeder Merge in den `main`-Branch braucht explizite Maintainer-Approval. Der LLM produziert Vorschläge; der Maintainer entscheidet.

## Architektur

```
┌──────────────────────────────────────────────────────────────┐
│  GitHub Repository: PelleBot/homebridge-fritz-platform-ng     │
│  - main (protected, PR-only)                                 │
│  - dev (integration branch, optional)                        │
│  - feature/* branches                                        │
└──────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────┐
│  GitHub Actions         │    │  Claude Agent                │
│  - CI (lint+build+test) │◄──►│  - Issue-Triage              │
│  - Auto-Label           │    │  - Reproducer-Versuche       │
│  - Release-Publish      │    │  - PR-Entwürfe               │
│    (manuell getriggert) │    │  - PR-Reviews                │
└─────────────────────────┘    └──────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────┐
│  npm Registry           │    │  Maintainer (PelleBot)        │
│  @PelleBot/...           │    │  - Approves Merges           │
│  Versionierung:         │    │  - Triggers Releases         │
│  Semver + Beta-Tags     │    │  - Eskalationen              │
└─────────────────────────┘    └──────────────────────────────┘
```

### Konkrete Integrationspunkte

**Claude wird in vier Situationen aktiv:**

1. **Neues Issue** → GitHub Action ruft Claude → Claude liest Issue + `AGENTS.md` + Repo-State → schreibt strukturierte Antwort (Klärungs-Fragen, Label-Vorschläge, ggf. Reproducer)
2. **Neuer PR** → GitHub Action ruft Claude → Claude liest Diff + Tests + relevante Code-Bereiche → schreibt Review (Findings, Risiko-Einschätzung, Approval/Request-Changes)
3. **Maintainer-Command in Issue/PR-Kommentar** (z.B. `@claude please reproduce` oder `@claude propose a fix`) → Claude führt die spezifische Aktion aus
4. **Wöchentlicher Triage-Lauf** (Cron) → Claude geht alle offenen Issues durch, eskaliert was wirklich Maintainer-Zeit braucht, schließt eindeutig-stale Issues nach 90 Tagen ohne Aktivität

### CLAUDE.md / AGENTS.md im Repo

Diese Datei (bzw. ihr Nachfolger nach Standardisierung) ist der **Primär-Kontext**, den Claude bei jedem Run liest. Inhalte:

- Projekt-Scope (DECT-only? Volle Fritz-Abdeckung? Ist-Stand und Ziel-Stand)
- Architektur-Übersicht (welche Files machen was)
- Konventionen (Code-Style, Commit-Format, PR-Template)
- Bekannte Fallstricke (z.B. "fakegato-history ist nicht HAP-v2-kompatibel, gestubbt")
- Maintainer-Präferenzen (z.B. "lieber konservativ, kleinere PRs als große Refactors")
- Was Claude **nicht** entscheiden darf ohne Maintainer-Approval

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

**Erwarteter LLM-Kosten-Range** (Anthropic API, Claude Sonnet 4.6 als Default):
- Pro Issue-Triage: ~$0.05-0.20
- Pro PR-Review: ~$0.10-0.50 (abhängig von Diff-Größe)
- Pro Bugfix-PR-Entwurf: ~$0.30-2.00 (abhängig von Komplexität)
- Wöchentlicher Triage-Lauf über alle offenen Issues: ~$1-5

Bei ~10 Issues/Monat + ~5 PRs/Monat + wöchentlichem Triage: **~$20-50/Monat** als Rohschätzung. Maintainer-Zeit zusätzlich: ~2-4h/Monat für Reviews + Releases.

**Bei Aktivitäts-Spitzen** (z.B. Release-Welle, neue HB-Version mit Breaking Change): temporär ggf. 2-5x höher.

**Alternative Modelle:**
- **Claude Max Subscription** ($100-200/Monat): unlimitierter LLM-Einsatz, gut wenn Aktivität schwankt
- **Self-hosted Open-Source-LLM**: keine API-Kosten, aber höhere Hardware- + Komplexitäts-Kosten — für ein Hobby-OSS-Projekt nicht lohnend

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
