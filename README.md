# @pellebot/homebridge-fritz-platform

> Wartungs-Fork von [`SeydX/homebridge-fritz-platform`](https://github.com/SeydX/homebridge-fritz-platform), modernisiert für **Homebridge 2.0** und **Node.js 22/24**. Fokus: AVM DECT-Geräte (Thermostate, Lampen, Sensoren). Original-Plugin wurde seit Juni 2022 nicht mehr gepflegt.

[![npm version](https://img.shields.io/npm/v/@pellebot/homebridge-fritz-platform/beta.svg?style=flat-square)](https://www.npmjs.com/package/@pellebot/homebridge-fritz-platform)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Homebridge](https://img.shields.io/badge/homebridge-2.0%20%7C%201.8%2B-purple?style=flat-square)](https://github.com/homebridge/homebridge)
[![Node](https://img.shields.io/badge/node-22%20%7C%2024-green?style=flat-square)](https://nodejs.org/)

## Status

Dieser Fork läuft produktiv beim Maintainer mit 12 DECT-Thermostaten, 1 DECT-Lampe und 2 Temperatursensoren auf Homebridge 2.0.2-beta + Node 24. **Aktueller Stand: v6.1.0-hb2patch.1**.

Sobald auf npm gepublished:

```bash
npm install -g @pellebot/homebridge-fritz-platform@beta
```

Bis dahin: vom GitHub-Source-Tree installieren (siehe [Installation](#installation) unten).

## Was dieser Fork kann

Der Scope ist **bewusst kleiner** als das Original — wir konzentrieren uns auf das, was tatsächlich gepflegt und getestet wird:

- **FRITZ!DECT 301 / Comet DECT** (Heizkörper-Thermostate) — Soll-/Ist-Temperatur, Batterie-Status, Fenster-offen-Erkennung
- **FRITZ!Smart Light 500 / FRITZ!DECT 500** (DECT-Lampen) — An/Aus, Helligkeit, Farbe
- **FRITZ!Smart Control 440** (Temperatursensoren) — Temperatur, Batterie
- **FRITZ!DECT 200 / 210** (schaltbare Steckdosen) — An/Aus + Energiemessung
- **FRITZ!Smart Energy 250** (OBIS-Reader-Modus) — experimentell, eigener `accType: "energy-meter"`, Werte in Eve App sichtbar (Apple Home stock zeigt sie nicht)

Über `TR-064` wird die FritzBox-Verbindung initialisiert (für AHA-API-Auth). Das Router-Accessory selbst (WiFi-Toggles, DECT-Basis, WPS, Reconnect, AB, Rufumleitung etc.) ist **seit v6.1.0-hb2patch.1 wieder voll funktional** — die Custom-Charakteristiken sind ES6-portiert. Per default ist es `hide: false`; setze `hide: true` wenn du nur die DECT-Geräte willst und keine Router-Switches in HomeKit.

## Was dieser Fork bewusst NICHT macht

Aus dem Original entfernt oder nicht migriert (siehe `CONCEPT.md` für Begründung):

- **Callmonitor** (Fritz!Fon-Anrufüberwachung) — entfernt
- **Presence** (Wifi-Anwesenheits-Erkennung) — entfernt
- **Network-Watcher** (Geräte-Online-Status im LAN) — entfernt
- **Wake-on-LAN** — entfernt
- **Child Lock** (Internet-Sperren für Geräte) — entfernt
- **Extras** (DNS-Switch, Fallback-Internet, Phonebook etc.) — entfernt
- **Telegram-Notifications** — entfernt
- **`fakegato-history`** (Eve App History-Graphen) — als No-Op gestubbt, weil HAP-v2-inkompatibel

Wenn du eine dieser Funktionen brauchst, ist dieser Fork das falsche Plugin. Hier findest du Alternativen:

- Original (unmaintained, läuft nicht auf HB 2.0): [`SeydX/homebridge-fritz-platform`](https://github.com/SeydX/homebridge-fritz-platform)
- Modernes Callmonitor-Plugin: [`homebridge-callmonitor-display`](https://www.npmjs.com/search?q=homebridge%20callmonitor)
- Presence-Erkennung: [`homebridge-people`](https://www.npmjs.com/package/homebridge-people)

## Voraussetzungen

- **Homebridge** ≥ 1.8.5 oder ≥ 2.0.0
- **Node.js** ≥ 22.12.0 oder ≥ 24.0.0
- **FritzBox** mit aktiviertem **TR-064-Zugriff** + dediziertem User mit "Smart Home"-Berechtigung (FRITZ!OS 7.x oder neuer)
- Optional: **homebridge-config-ui-x** für die Web-UI

## Installation

```bash
# Wenn Homebridge selbst noch upgegradet wird:
npm install -g homebridge@latest homebridge-config-ui-x@latest
```

**Nach npm-Publish** (in Planung):

```bash
npm install -g @pellebot/homebridge-fritz-platform@beta
```

**Vor npm-Publish — direkt aus dem Git-Repo:**

```bash
git clone https://github.com/PelleBot/homebridge-fritz-platform-ng.git
cd homebridge-fritz-platform-ng
npm pack
# Erzeugt pellebot-homebridge-fritz-platform-<version>.tgz
npm install -g ./pellebot-homebridge-fritz-platform-*.tgz
```

Anschließend Homebridge neu starten (z.B. via Config UI X "Restart"-Button).

## Konfiguration

Minimal-Config (`~/.homebridge/config.json`):

```json
{
  "platforms": [
    {
      "platform": "FritzPlatform",
      "name": "FritzBox",
      "devices": [
        {
          "active": true,
          "name": "FritzBox",
          "host": "192.168.178.1",
          "username": "homebridge-user",
          "password": "DEIN_TR064_PASSWORT",
          "ssl": true,
          "tr064": true,
          "master": true,
          "hide": true
        }
      ],
      "smarthome": [
        {
          "active": true,
          "name": "Bad-Thermostat",
          "ain": "099950870710",
          "accType": "thermostat",
          "temperature": true,
          "window": true,
          "battery": true
        }
      ],
      "options": {
        "polling": {
          "timer": 30
        }
      }
    }
  ]
}
```

**Tipp zum Router-Accessory:** seit v6.1.0-hb2patch.1 funktioniert `hide: false` problemfrei — die Router-Switches (WiFi 2.4/5/Gast, WPS, DECT, AB, Reconnect, etc.) erscheinen dann in HomeKit als zusätzliche Tiles. Setze `hide: true` wenn du das nicht brauchst.

Vollständige Config-Optionen werden über das **Homebridge Config UI X** Plugin grafisch unterstützt — das Schema wurde im Fork von 73KB auf 32KB entschlackt (Out-of-Scope-Subsysteme entfernt).

## Migration vom Original-Plugin

Wenn du bisher das unmaintained Original (`homebridge-fritz-platform@6.0.19`) eingesetzt hast und auf diesen Fork wechselst:

1. **Backup** dein `~/.homebridge/` Verzeichnis (`cp -R ~/.homebridge ~/.homebridge.backup`)
2. **Update Homebridge auf 2.x**: `npm install -g homebridge@latest`
3. **Original-Plugin entfernen**: `npm uninstall -g homebridge-fritz-platform`
4. **Fork installieren**: `npm install -g @pellebot/homebridge-fritz-platform@beta`
5. **Config anpassen**: ggf. nicht-mehr-genutzte Subsysteme aus der Config entfernen (presence, callmonitor, wol, childLock, network, extras, telegram — werden eh ignoriert, aber sauberer wenn weg). Router-Accessory kann beim default `hide: false` bleiben.
6. **Homebridge neu starten**

Wenn du Accessory-UUIDs unverändert lässt (gleiche Device-Namen wie vorher), behält HomeKit das Pairing bei. Kein iPhone-Re-Pairing nötig.

## Issues melden

Bevor du ein Issue öffnest, bitte:
- Homebridge-Version (`homebridge --version`)
- Node-Version (`node --version`)
- Plugin-Version (`npm ls -g @pellebot/homebridge-fritz-platform`)
- FritzBox-Modell + FRITZ!OS-Version
- Relevante Log-Auszüge (idealerweise mit `"debug": true` in der Plugin-Config)
- Config-Auszug (ohne Passwort!)

Issue-Template im Repo führt dich durch alle Punkte.

## Maintenance-Modell

Dieser Fork wird **LLM-unterstützt** gepflegt (siehe [`CONCEPT.md`](./CONCEPT.md)). Konkret:

- PelleBot ist menschlicher Maintainer, Repo-Owner, Final-Reviewer
- Code-Patches, Doc-Updates und Issue-Antworten werden mit Hilfe eines LLM (Claude) entworfen
- Jede Änderung wird vom menschlichen Maintainer geprüft, bevor sie committed wird
- Es gibt **keine automatischen Bot-Antworten** auf Issues — Reaktionszeit kann daher etwas länger sein, dafür ist Qualität konsistent

Wenn du Maintainer werden willst (vor allem für die hier rausgenommenen Subsysteme): Issues mit Label `discussion` öffnen, oder direkt Pull Requests stellen.

## Credits & Lineage

Dieser Fork basiert auf der hervorragenden Vorarbeit von **Seyit Bayraktar (SeydX)** und seinem [`homebridge-fritz-platform`](https://github.com/SeydX/homebridge-fritz-platform). Ohne die Code-Basis vom Original wäre dieser Fork in dieser Zeit nicht entstanden. Der Maintainer schätzt SeydX' Beitrag zur Homebridge-Community sehr.

Lizenz: MIT (siehe [`LICENSE`](./LICENSE)). Beide Copyright-Halter (SeydX 2020, PelleBot 2026) sind dort aufgeführt.

## Disclaimer

Alle Produkt- und Firmennamen (Fritz!Box®, AVM®, HomeKit™, etc.) sind Marken ihrer jeweiligen Eigentümer. Die Verwendung impliziert keine Affiliation oder Empfehlung. Dieses Plugin ist **kein offizielles AVM- oder Apple-Produkt**.
