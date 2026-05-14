# @pellebot/homebridge-fritz-platform-hb2

<p align="center">
  <img src="branding/Icon.png" alt="Plugin Logo" width="160">
</p>

> Homebridge 2.0 plugin für AVM FRITZ!DECT Geräte und FRITZ!Box Router-Switches. Fokus: produktiver Betrieb auf Homebridge 2.0 mit Node 22 / 24.

[![npm version](https://img.shields.io/npm/v/@pellebot/homebridge-fritz-platform-hb2.svg?style=flat-square)](https://www.npmjs.com/package/@pellebot/homebridge-fritz-platform-hb2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Homebridge](https://img.shields.io/badge/homebridge-2.0%20%7C%201.8%2B-purple?style=flat-square)](https://github.com/homebridge/homebridge)
[![Node](https://img.shields.io/badge/node-22%20%7C%2024-green?style=flat-square)](https://nodejs.org/)

## Status

Production: läuft produktiv beim Maintainer mit 12 DECT-Thermostaten, 1 DECT-Lampe, 2 Temperatursensoren, einem FRITZ!Smart Energy 250 OBIS-Reader an einem ISKRA-Stromzähler, sowie aktiven Router-Switches für Gast-WLAN und WPS — alles auf Homebridge 2.0.2 + Node 24 + FRITZ!OS 8.x.

**Seit v1.1.0:** Setup-Wizard in Config UI X — beim ersten Plugin-Settings-Aufruf führt ein 5-Schritt-Assistent durch FritzBox-Verbindung, Geräte-Auswahl, Smart Energy 250, Router-Switches und Speichern. Auto-Discovery aller DECT-Geräte mit accType-Vorschlag pro Gerät.

## Unterstützte Geräte

| Gerätetyp | accType | Was wird in HomeKit angezeigt |
|---|---|---|
| FRITZ!DECT 301 / Comet DECT (Heizkörper-Thermostat) | `thermostat` | Soll-/Ist-Temperatur, Batterie, Fenster-offen-Erkennung |
| FRITZ!Smart Light 500 / FRITZ!DECT 500 (DECT-Lampe) | `lightbulb` | An/Aus, Helligkeit, Farbe |
| FRITZ!Smart Control 440 (Temperatursensor) | `temperature` | Temperatur, Batterie |
| FRITZ!DECT 200 / 210 (schaltbare Steckdose) | `switch` | An/Aus + optional Energiemessung |
| FRITZ!Smart Energy 250 (OBIS-Reader, an ISKRA o.ä.) | `energy-temperature` oder `energy-light` | Aktuelle Leistung in W, kumulierte Energie in kWh — entweder als TemperatureSensor (°C-Tile, prominent im Raum) oder LightSensor (lx-Tile, passive Sensor-Anzeige, per Favorit ins Home-Tab holbar) |
| FRITZ!Box Router (Master) | (via `options`) | Gast-WLAN-Switch, WPS-Switch, optional weitere Toggles |

## Architektur

Das Plugin nutzt zwei AVM-Schnittstellen:

- **TR-064** initialisiert die FritzBox-Verbindung (für AHA-API-Authentifizierung und Router-Steuerung). Konfiguration über `devices[]` mit `master: true`.
- **AHA-HTTP-API** liest und steuert DECT-Geräte. Konfiguration über `smarthome[]` mit jeweils einer AIN pro Gerät.

Das **Router-Accessory** (Master FritzBox) wird per default mit `hide: true` ausgeblendet. Wer Gast-WLAN und WPS als HomeKit-Tile haben will, konfiguriert das über das `options`-Objekt des Master-Devices (`wifi_guest: 'switch'`, `wps: 'switch'`).

## Scope-Grenzen

Aus dem ursprünglichen Code-Baum entfernt oder nicht migriert — wer eine dieser Funktionen braucht, ist hier nicht richtig:

- **Callmonitor** (Anrufüberwachung)
- **Presence** (WLAN-Anwesenheit)
- **Network-Watcher**
- **Wake-on-LAN**
- **Child Lock** (Internet-Sperren)
- **Extras-Subsysteme** (DNS-Switch, Fallback-Internet, Phonebook, Telegram-Notifications) — die WiFi/WPS-Switches der Extras-Datei sind ausgenommen und voll funktional
- **`fakegato-history`** (Eve-App History-Graphen — als No-Op gestubbt weil HAP-v2-inkompatibel)

## Voraussetzungen

- **Homebridge** ≥ 1.8.5 oder ≥ 2.0.0
- **Node.js** ≥ 22.12.0 oder ≥ 24.0.0
- **FRITZ!Box** mit aktiviertem **TR-064-Zugriff** + dediziertem User mit "Smart Home"-Berechtigung (FRITZ!OS 7.x oder neuer)
- Optional: **homebridge-config-ui-x** für die Web-UI-Konfiguration

## Installation

```bash
npm install -g @pellebot/homebridge-fritz-platform-hb2
```

Vor der Veröffentlichung auf npm — direkt aus dem Git-Repo:

```bash
git clone https://github.com/PelleBot/homebridge-fritz-platform-ng.git
cd homebridge-fritz-platform-ng
npm pack
sudo npm install -g ./pellebot-homebridge-fritz-platform-hb2-1.0.0.tgz
```

Anschließend Homebridge neu starten (z.B. via Config UI X "Restart"-Button oder `sudo hb-service restart`).

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
          "hide": true,
          "options": {
            "wifi_guest": "switch",
            "wps": "switch"
          }
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

Vollständige Optionen über das **Homebridge Config UI X** Plugin grafisch unterstützt.

### Router-Switches (Gast-WLAN + WPS)

Im Master-Device-Block die `options` ergänzen:

```json
{
  "options": {
    "wifi_guest": "switch",
    "wps": "switch"
  }
}
```

Damit erscheinen zwei zusätzliche Tiles in HomeKit. Empfehlung: in der Home-App umbenennen ("Gast-WLAN", "WPS") für klarere Beschriftung als der vom Plugin generierte Default `<Master-Name> Wifi guest` / `<Master-Name> Wps`.

### FRITZ!Smart Energy 250 (OBIS-Reader)

Die Smart Energy 250 ist ein HAN-FUN-Gateway, der einen externen Stromzähler (ISKRA o.ä.) per OBIS-Reader anbindet. AVM stellt zwei Sub-AINs bereit:

- `<base-AIN>-1` → OBIS 1.8 (Verbrauch / Bezug)
- `<base-AIN>-2` → OBIS 2.8 (Einspeisung)

Für ein typisches PV-Setup mit Bezug + Einspeisung legst du **vier `smarthome[]`-Einträge** an — je AIN ein aktueller Watt-Wert und ein kumulierter kWh-Wert:

```json
{
  "smarthome": [
    {
      "active": true,
      "name": "Aktueller Verbrauch",
      "ain": "152820924403-1",
      "accType": "energy-temperature",
      "obisChannel": "current_power"
    },
    {
      "active": true,
      "name": "Gesamt Verbrauch",
      "ain": "152820924403-1",
      "accType": "energy-temperature",
      "obisChannel": "total_energy"
    },
    {
      "active": true,
      "name": "Aktuelle Einspeisung",
      "ain": "152820924403-2",
      "accType": "energy-temperature",
      "obisChannel": "current_power"
    },
    {
      "active": true,
      "name": "Gesamt Einspeisung",
      "ain": "152820924403-2",
      "accType": "energy-temperature",
      "obisChannel": "total_energy"
    }
  ]
}
```

**Wieso TemperatureSensor (oder LightSensor)?** HomeKit hat keinen nativen Service für Leistung oder Energie. Es wird einer der beiden Sensor-Typen als Anzeige-Vehikel "missbraucht":

- **`energy-temperature`** (Standard) — TemperatureSensor mit `°C`-Einheit. Apple Home zeigt's prominent als eigenes Tile im Raum-View.
- **`energy-light`** — LightSensor mit `lx`-Einheit. Apple Home zeigt's als passiven Sensor (Status-Zeile oben). Per Long-Press → "Im Zuhause anzeigen" als Favorit-Tile aktivierbar. Die `lx`-Einheit ist semantisch genauso falsch wie `°C` — viele empfinden sie aber als weniger irreführend, weil seltener im Alltag verwendet.

Beide werden seit v1.1.1 unterstützt. Standard ist `energy-temperature`. Empfehlung: probier beide aus, behalte was dir besser gefällt. In der Home-App das Tile umbenennen ("Aktueller Verbrauch (W)", "Gesamt Einspeisung (kWh)") macht den Werte-Kontext eindeutig.

**Richtungs-Trennung:** AVM spiegelt den NET-Power-Wert auf beiden Sub-AINs (gleiche Zahl mit Vorzeichen). Das Plugin trennt das anhand des AIN-Suffixes — `-1` zeigt den Wert nur wenn `power > 0` (Bezug), `-2` zeigt `|power|` nur wenn `power < 0` (Einspeisung). Im Ruhe-/Inverse-Zustand zeigt die jeweils andere Kachel `0`.

## Migration vom Original-Plugin

Wenn du bisher das unmaintained Original `homebridge-fritz-platform@6.0.19` eingesetzt hast:

1. **Backup** dein `~/.homebridge/` Verzeichnis: `cp -R ~/.homebridge ~/.homebridge.backup`
2. **Update Homebridge auf 2.x**: `sudo npm install -g homebridge@latest`
3. **Original-Plugin entfernen**: `sudo npm uninstall -g homebridge-fritz-platform`
4. **Dieses Plugin installieren**: `sudo npm install -g @pellebot/homebridge-fritz-platform-hb2`
5. **Config anpassen**: nicht-mehr-unterstützte Subsysteme aus der Config entfernen (`presence`, `callmonitor`, `wol`, `childLock`, `network`, `extras`, `telegram` — werden eh ignoriert, aber sauberer wenn weg).
6. **Homebridge neu starten**

Accessory-UUIDs basieren auf AIN + Name. Wer Device-Namen unverändert lässt, behält das HomeKit-Pairing bei und muss nichts in der Home-App neu zuordnen.

## Troubleshooting

Siehe [`DEBUG.md`](./DEBUG.md) für:
- Plugin-Debug-Mode aktivieren
- VS Code Debugger Setup
- Häufige Fehlerbilder + Lösungen
- Log-Pfade auf macOS / Linux

## Issues melden

Bevor du ein Issue öffnest, bitte zusammenstellen:

- Homebridge-Version (`homebridge --version`)
- Node-Version (`node --version`)
- Plugin-Version (`npm ls -g @pellebot/homebridge-fritz-platform-hb2`)
- FritzBox-Modell + FRITZ!OS-Version
- Relevante Log-Auszüge (idealerweise mit `"debug": true` in der Plugin-Config)
- Config-Auszug (ohne Passwort!)

Issue-Template im Repo führt durch alle Punkte.

## Maintenance-Modell

Dieser Plugin wird **LLM-unterstützt** gepflegt (siehe [`CONCEPT.md`](./CONCEPT.md)):

- PelleBot ist menschlicher Maintainer, Repo-Owner, Final-Reviewer
- Code-Patches, Doc-Updates und Issue-Antworten werden mit Hilfe eines LLM (Claude) entworfen
- Jede Änderung wird vom menschlichen Maintainer geprüft, bevor sie committed wird
- Es gibt **keine automatischen Bot-Antworten** auf Issues — Reaktionszeit kann daher etwas länger sein, dafür ist Qualität konsistent

Pull Requests willkommen. Issues mit Label `discussion` für offene Architektur-Themen.

## Lineage

Dieses Plugin baut auf der Code-Basis des [`homebridge-fritz-platform`](https://github.com/SeydX/homebridge-fritz-platform) Projekts von Seyit Bayraktar (SeydX) auf. Ohne seine jahrelange Vorarbeit (2020-2022) wäre die HB-2.0-Migration nicht in dieser Zeit machbar gewesen.

Lizenz: MIT — siehe [`LICENSE`](./LICENSE), Copyright-Halter sind dort beide aufgeführt.

## Disclaimer

Alle Produkt- und Firmennamen (FRITZ!Box®, AVM®, HomeKit™, etc.) sind Marken ihrer jeweiligen Eigentümer. Die Verwendung impliziert keine Affiliation oder Empfehlung. Dieses Plugin ist **kein offizielles AVM- oder Apple-Produkt**.
