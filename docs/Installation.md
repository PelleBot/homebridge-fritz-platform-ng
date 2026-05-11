# FritzBox-Setup für TR-064-Zugriff

Bevor du dieses Plugin installierst, muss deine FritzBox so konfiguriert sein, dass das Plugin sie über TR-064 erreichen kann.

## 1. TR-064-Schnittstelle aktivieren

In der FritzBox-Web-Oberfläche (`http://fritz.box` oder direkt die IP):

**Heimnetz → Heimnetzübersicht → Netzwerkeinstellungen** (Reiter)

Beide Optionen aktivieren:

- [x] **Zugriff für Anwendungen zulassen**
- [x] **Statusinformationen über UPnP übertragen**

Speichern.

## 2. Eigenen FritzBox-User anlegen

Empfehlung: **nicht den existierenden Admin-User** für das Plugin verwenden, sondern einen dedizierten "Homebridge"-User mit minimalen Rechten.

**System → FritzBox-Benutzer** → "Benutzer hinzufügen"

- Name: z.B. `homebridge`
- Passwort: ein starkes Passwort generieren und in deinen Password-Manager speichern (dieses Passwort kommt gleich in die Plugin-Config — und es ist sensibel)
- Bei "Benutzer darf von außen über das Internet zugreifen": **deaktiviert** lassen (Plugin läuft im LAN)

**Berechtigungen** für den neuen User:

- [x] **FRITZ!Box Einstellungen** (für TR-064)
- [x] **Smart Home** (kritisch für DECT-Geräte)
- Andere Rechte (Sprachnachrichten, VPN etc.) optional — werden vom Plugin nicht genutzt

## 3. Verifikation

Im Terminal:

```bash
curl -s -k --user 'homebridge:DEIN_PASSWORT' \
  'https://192.168.x.x:49443/tr064desc.xml' | head -20
```

(IP anpassen — meist `192.168.178.1` oder `192.168.1.1`.)

Erwartung: XML mit `<root>`-Tag und Service-Liste. Wenn `401 Unauthorized` zurückkommt, stimmen User oder Passwort nicht. Wenn `connection refused` kommt, ist TR-064 nicht aktiviert (siehe Schritt 1).

## 4. Plugin installieren

```bash
npm install -g @pellebot/homebridge-fritz-platform@beta
```

## 5. Minimal-Config einsetzen

Siehe das Beispiel in der [README](../README.md#konfiguration). Empfohlene Default-Werte für den Router-Eintrag:

- `tr064: true`
- `ssl: true`
- `master: true`
- `hide: true` (Router-Accessory wird NICHT in HomeKit angezeigt — aktuell empfohlen, siehe README "Bekannte Limitationen")

## 6. Restart Homebridge

Nach dem Speichern der Config: Homebridge restarten (Config UI X "Restart Homebridge"-Button, oder via CLI auf macOS: `sudo launchctl kickstart -k system/com.homebridge.server`).

Im Log sollte erscheinen:

```
[FritzBox] Initializing FritzPlatform platform...
[FritzBox] FritzBox: Setup accessory...
[FritzBox] <Dein-Thermostat-Name>: Configuring new accessory...
```

Wenn nicht: siehe [../DEBUG.md](../DEBUG.md).
