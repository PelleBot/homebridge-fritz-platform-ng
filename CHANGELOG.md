# Changelog

> **Hinweis zum Format:** Releases ab `v1.0.0` werden unter dem npm-Paket `@pellebot/homebridge-fritz-platform-hb2` veröffentlicht. Die `6.1.0-hb2patch.x` Pre-Releases sind Vorstufen unter dem alten Paketnamen `@pellebot/homebridge-fritz-platform` (deprecated). Die `registerPlatform`-Kennung bleibt durchgängig `homebridge-fritz-platform`, sodass cached Accessories über den Rename hinweg matchen — kein Re-Pairing nötig.

# v1.1.0 — 2026-05-13 (Setup-Wizard Release)

**Neue Custom-UI mit Setup-Wizard.** Config UI X öffnet beim Klick auf das Plugin-Settings-Icon ab dieser Version unseren geführten 5-Schritt-Wizard statt des bisherigen JSON-Schema-Formulars. Das macht das Erstsetup deutlich freundlicher — kein Raten mehr bei Feldern wie `accType`, `obisChannel` oder AIN-Format.

## Neuerungen

- **`homebridge-ui/server.js` + `homebridge-ui/public/index.html`** — neuer Custom-UI-Server-Prozess der bei Plugin-Settings-Aufruf gestartet wird. Kommuniziert per IPC mit dem Config UI X Frontend.
- **5-Schritt-Wizard:**
  - **Schritt 1 — FritzBox-Verbindung:** Form mit Host/Port/SSL/TR-064/User/Passwort + "Verbindung testen"-Button. Backend ruft TR-064 + AHA-API live an, gibt actionable Hints bei Fehlern (ECONNREFUSED → "TR-064 aktivieren", 401 → "Smart Home Berechtigung fehlt", etc.).
  - **Schritt 2 — Geräte-Auswahl:** Auto-Discovery aller DECT-Geräte. Pro Gerät wird der `accType` anhand der von `@seydx/fritzbox` normalisierten Feldern (`.thermostat`, `.light`, `.switch`, `.powermeter`, `.temperature`, `.button`, `.blind`, `.alert`) automatisch vorgeschlagen. Nutzer kann pro Gerät einzeln overriden.
  - **Schritt 3 — Smart Energy 250 OBIS-Reader:** OBIS-Sub-AINs aus Schritt 2 werden nach Base-AIN gruppiert. Pro Reader werden 4 HomeKit-Tiles auto-vorgeschlagen (Aktueller Verbrauch + Gesamt Verbrauch + Aktuelle Einspeisung + Gesamt Einspeisung mit anpassbaren Namen).
  - **Schritt 4 — Router-Switches:** Checkboxen für Gast-WLAN, WPS, WLAN 2.4/5 GHz, DECT-Basis, AB, Rufumleitung, Reconnect. Vorausgewählt aus bestehender Config wenn vorhanden.
  - **Schritt 5 — Speichern + Apply:** Zusammenfassung, JSON-Vorschau mit maskiertem Passwort, Save via `homebridge.updatePluginConfig` + `homebridge.savePluginConfig`, Restart-Homebridge-Button.
- **Auto-Pre-fill aus bestehender Config:** Verbindungs-Schritt und Router-Switches lesen die aktuelle Config beim Öffnen und füllen Formularfelder/Checkboxen vor. Make-it-easy bei Migration und beim Editieren.
- **AIN-Suffix-Detection:** OBIS-Sub-AIN-Erkennung (`-1`/`-2`) korrekt priorisiert nach physischen Features — DECT 500 Lampen werden nicht mehr fälschlich als OBIS-Reader interpretiert (HAN-FUN-Sub-Unit mit `-1`-Suffix aber `.light`-Objekt).

## Breaking Changes

Keine. Bestehende Configs werden unverändert übernommen, das alte JSON-Schema-Form ist über den "Save"-Button (bottom-right) im Config UI X immer noch als Fallback erreichbar.

## Bekannte Limitationen

- **Standalone Config UI X:** `homebridge.savePluginConfig()` kann in Standalone-Modus die WebSocket-ACK nicht empfangen → wir racen den Save mit einem 3-Sek-Timeout. Datei wird trotzdem korrekt geschrieben.
- **Custom-UI-Icon:** wird im Config UI X Plugin-Tile erst nach Homebridge-Verified-Plugin-Approval angezeigt (Repo `homebridge/plugins`-Icons-Liste). Bis dahin Default-Lila-Homebridge-Icon.

---

# v1.0.0 — 2026-05-13 (First Production Release)

**Erstes stabiles Release** des `@pellebot/homebridge-fritz-platform-hb2`. Setzt die Code-Linie der `6.1.0-hb2patch.x` Pre-Releases fort, jetzt mit unabhängiger Versionierung und neuem npm-Paketnamen.

## Breaking Changes ggü. v6.1.0-hb2patch.1

- **npm-Paket umbenannt**: `@pellebot/homebridge-fritz-platform` → `@pellebot/homebridge-fritz-platform-hb2`. Der `-hb2`-Suffix macht explizit, dass dies die Homebridge-2.0-Linie ist. Migration:
  ```
  sudo npm uninstall -g @pellebot/homebridge-fritz-platform
  sudo npm install -g @pellebot/homebridge-fritz-platform-hb2
  ```
  Die `registerPlatform`-Kennung (`homebridge-fritz-platform`) ändert sich **nicht** — bestehende cached Accessories werden weiter gematched, kein iPhone-Re-Pairing.
- **Versionierung zurückgesetzt** auf `1.0.0`. Damit endet die Mitführung der Upstream-Version `6.x` aus dem Original. Eigene SemVer-Linie ab jetzt.

## Bug Fixes

- **Router-Companion-Switches (Wifi-Toggles, WPS, DECT, AB, Reconnect) reagierten nicht auf Tippen.** Root Cause: `case 'extra'` war beim Phase-1-Cleanup fälschlich als "out-of-scope" eingestuft und aus dem `platform.js`-Dispatch entfernt worden. Dadurch wurde `ExtrasAccessory` nie instanziiert, der `onSet`-Handler für die standardmäßige `On`-Charakteristik der Switch-Services nie registriert. HomeKit-Taps liefen ins Leere, die Tiles flipten zurück. Fix: `case 'extra'` wieder eingefügt, `ExtrasAccessory` wired den Switch-Service korrekt an `RouterHandler.set/get/change`.
- **WPS-State wurde falsch interpretiert.** `GetWPSInfo` liefert nach abgebrochenen WPS-Sessions häufig `WPSStatus: 'err_common'`. Die alte Logik `state = status !== 'off'` matchte das als "WPS ist an", obwohl der WPS-Modus in Wahrheit gestoppt war. Fix: Auf `WPSMode`-basierte Erkennung umgestellt — Tile ist nur ON wenn der Mode aktiv läuft (`pbc` / `pin`).

## Neuerungen

- **Neuer accType `energy-temperature`** für FRITZ!Smart Energy 250 OBIS-Reader (und ähnliche HAN-FUN-Stromzähler-Gateways). Exponiert die Powermeter-Werte als `TemperatureSensor`-Service, damit Apple Home den Zahlenwert nativ als Tile anzeigt und Verlaufsgraphen plottet — ohne Eve-App-Abhängigkeit. Config-Feld `obisChannel: 'current_power' | 'total_energy'` wählt zwischen aktueller Leistung (W) und kumulierter Energie (kWh). Trennung von Bezug/Einspeisung erfolgt automatisch über den AIN-Suffix: `-1` (OBIS 1.x) zeigt nur positive Power-Werte (Bezug), `-2` (OBIS 2.x) zeigt `|negative|` Power-Werte (Einspeisung). Trade-off: HomeKit zeigt die Einheit als `°C` an — semantisch falsch, aber funktional korrekt; Tile in der Home-App umbenennen für klare Lesart.
- **Energy-meter accType weiterhin verfügbar** als Alternative für Nutzer die lieber das Outlet-Tile mit Eve-App-Charakteristiken haben. Beide accTypes können parallel konfiguriert sein.

## Doku-Update

- `README.md` neu strukturiert: Production-Status, Geräte-Tabelle, Architektur-Erklärung, Migration-Guide für Energy 250. Lineage-Sektion (SeydX-Credit) in den Footer verschoben.
- `CHANGELOG.md`: Versionierungs-Hinweis aktualisiert auf `-hb2`-Paket.
- `DEBUG.md`, `CONTRIBUTING.md`: Paketnamen-Referenzen auf `-hb2`.

## Bekannte Limitationen (unverändert)

- **Apple Home Energy-Display nicht nativ**: Apple HomeKit hat keine "Power Meter"-Service-Klasse. Workaround über `energy-temperature` (TemperatureSensor-Missbrauch) ist der best-möglich Stand.
- **fakegato-history Stub**: keine historischen Eve-App-Graphen. Live-Werte funktionieren, Apple Home plottet Verlaufsgraphen für `energy-temperature`-Tiles nativ.

---

# v6.1.0-hb2patch.1 — 2026-05-11 (Polish-Release, beta)

**Folge-Release** zum Initial-Fork-Release vom gleichen Tag. Bringt vollwertige Router-Toggle-Unterstützung, ein deutlich schlankeres Config-UI-X-Schema und korrigiert den npm-Scope-Namen.

## Neuerungen

- **`custom.types.js` auf ES6-Klassen portiert** (Phase 1.2 der Roadmap). Die 21 Custom-Characteristics für WiFi-Toggles, WPS, DECT-Basis, Reconnect, AB, Rufumleitung, DNS, Phonebook, Caller/Called, Download/Upload/Ping sind wieder registriert. **Ergebnis: Router-Accessory mit `hide: false` funktioniert jetzt vollständig**, die entsprechenden Switches/Sensoren erscheinen in HomeKit. Service-Switch-Override aus dem Original wurde nicht portiert (HAP-v2-Risiko, nicht nötig — Charakteristiken werden dynamisch via `service.addCharacteristic()` zugewiesen).
- **`config.schema.json` von 73 KB auf 32 KB entschlackt** (Phase 2.1 der Roadmap). Out-of-Scope-Sektionen (presence, wol, network, childLock, callmonitor, extras, telegram) sowie unbenutzte Sub-Felder (options.presence, options.reboot) entfernt. Config UI X zeigt jetzt nur noch die Sektionen die tatsächlich vom Plugin gelesen werden: Name, Log, Devices, Smart Home, Options.

## Breaking Changes ggü. v6.1.0-hb2patch.0

- **npm-Scope-Namensänderung**: das Paket heißt jetzt `@pellebot/homebridge-fritz-platform`. Der zwischenzeitliche `@pellini`-Scope war ein Tippfehler. Falls du das alte Paket lokal installiert hast: `npm uninstall -g @pellini/homebridge-fritz-platform` und mit dem neuen Scope reinstallieren. Die `registerPlatform`-Kennung bleibt `homebridge-fritz-platform` (cached Accessories werden weiter gematched, kein iPhone-Re-Pairing).
- **`hide` Empfehlung gedreht**: in hb2patch.0 stand "`hide: true` ist Pflicht weil Router-Toggles crashen". Das ist mit diesem Release nicht mehr nötig. Default-Empfehlung jetzt `hide: false` (Router-Toggles sichtbar). Wer das nicht will, kann auf `hide: true` setzen.

## Bekannte Limitationen (unverändert ggü. hb2patch.0)

- **Apple Home Energy-Display fehlt**: Apple HomeKit hat keine native "Power Meter"-Service-Klasse. Energy-Meter-Werte nur in Eve App sichtbar.
- **fakegato-history Stub**: keine historischen Eve-App-Graphen. Live-Werte funktionieren.

---

# v6.1.0-hb2patch.0 — 2026-05-11 (Fork-Initial-Release, beta)

**Erste Version des Wartungs-Forks.** Migrationspatch für Homebridge 2.0 + Node 22/24, basierend auf `SeydX/homebridge-fritz-platform@6.0.19` (letzte gepublishte Upstream-Version).

## Breaking Changes ggü. v6.0.19

- **Subsysteme entfernt** (siehe README für Begründung): callmonitor, presence, network, wol, childlock, extras (DNS, alarm, wakeup, ringlock, phoneBook, fallbackInternet). Config-Einträge für diese Subsysteme werden ignoriert.
- **`fakegato-history` als No-Op gestubbt** — Eve-App-History-Graphen funktionieren nicht (kein HAP-v2-kompatibler Fork verfügbar). Live-Werte unverändert sichtbar.
- **Router-Accessory standardmäßig versteckt empfohlen** (`hide: true`). Die Custom-Charakteristiken für WiFi/DECT/WPS-Toggles sind in dieser Version nicht ES6-portiert; bei `hide: false` und konfigurierten Router-Options crasht der Child-Bridge-Start. → ✅ **Behoben in v6.1.0-hb2patch.1** (ES6-Port abgeschlossen, `hide: false` empfohlen).
- **Node-Mindestversion auf ≥22.12** angehoben. Node 14/16/18/20 nicht mehr supportet.
- **Homebridge ≥1.6 oder ≥2.0** als Engines-Range. HB 1.6/1.7 noch akzeptiert, getestet ist primär HB 1.8.5+ und HB 2.0.x.

## Neuerungen

- **HAP-NodeJS v2 Migration**: `BatteryService` → `Battery` Service (43 Stellen in 9 DECT-Files), `eve.types.js` von ES5-Function-Inheritance auf ES6-Klassen portiert mit String-Literal-basierten Format-/Perm-/Unit-Werten (HAP-Spec-konform, version-stabil).
- **ESM-Entrypoint** (`index.mjs`) via `createRequire`, internes `src/`-CommonJS-Tree unverändert (Minimal-Patch-Prinzip). `src/package.json` mit `type: commonjs` für korrektes Module-Scoping.
- **Neuer `accType: "energy-meter"`** (experimentell) für AVM Fritz!Smart Energy 250 im OBIS-Reader-Modus. Liest Sub-AINs `<base>-1` (OBIS 1.8 Bezug) und `<base>-2` (OBIS 2.8 Einspeisung), exponiert `CurrentConsumption` (W) und `TotalConsumption` (kWh) als Eve-Charakteristiken auf einem read-only Outlet-Service. Apple Home stock zeigt nur Plug-Tile; Werte in Eve App sichtbar.

## Bekannte Limitationen (in dieser Version — neuere siehe v6.1.0-hb2patch.1)

- **Router-Toggles deaktiviert**: WiFi 2.4/5GHz/Guest, WPS, DECT, AW, Reconnect, Download/Upload/Ping-Charakteristiken nicht funktional. Workaround: `hide: true` auf Router-Config. → **Behoben in v6.1.0-hb2patch.1**.
- **Apple Home Energy-Display fehlt**: Apple HomeKit hat keine native "Power Meter"-Service-Klasse. Energy-Meter-Werte nur in Eve App sichtbar.
- **fakegato-history Stub**: keine historischen Eve-App-Graphen. Live-Werte funktionieren.

## Migration-Hinweise

Wenn du von Upstream `homebridge-fritz-platform@6.0.19` upgradest (besser direkt auf v6.1.0-hb2patch.1 gehen — siehe oben):

1. Backup deines `~/.homebridge/` Verzeichnisses
2. `npm uninstall -g homebridge-fritz-platform`
3. `npm install -g @pellebot/homebridge-fritz-platform@beta` (oder via lokalem .tgz)
4. Config: ggf. veraltete Subsystem-Einträge entfernen (presence, callmonitor etc.)
5. Homebridge auf 1.8.5+ oder 2.0+ upgraden, Node 22/24 sicherstellen
6. Restart

Bei Beibehaltung der Device-Namen bleiben Accessory-UUIDs identisch — kein iPhone-Re-Pairing nötig.

---

# Historischer Changelog (Original-Plugin von SeydX)

Die folgenden Einträge stammen aus dem Upstream-Repo `SeydX/homebridge-fritz-platform`, eingestellt nach v6.0.19. Aus Transparenz und Nachvollziehbarkeit unverändert hier erhalten.

# v6.0.18 - 2021-10-06

## Bugfixes
- Minor Bugfixes

# v6.0.17 - 2021-10-06

## Other Changes
- Updated dependencies

## Bugfixes
- Fixed an issue where smarthome thermostat groups did not display the average current temperature
- Fixed an issue where starting wps failed and showed wrong state
- Fixed an issue where setting thermostat to max temperature (via FritzBox) displayed wrong state/temperature in HomeKit
- Fixed an issue where scenes/automations do not work properly with Smarthome thermostats
- Minor Bugfixes

# v6.0.16 - 2021-09-21

## Notable Changes
- **Presence**
  - Guest Wifi Presence: Occupancy/Motion sensor which will be triggered if someone is connected to the guest wifi (master device)

## Bugfixes
- Fixed an issue where number lookup didnt work properly (callmonitor)
- Fixed an issue where turning on the deflection affected only the first deflection in the list
- Minor Bugfixes

# v6.0.15 - 2021-09-19

## Other Changes
- Updated dependencies

## Bugfixes
- Fixed an issue where smarthome thermostat groups did not display the average current temperature
- Fixed an issue where smarthome buttons did not work properly
- Fixed an issue where router led state did not work properly
- Minor bug fixes

# v6.0.14 - 2021-07-08

## Bugfixes
- Fixed an issue where thermostats did not display the temperature value of the external temperature when `externTemperatureSensor` is enabled

# v6.0.13 - 2021-07-08

## Bugfixes
- Fixed an issue where changing color of smarthome lightbulbs showed wrong color/saturation

# v6.0.12 - 2021-07-08

## Notable Changes
- **Smarthome**
  - Changed "Humidity Sensor" from built-in sensor to a separate humidity sensor accessory
  - Added new `externTemperatureSensor` option for thermostat accessories to use the temperature value from the external temperature sensor setted up in the FritzBox GUI

## Other Changes
- Reduced minimum polling timer to `1`

## Bugfixes
- Fixed an issue where enabling temperature or humidity doesnt work for several smarthome accessories
- Fixed an issue where receiving an error during sending a telegram message caused homebridge to crash
- Fixed an issue where thermostat `open window switch` caused a warning on startup
- Minor bug fixes

# v6.0.11 - 2021-07-04

## Other Changes
- Updated dependencies
  
## Bugfixes
- Fixed an issue where buttons with 4 channels didnt work properly

# v6.0.10 - 2021-06-28

## Bugfixes
- Fixed an issue where authentication with a complex password didnt work

# v6.0.9 - 2021-06-28

## Bugfixes
- Fixed an issue where changing lightbulb color didnt work

# v6.0.8 - 2021-06-27

## Bugfixes
- Fixed an issue where restarting a router failed
- Minor bug fixes

# v6.0.7 - 2021-06-27

## Bugfixes
- Fixed an issue where presence user throw an erorr if it could not be found manually or in the hosts list
- Minor bug fixes
  
# v6.0.6 - 2021-06-27

## Other Changes
- Updated dependencies

## Bugfixes
- Fixed an issue where restarting a router failed
- Minor bug fixes

# v6.0.5 - 2021-06-23

## Other Changes
- Improved logging

## Bugfixes
- Fixed an issue where callmonitor (outgoing) not triggered correctly
  
# v6.0.4 - 2021-06-22

## Bugfixes
- Minor bug fixes
  
# v6.0.3 - 2021-06-22

## Notable Changes
- **Log**: 
  - Added multiple logging functions to config to allow adjusting the logging output.
- **Smarthome**:
  - **Buttons**: Added support for Telekom Wandtaster
- **Config**:
  - **Buttons**: Added `longPress` option to smarthome buttons

## Other Changes
- Updated dependencies

## Bugfixes
- Fixed an issue where presence devices with an ip address in the config could not be exposed to HomeKit.
- Minor bug fixes

# v6.0.2 - 2021-06-22

## Other Changes
- Better error handling in the backend

## Bugfixes
- Fixed an issue where extra characteristics was not polling
- Fixed an issue with Telegram where also the subtypes of an accessory was shown in the message
- Minor bug fixes

# v6.0.1 - 2021-06-21

## Bugfixes
- Minor bug fixes
- Cleaned up config.schema.json

# v6.0.0 - 2021-06-21
This update is by far the biggest update for `homebridge-fritz-platform`. To make adding new devices also easier for developers, the complete plugin has been rewritten and made modular. This should give all developers the possibility to read the code more easily and add new devices via PR themselves.

## Breaking Changes
- **Homebridge**
  - Dropped support for homebridge below v1.3.0
- **Devices**: 
  - Added `active` key to `devices` to enable/disable the device without removing it from config. Warning: Default value for `active` is false, this means, that if you DON'T adjust your config.json and add `"active": true` to the device, the device will be removed from HomeKit!
- **Smarthome**: 
  - Added `active` key to `smarthome` to enable/disable the device without removing it from config. Warning: Default value for `active` is false, this means, that if you DON'T adjust your config.json and add `"active": true` to the device, the device will be removed from HomeKit!
- **WOL**: 
  - Added `active` key to `wol` to enable/disable the device without removing it from config. Warning: Default value for `active` is false, this means, that if you DON'T adjust your config.json and add `"active": true` to the device, the device will be removed from HomeKit!
- **Network Monitoring**: 
  - Added `active` key to `network` to enable/disable the device without removing it from config. Warning: Default value for `active` is false, this means, that if you DON'T adjust your config.json and add `"active": true` to the device, the plugin will not notify you if the device is online/offline!

## Notable Changes
- **Child Lock**:
  - Added new `childLock` array into config to expose child lock switches for given device. Child Lock switches grants/denies acces to the internet for the given ip addresses.
- **Devices**: 
  - Added a new option `wifiUnits` to devices to manually set the available wifi units (support for multiple units like 1x 2.4Ghz and 2x 5Ghz)
  - Added a new option `reconnect` to device options to expose a Reconnect characteristic/switch which interrupt the internet access and reconnect (for changing external ip)
- **Smarthome**:
  - Blinds: Added `blind` as a new accessory (`accType`) type
  - Buttons: Added `button` as a new accessory (`accType`) type with 1/4 button support with oen polling timer (`timerSmarthomeButtons`) configurable under `options.polling.timerSmarthomeButtons`
  - Thermostat:
    - Added new `openWindow` option to expose an switch to manually trigger open/close window
  - Outlet:
    - Added new `startValue` option which is used for notification via telegram when device started (current power consumption above this value) or ended (current power consumption below this value)
- **Extras**:
  - Added new `dnsServer` option to `extras` config to expose a switch which toggles the dns server from fritzbox to "internet provider" or "own dns server"
  - Added new `fallbackInternet` option to `extras` config to expose a switch which toggles the fallback internet option from fritzbox
- **Presence**: 
  - Moved `onDelay` and `offDelay` from options.presence to presence user to allow separate values for each user
- **Callmonitor**:
  - Added `incomingFrom` array into callmonitor options to allow trigger callmonitor only for speicifc numbers
- **Telegram**:
  - Added `outlet.started` and `outlet.finished` as a new option to notify via Telegram if device is started/finished
- **Options**: 
  - Removed `onDelay` and `offDelay` from options.presence
  - Added `timerSmarthomeButtons` to options.polling
- **Polling**: 
  - Refactored `exclude` list. Now, only following type of accessories/characteristics can be excluded from polling: `dsl` (accessory name), `cable` (accessory name), `repeater` (accessory name), `wifi_2ghz`, `wifi_5ghz`, `wifi_guest`, `wps`, `led`, `lock`, `aw`, `dect`, `deflection`, `ringlock`
  - Minimum/Default polling timer (seconds) increased to 15 seconds

## Other Changes
- The code has been refactored (again)
- Adjusted config.schema.json to reflect the changes mentioned above
- Updated dependencies

## Bugfixes
- Minor bug fixes

# v5.1.2 - 2021-05-30
- Fix CreateUrlSID for DECT

# v5.1.1 - 2021-05-30
- Bump dependencies

# v5.1.0 - 2021-05-20
- Refactored backend module `@seydx/fritzbox`
- Some minor improvements and bugfixes
- Bump dependencies

# v5.0.33 - 2021-05-19
- Fixed an issue where changing temperature from thermostat was not possible with Siri
- Bump dependencies
- Minor bugfixes and improvements

# v5.0.32 - 2021-03-22
- Bugfix

# v5.0.31 - 2021-03-16
- Added "cooling" state to HeaterCooler

# v5.0.30 - 2021-03-16
- Changed Smarthome Thermostat Service to HeaterCooler Service

**WARNING**

This change will break your automations with your smarthome thermostats because they will be removed from HomeKit and re added again as a new type of thermostats!

# v5.0.26 - 2021-03-14
- Fixed characteristic warnings from eve characteristics (fakegato)
- Bump dependencies

# v5.0.25 - 2021-02-28
- Fix [#157](https://github.com/SeydX/homebridge-fritz-platform/issues/157)
- Fix [#139](https://github.com/SeydX/homebridge-fritz-platform/issues/139)

# v5.0.24 - 2021-02-28
- Fixed broadband

**INFO: ** If you have "Broadband" active you have to deactivate it after the update, restart HB and reactivate "Broadband" !

# v5.0.23 - 2021-02-28
- Refactored broadband again

# v5.0.22 - 2021-02-27
- Refactored broadband

# v5.0.21 - 2021-02-24
- Bugfixes

# v5.0.20 - 2020-12-05
- Fix smarthome humidity

# v5.0.19 - 2020-12-05
- Fixed answering machine
- Improved debug for smarthome devices/groups

# v5.0.18 - 2020-12-04
- Updated config.schema.json to support humidity sensor

# v5.0.17 - 2020-12-04
- Added humidity sensor for supported smarthome devices (currently available only with Fritz!OS 7.24)

# v5.0.16 - 2020-11-27
- Bugfixes

# v5.0.15 - 2020-11-27
- Added new option to expose grouped smarthome devices.
- Adaptive Lighting
- Bugfixes

### Grouped Smarthome Devices
Grouped Smarthome Devices can be exposed as Lightbulbs, Switches/Outlets or a combination of both. If the group has a lightbulb AND a switch, the accessory will get both services and additionally (if enabled and supported by the device) a temperature sensor. The grouped switches/outlets and switch-lightbulbs comes also with FakeGato support and "ReadOnly" possibility. Lightbulbs and Switch-Lightbulbs also supports adaptive lighting.

# v5.0.14 - 2020-11-22
- Fixed ColorUtils for Smarthome Lightbulbs
- Removed waitFor* timeout for LightBulbs and Thermostats

# v5.0.13 - 2020-11-15
- Added new option: "cityPrefix" for callmonitor for better call detection
- Added new option: "active" for user (presence) to easily switch between enabled/disabled
- Added new option: "blockTelegram" for user (presence) to block sending telegram notification
- Phonebook improvements
- Added custom FakeGato timer for all FakeGato enabled accessories to fix gaps is histories
- Bugfixes

# v5.0.12 - 2020-11-15
- Fixed a bug with smarthome-window battery service
- Added function to remove battery service
- Bugfixes

# v5.0.11 - 2020-11-15
- Added more information to callmonitor telegram (now % will be replaced with your home nr)
- Replaced Telegraf with FormData
- Bugfixes

# v5.0.10 - 2020-11-15
- Added countryPrefix option to Callmonitor tu spport FritzBox devices without VOIP function
- Disabled AdaptiveLighting (not supported with official homebridge release, coming back with homebridge v1.3)
- Changed callmonitor incomingTo/outgoingFrom logic
- Bugfixes
- Bump FakeGato

# v5.0.9 - 2020-11-14
- Support for apple daptive lighting (coming with hb 1.3) for smarthome lightbulbs
- Bugfixes

# v5.0.8 - 2020-11-12
- Added support for color lightbulbs (eg DECT500)
- Bugfixes

# v5.0.7 - 2020-11-11
- Added new smarthome types (window/temperature)
- Fixed smarthom lightbulb
- readOnly for smarthome switch
- Added broadband again to meshMaster as characteristic (API)
- Bump fritzbox dep to fix username/passwords with special chars

# v5.0.6 - 2020-11-10
- Fixed callmonitor caller/called nr

# v5.0.5 - 2020-11-10
- Fixed callmonitor outgoing call

# v5.0.4 - 2020-11-10
- Fixed phonebook fetching numbers
- Updated fritzbox dep to allow special chars
- Fixed config.schema.json copy&paste

# v5.0.3 - 2020-11-10
- Fixed phoneBook readJson function

# v5.0.2 - 2020-11-10
- Fixed wol switch

# v5.0.1 - 2020-11-10
- Support for homebridge v1.3.0

# v5.0.0 - 2020-11-10
- Completely rewritten
- New: Homebridge (latest/beta) Support
- New: Config UI X Integration
- New: Polling with additional functions (exclude accessories)
- New: Possibility to display all 'Extras' like Wifi, Alarm, Led etc etc as Characteristic or as a separate switch in Apple Home
- New: Network Watch
- New: Configurable Callmonitor names
- New: Group Callmonitor sensors
- New: DECT station
- New: Ability to hide devices (router)
- New: Additional ping for presence
- New: Ability to change accessory typ for presence and anyone sensor, with FakeGato support
- New: Smarthome devices with FakeGato Support
- New: Smarthome Outlet Accessory with Fakegato for powermeter
- New: Smarthome Window Accessory with Fakegato for devices with built in windowOpen function
- New: Support for SmartHome Lights (only on/off and brightness)
- Removed: Broadband for compatibility reasons

**BREAKING CHANGES**

The new version is not compatible with version < 5! If you use version < 5 of this plugin, please remove it from Homekit/Homebridge before updating!

# v4.1.0 - 2019-06-16
- "Ping" feature was added as an extra check (if enabled in config.json)
- Phonebook Bugfix

# v4.0.9 - 2019-05-25
- Refactored Broadband measurement

# v4.0.8 - 2019-05-25
- Bugfixes (generating SID)

# v4.0.7 - 2019-05-24
- Bugfixes (callmonitor)
- Better debug (smarthome)

# v4.0.6 - 2019-05-22
- Refactored phoneBook
- Added "Blacklists" to Phonebook

# v4.0.4 - 2019-05-20
- Added better state detection for repeater

# v4.0.3 - 2019-05-20
- Bugfixes (SID)

# v4.0.2 - 2019-05-20
- Added option to disable auto search

# v4.0.1 - 2019-05-20
- Bugfixes
- Cleanup code

# v4.0.0 - 2019-05-19
- Refactored code
- Refactored API
- Support async/await
- Add automatically all supported devices in network to config
- Added own debug params (FritzPlatformApi,FritzPlatformTR064,FritzPlatformLUA)
- Auto config generator/validator at start
- Bugfixes


# v3.2.4 - 2019-04-26
- Bugfix


# v3.2.3 - 2019-04-24
- Bugfix (extReboot Telegram)


# v3.2.2 - 2019-04-24
- [NEW] Markdown Support for telegram notifications


# v3.2.1 - 2019-03-22
- Bugfixes
- Code cleanup

# v3.2 - 2019-03-21
- [NEW] Presence: new function 'onDelay'
- [NEW] Smarthome: New accessory (contact sensor) for **window open active** function (thermo)
- Code cleanup

# v3.1.5 - 2019-03-19
- Bump dependencies
- Code cleanup

# v3.1.4 - 2019-03-18
- [NEW] It is now possible to add multiple numbers to "incomingTo" and "outgoingFrom" (Callmonitor)
- Code cleanup
- Bugfixes

# v3.1.3 - 2019-03-18
- Rewrite smarthome (fixed a bug with 404 not found error)

# v3.1.2 - 2019-03-17
- Bugfixes

# v3.1.1 - 2019-03-17
- Bugfixes (Smarthome, presence)

# v3.1.0 - 2019-03-17
- Smarthome: Changed "switch" accessory to "outlet" accessory
- Smarthome: Better "present" detection for smarthome devices
- PhoneBook: Auto refresh phonebook (polling: 1h)

Info: If you have Smarthome devices of type "switch" please REMOVE it first from HomeKit and config.json, restart homebridge and be sure that the accessory is removed from HomeKit! Re-add it again to config.json with the same parameter as before! This time it will expose as "outlet" to HomeKit, otherwise it can break your setup!

# vv3.0.7 - 2019-03-16
- Fixed a bug with smarthome

# v3.0.6 - 2019-03-16
- Fixed a bug with callmonitor (outgoing calls)
- Added "test" file

# v3.0.5 - 2019-03-16
- Fixed a bug with empty config.json
- Fixed several bugs with smarthome
- Added 'present' function to smarthome

# v3.0.4 - 2019-03-03
- Fixed a bug with fetching SIDs for multiple devices

# v3.0.3 - 2019-03-03
- Added new function to callmonitor: Specify numbers for "incoming to" and "outgoing from" calls (usefull if using multiple numbers at home and want to trigger only for specified number in config

# v3.0.2 - 2019-03-02
- Added new function to devices: "Read Only" 

# v3.0.1 - 2019-03-02
- Fixed FakeGato for callmonitor and smarthome devices

# v3.0.0 - 2019-03-02

**Breaking changes, remove v2.x first before continue! Check also the new [example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json) !**

- **[NEW]** Callmonitor with extended FakeGato support
- **[NEW]** Callmonitor PhoneBook with auto prefix functionality
- **[NEW]** Callmonitor PhoneBook ultra fast storing
- **[NEW]** Support of BETA FritzBox firmware
- **[NEW]** Support of MESH functionality to decrease request amounts
- **[NEW]** Ring Lock
- **[NEW]** Fallback if no connection
- **[NEW]** Better debug logger (-D)
- **[NEW]** SmartHome Devices (plugs, contact sensors and thermostats)
- **[NEW]** SmartHome Switch accessory with external temp sensor accessory
- **[NEW]** FakeGato for smarthome devices
- **[FIX]** Better presence detection
- **[FIX]** Bugfixes and Speed improvements
- **[BETTER]** Rewritten dynamic platform
- **[BETTER]** Resource efficient
- **[REMOVE]** Presence as motion sensor
- **[REMOVE]** FakeGato for presence sensor

# v2.8.0 - 2018-02-11
- Fix TR064 Api

# v2.7.1 - 2018-06-20
- Bugfixes
- Note: "smarthome" were changed in config.json! Please check before update. ([example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json#L98))
- Note: 'thermo' & 'contact' currently not supported (smarthome)

# v2.7.0 - 2018-06-19
- Added [Smarthome devices](https://github.com/SeydX/homebridge-fritz-platform/blob/master/docs/config/Smarthome.md) 
- Code cleanup
- Better error handling
- Bugfixes
- Added own reboot functionality to repeater. [example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json#L110)
- Removed repeater reboot from main device

# v2.6.4 - 2018-06-18
- Bugfixes
- Code cleanup
- Better error handling

# v2.6.2 - 2018-06-18
- Code clean up
- Bugfixes
- Added "[refresh wifi canal](https://github.com/SeydX/homebridge-fritz-platform/blob/cbe48c0a2b9b86bf9706711c19e4eb4f684f01f5/example/example-config.json#L23)"

# v2.6.0 - 2018-06-17
- Bugfixes
- Remote Login possibility [see docs](https://github.com/SeydX/homebridge-fritz-platform/blob/master/docs/config/FritzBox.md)
- Updated dependencies
- Better interaction with the TR064 module

# v2.5.1 - 2018-06-15
- Bugfixes
- Code cleanup

# v2.5.0 - 2018-06-15
- Bugfixes
- Integrated tr064 api
- Speed up
- Code cleanup

# v2.4.4 - 2018-06-14
- Fixed callmonitor telegram notification
- Fixed Repeater state

# v2.4.3 - 2018-06-13
- Bugfixes
- Clean up code

# v2.4.2 - 2018-06-13
- Bugfixes
- Added called nr to callmonitor and telegram (% in config.messages.incoming as dynamic input)
- Added more flags to LogUtil
- Increased min timeout limit from 5s to 10s
- Better error handling
- Reboot function to repeater main switch > if switch off > reboot

# v2.4.1 - 2018-06-12
- Updated dependencies
- Fixed a bug in TR064 module that caused "Auth. Failed" by multiple requests

# v2.4.0 - 2018-06-11
- Fixed telegram notification for callmonitor

# v2.3.8 - 2018-06-11
- Changed presence polling
- Added possibility to remove/add "Anyone" sensor from config.json (see [example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json))

# v2.3.7 - 2018-06-11
- Better presence detection
- Changed telegram notification for presence (see [example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json))
- Changed telegram function (possibility to choose which message should pushed as notification, if any message field = "" or not exist, you will not receive any notification for only this function without affecting other functions)
- Polling limit reduced from 10s to 5s
- Bugfixes
- New [Debug tool](https://github.com/SeydX/fritzplatform-util)

# v2.3.6 - 2018-06-08
- Fixed Auth. failure (presence)
- Fixed Telegram push notification (presence)

# v2.3.4 - 2018-06-08
- Fixed Auth. failure (presence)

# v2.3.3 - 2018-06-08
- Changed presence structure (see [example-config.json](https://github.com/SeydX/homebridge-fritz-platform/blob/master/example/example-config.json))
- An error has been fixed that caused the presence sensors not to switch correctly (if no presence detected)
- Improved presence adresse detection
- Possiblitiy to add ip adress to presence

# v2.3.2 - 2018-06-08
- Added "type" option to presence sensors (motion/occupancy)
- Fixed a bug with presence delay
- Update dependencies
- Clean up code

# v2.3.1 - 2018-06-07
- Added type to config.json to support cable router _("type":"cable" , Default: "type":"dsl")_

# v2.3.0 - 2018-06-07
- Added "delay" option to presence
- Bugfixes (callmonitor)
- Fixed a bug with initializing config.json

# v2.2.7 - 2018-06-07
- Added ip information for Reboot and Reconnect
- Clean up code

# v2.2.5 - 2018-06-06
- Created initial basic accessory and initial work
