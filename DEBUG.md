# Debugging

Wenn das Plugin sich nicht so verhält wie erwartet, gibt es zwei nützliche Debug-Mechanismen.

## 1. Plugin-Debug-Mode

In deiner `config.json` im FritzPlatform-Block:

```json
{
  "platform": "FritzPlatform",
  "debug": true,
  ...
}
```

Anschließend Homebridge neu starten. Die Logs zeigen jetzt detaillierte Informationen zu jedem Polling-Zyklus, AHA-API-Antworten, und Accessory-State-Übergängen.

**Wichtig beim Posten von Debug-Logs in Issues:**
- FritzBox-Passwort entfernen (steht zwar nicht direkt im Log, aber sicherheitshalber prüfen)
- FritzBox-IP entfernen (z.B. `192.168.x.x` ersetzen durch `192.168.X.X`)
- AINs können stehen bleiben (sind nicht sensibel)
- Bridge-PIN nicht mitposten

## 2. VS Code Debugger

Wenn du den Plugin-Code lokal weiterentwickelst:

`.vscode/launch.json` im Repo-Root anlegen:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Homebridge with Plugin",
      "program": "${env:HOME}/homebridge-test/node_modules/homebridge/bin/homebridge",
      "args": [
        "-U", "${env:HOME}/homebridge-test",
        "--plugin-path", "${env:HOME}/homebridge-test/node_modules"
      ],
      "request": "launch",
      "skipFiles": ["<node_internals>/**"],
      "type": "pwa-node"
    }
  ]
}
```

Vorausgesetzt du hast ein Test-Homebridge-Setup unter `~/homebridge-test/` und das Plugin per `npm link` reingezogen.

## 3. Plugin-Files direkt anschauen

Logs-Pfad bei einem hb-service-Setup (Homebridge UI X):

- macOS: `~/Library/Logs/homebridge/`
- Linux: `/var/log/homebridge/`
- Via CLI: `hb-service logs`

Häufige Fehlerbilder:

| Symptom | Wahrscheinliche Ursache |
|---|---|
| `Can not find switch data` | Gerät hat keinen schaltbaren Relais-Ausgang (z.B. Energy 250) — falscher `accType` in Config |
| `Can not find device with AIN: ...` | AIN-Tippfehler in Config, oder Gerät ist beim Plugin-Start offline an der FritzBox |
| `TypeError: Cannot read properties of undefined (reading 'UUID')` | Custom-Characteristic nicht registriert — typisch wenn `hide: false` beim Router gesetzt ist (siehe README zu Router-Limitationen) |
| `ECONNREFUSED` / TLS-Fehler beim Start | FritzBox-IP, Port (49443 für TR-064 SSL), oder TR-064-Zugriff in FritzBox-UI nicht aktiviert |
| Polling läuft, aber Werte aktualisieren nicht | FritzBox-User hat keine "Smart Home"-Berechtigung → in FritzBox-UI prüfen |

## Issues mit reproduzierbarem Debug-Output melden

Wenn du nach diesen Schritten weiter Probleme hast, [öffne ein Issue](https://github.com/PelleBot/homebridge-fritz-platform/issues/new/choose) und füge den relevanten Debug-Log-Auszug an. Bitte das Issue-Template nutzen — es führt durch alle nötigen Informationen.
