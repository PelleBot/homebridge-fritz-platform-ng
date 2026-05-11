# Contributing

Vielen Dank dass du zu `@pellebot/homebridge-fritz-platform` beitragen willst. Dieser Fork wird **LLM-unterstützt** gepflegt (siehe [`CONCEPT.md`](./CONCEPT.md)) — die Workflow-Erwartungen sind dadurch etwas anders als bei klassischen Open-Source-Projekten.

## Issues melden

Bevor du ein Issue öffnest, **bitte prüfe**:

1. **Ist das Issue schon offen oder gelöst?** Suche in [bestehenden Issues](https://github.com/PelleBot/homebridge-fritz-platform-ng/issues?q=is%3Aissue).
2. **Ist dein Anliegen im Scope?** Wenn es um Callmonitor, Presence, Network-Watcher, WoL, Childlock oder Telegram-Notifications geht — diese Subsysteme sind aus diesem Fork entfernt (siehe README). Issues dazu werden geschlossen mit Verweis auf den Original-Repo oder alternative Plugins.
3. **Hast du minimale Infos?** Ein Issue ohne Versions-Angaben + Logs + Config-Auszug ist schwer zu beantworten. Bitte das Issue-Template nutzen.

### Was ein guter Bug-Report enthält

- **Homebridge-Version**: `homebridge --version`
- **Node-Version**: `node --version`
- **Plugin-Version**: `npm ls -g @pellebot/homebridge-fritz-platform`
- **FritzBox-Modell** + **FRITZ!OS-Version** (siehe FritzBox-UI → System → Übersicht)
- **Konkretes Verhalten**: was hast du erwartet, was passiert stattdessen?
- **Reproduktionsschritte**: wie kann ich (oder ein anderer Tester) das Problem nachstellen?
- **Logs**: idealerweise mit `"debug": true` in der Plugin-Config, der relevante Ausschnitt (nicht 10.000 Zeilen)
- **Config-Auszug**: nur die relevante Plugin-Sektion, **ohne Passwort!**

## Pull Requests

**Vor dem PR**: bitte ein Issue öffnen (oder kommentieren), das die Änderung beschreibt. So vermeidest du Aufwand für Patches, die nicht in den Scope passen oder anders gelöst werden sollten.

### PR-Checkliste

- [ ] Eine Sache pro PR (kleine, fokussierte Änderungen)
- [ ] Commit-Messages folgen [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- [ ] Beschreibung im PR: Was ändert sich, warum, wie getestet
- [ ] Tests (falls anwendbar) — siehe `__tests__/` Verzeichnis
- [ ] Lint passt (`npm run lint`)
- [ ] `node --check` auf allen geänderten Dateien
- [ ] Bei Code-Änderungen am Plugin: idealerweise mit einer echten FritzBox getestet (oder gegen die Mocks falls vorhanden)
- [ ] CHANGELOG.md-Entry nicht selbst hinzufügen — das macht der Maintainer beim Release

### Was wir gerne hätten

Hohe Priorität (siehe [`ROADMAP.md`](./ROADMAP.md)):

- Test-Suite ausbauen (Mock-Layer für AHA-API)
- FRITZ!Smart Energy 250 OBIS-Reader-Verbesserungen (Phase 2.3)
- `config.schema.json` Field-Hilfetexte verbessern (Phase 2.1 noch nicht ganz fertig)
- energy-meter accType ins Schema aufnehmen (Phase 2.1)
- Doku-Verbesserungen, vor allem zur Migration vom Original
- Sauberere Logging-Strukturen

Niedrige Priorität / wahrscheinlich abgelehnt:

- Wiederherstellung der entfernten Subsysteme (Callmonitor, Presence, etc.) — siehe README
- Große Refactors ohne klaren Mehrwert (CommonJS → ESM im src/-Tree)
- Features für Geräte die der Maintainer nicht im Testbestand hat (z.B. Rollläden) — können angenommen werden, aber langsamere Iteration

## Code-Konventionen

- **CommonJS** im `src/`-Baum (intentional, minimal-patch-Prinzip)
- **ESM** nur im `index.mjs`-Entrypoint (HB 2.0 Anforderung)
- **HAP-Charakteristiken** über String-Literale (`'uint32'`, `'pr'`, etc.), nicht über `Characteristic.Formats.X`-Statics (siehe Eve-Types-Port)
- **ES6-Klassen** für neue Custom-Characteristics (siehe `eve.types.js` als Vorlage)
- **Keine** direkte Veränderung der HAP-Standard-Services (kein `Service.X = function() {...}`)

## Maintenance-Workflow

Wenn du ein PR öffnest:

1. CI läuft automatisch (Lint + Build + Tests).
2. Der Maintainer reviewed in den nächsten 1-7 Tagen.
3. Bei Bedarf wird der Maintainer den Patch in einer LLM-Session diskutieren (das ist intern, du siehst nur das Review-Ergebnis).
4. Bei Approval: Merge in `main`, Aufnahme in den nächsten Release.

**Du wirst niemals automatische Bot-Antworten von uns bekommen.** Wenn 7 Tage keine Reaktion kommt, gerne nachfragen — manchmal ist Realität schneller als Github-Notifications.

## Credits

Dieser Fork baut auf der jahrelangen Arbeit von **Seyit Bayraktar (SeydX)** auf — siehe Original [`SeydX/homebridge-fritz-platform`](https://github.com/SeydX/homebridge-fritz-platform). Weitere Credits:

- [@ulfalfa](https://github.com/ulfalfa) für das modifizierte **TR064**-Modul
- [@simont77](https://github.com/simont77/fakegato-history) für **FakeGato** (im Fork als No-Op gestubbt)
- [@tbasse](https://github.com/tbasse/fritzbox-callmonitor) für die ursprüngliche **Callmonitor**-Implementierung (im Fork nicht enthalten)
- AVM für DECT-Hardware + AHA-HTTP-Interface-Doku
- Alle Beta-Tester und Issue-Reporter aus dem Original-Repo
