'use strict';

/**
 * Custom UI Server for @pellebot/homebridge-fritz-platform-hb2
 *
 * Runs inside Homebridge Config UI X when the user opens the plugin's
 * settings page. Exposes endpoints that the frontend in public/index.html
 * calls via window.homebridge.request(endpoint, payload).
 *
 * Endpoints:
 *   /ping              — server health check (returns plugin metadata)
 *   /test-connection   — verify TR-064 + AHA-API reachability of a FritzBox
 *   /discover-devices  — list smart-home devices with auto-detected accType
 *
 * Later phases will add:
 *   /probe-energy-250  — group HAN-FUN OBIS sub-AINs into Energy 250 setup
 *   /save-config       — persist the wizard output back to config.json
 */

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const { version } = require('../package.json');
const net = require('net');
const Fritzbox = require('@seydx/fritzbox');

// @seydx/fritzbox (got) sets no request timeout. If the FritzBox accepts a
// connection but never answers (typically the TR-064 HTTPS port when ssl is on),
// the wizard would wait forever (issue #1). All FritzBox calls from the wizard
// therefore run against a deadline; on timeout we probe the ports involved to
// tell the user which one does not respond.
const TEST_TIMEOUT_MS = 15000;
const DISCOVER_TIMEOUT_MS = 30000;
const PORT_PROBE_TIMEOUT_MS = 3000;
const TR064_SSL_PORT = 49443;
const AHA_HTTP_PORT = 80;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Keine Antwort der FritzBox innerhalb von ${Math.round(ms / 1000)} Sekunden.`);
      err.code = 'WIZARD_TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Resolves to 'open', 'refused', 'timeout' or the socket error code.
function probePort(host, port, ms = PORT_PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(ms, () => finish('timeout'));
    socket.once('connect', () => finish('open'));
    socket.once('error', (err) => finish(err.code === 'ECONNREFUSED' ? 'refused' : err.code || 'error'));
  });
}

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest('/ping', () => this.handlePing());
    this.onRequest('/test-connection', (payload) => this.handleTestConnection(payload));
    this.onRequest('/discover-devices', (payload) => this.handleDiscoverDevices(payload));

    this.ready();
  }

  async handlePing() {
    return {
      ok: true,
      plugin: '@pellebot/homebridge-fritz-platform-hb2',
      version,
      timestamp: new Date().toISOString(),
      message: 'Custom UI server is alive.',
    };
  }

  makeFritzbox(payload) {
    return new Fritzbox({
      host: payload.host,
      port: parseInt(payload.port, 10) > 0 ? parseInt(payload.port, 10) : 49000,
      username: payload.username,
      password: payload.password,
      ssl: payload.ssl !== false,
      tr064: payload.tr064 !== false,
    });
  }

  async handleTestConnection(payload = {}) {
    if (!payload.host || !payload.username || !payload.password) {
      return { ok: false, error: 'Host, Username und Password sind Pflichtfelder.' };
    }

    const fb = this.makeFritzbox(payload);

    try {
      const list = await withTimeout(fb.getSmarthomeDevices(), TEST_TIMEOUT_MS);
      const devices = (list && list.devices) || [];

      return {
        ok: true,
        message: `Verbindung erfolgreich. ${devices.length} Smart-Home-Gerät(e) auf der FritzBox gefunden.`,
        deviceCount: devices.length,
        productNames: [...new Set(devices.map((d) => d.productname).filter(Boolean))],
      };
    } catch (err) {
      if (err && err.code === 'WIZARD_TIMEOUT') {
        return this.formatTimeoutError(err, payload);
      }
      return this.formatConnectionError(err);
    }
  }

  /**
   * After a timeout: check which of the ports the library uses answers, so the
   * hint names the likely cause instead of leaving the user guessing.
   */
  async formatTimeoutError(err, payload) {
    const host = payload.host;
    const port = parseInt(payload.port, 10) > 0 ? parseInt(payload.port, 10) : 49000;
    const ssl = payload.ssl !== false;

    const targets = [{ port, label: 'TR-064' }];
    if (ssl) targets.push({ port: TR064_SSL_PORT, label: 'TR-064 HTTPS' });
    targets.push({ port: AHA_HTTP_PORT, label: 'Smart-Home-Schnittstelle (HTTP)' });

    const results = await Promise.all(targets.map(async (t) => ({ ...t, state: await probePort(host, t.port) })));
    const summary = results.map((r) => `${r.label} Port ${r.port}: ${r.state === 'open' ? 'erreichbar' : r.state}`).join(', ');

    const blocked = results.find((r) => r.state !== 'open');
    let hint;
    if (blocked && blocked.port === port) {
      hint =
        ' Tipp: Die FritzBox ist unter dieser Adresse auf dem TR-064-Port nicht erreichbar. Host-Adresse prüfen und in der ' +
        'FritzBox unter Heimnetz → Netzwerk → Netzwerkeinstellungen „Zugriff für Anwendungen zulassen“ aktivieren.';
    } else if (blocked && blocked.port === TR064_SSL_PORT) {
      hint =
        ' Tipp: Der HTTPS-Port für TR-064 antwortet nicht. Option „SSL“ ausschalten und erneut testen ' +
        '(im Heimnetz unkritisch) oder prüfen, ob eine Firewall Port 49443 sperrt.';
    } else if (blocked && blocked.port === AHA_HTTP_PORT) {
      hint = ' Tipp: Die Smart-Home-Schnittstelle der FritzBox (Port 80) antwortet nicht. Firewall zwischen Homebridge und FritzBox prüfen.';
    } else if (ssl) {
      hint =
        ' Tipp: Alle Ports sind erreichbar, die FritzBox antwortet aber nicht. Option „SSL“ ausschalten und erneut testen; ' +
        'hilft das nicht, Benutzer und Berechtigung „Smart Home“ in der FritzBox prüfen.';
    } else {
      hint = ' Tipp: Alle Ports sind erreichbar, die FritzBox antwortet aber nicht. Benutzer und Berechtigung „Smart Home“ prüfen.';
    }

    return {
      ok: false,
      error: `${err.message} (${summary})`,
      code: err.code,
      hint,
    };
  }

  formatConnectionError(err) {
    const code = err && err.code;
    let hint = '';
    if (code === 'ECONNREFUSED') {
      hint = ' Tipp: TR-064-Zugriff in der FritzBox-UI unter Heimnetz → Netzwerk → Netzwerkeinstellungen aktivieren.';
    } else if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
      hint = ' Tipp: Host-Adresse stimmt nicht — ist die FritzBox unter dieser IP erreichbar (Ping testen)?';
    } else if (code === 'ETIMEDOUT') {
      hint = ' Tipp: Network-Firewall blockiert Port? Standardports sind 49000 (HTTP) und 49443 (HTTPS).';
    } else if (err && err.message && /401|unauthor/i.test(err.message)) {
      hint = ' Tipp: User oder Passwort stimmen nicht. FritzBox-User braucht "Smart Home"-Berechtigung.';
    }
    return {
      ok: false,
      error: (err && err.message) || String(err),
      code: code || null,
      hint,
    };
  }

  /**
   * Discover all smart-home devices on the FritzBox and infer a recommended
   * accType per device, plus a list of supporting feature flags so the
   * frontend can render appropriate conditional checkboxes (temperature,
   * window, battery, brightness, color).
   *
   * Detection rules (priority order):
   *   1. device has .hkr        → 'thermostat'
   *   2. device has .colorcontrol or .levelcontrol → 'lightbulb'
   *   3. device has .switch + .powermeter           → 'switch' with energy
   *   4. device has .switch                         → 'switch'
   *   5. AIN ends with -1 or -2 (OBIS sub-AIN)      → 'energy-temperature'
   *   6. device has .powermeter (no switch, e.g. HAN-FUN gateway base)
   *                                                 → mark as 'skip' (group with OBIS)
   *   7. device has .alarm                          → 'contact' (window/door)
   *   8. device has .temperature                    → 'temperature'
   *   9. else                                       → 'unknown' (mark inactive)
   */
  detectAccType(d) {
    // @seydx/fritzbox normalizes AVM AHA device structure as follows:
    //   d.thermostat   = { current, target, windowOpen }   or false
    //   d.light        = { state, brightness, color }      or false
    //   d.switch       = { state, mode, lock, devicelock } or false
    //   d.powermeter   = { power, energy, voltage }        or false
    //   d.temperature  = { value, offset }                 or false
    //   d.humidity     = { value }                         or false
    //   d.button       = { name, ... }                     or false
    //   d.blind        = { ... }                           or false
    //   d.battery      = { value, low }                    or false
    //   d.alert        = (boolean) — alarm sensor triggered
    //
    // Always-present keys; missing-feature is signaled by `false` (not absence).
    const ainSuffix = (d.ain || '').match(/-([12])$/);
    const isObj = (x) => x && typeof x === 'object';

    const flags = {
      hasThermostat: isObj(d.thermostat),
      hasLight: isObj(d.light),
      hasSwitch: isObj(d.switch),
      hasPowermeter: isObj(d.powermeter),
      hasTemperature: isObj(d.temperature),
      hasHumidity: isObj(d.humidity),
      hasButton: isObj(d.button),
      hasBlind: isObj(d.blind),
      hasBattery: isObj(d.battery),
      hasAlert: d.alert === true,
      hasColorcontrol: !!(d.light && d.light.color),
      hasLevelcontrol: !!(d.light && d.light.brightness),
      isObisSubain: !!ainSuffix,
      obisDirection: ainSuffix ? (ainSuffix[1] === '1' ? 'consumption' : 'feed-in') : null,
    };

    // Priority order: physical features take precedence over the AIN -1/-2
    // suffix. DECT 500 lightbulbs and other HAN-FUN sub-units also use the
    // -1 suffix even though they are not OBIS readers.
    let accType = 'unknown';
    let reasonDe = 'Gerätetyp nicht eindeutig erkannt';

    if (flags.hasThermostat) {
      accType = 'thermostat';
      reasonDe = 'Heizkörper-Thermostat (HKR)';
    } else if (flags.hasLight) {
      accType = 'lightbulb';
      const extras = [];
      if (flags.hasColorcontrol) extras.push('Farbe');
      if (flags.hasLevelcontrol) extras.push('Helligkeit');
      reasonDe = 'DECT-Lampe' + (extras.length ? ' (' + extras.join(' + ') + ')' : '');
    } else if (flags.hasSwitch && flags.hasPowermeter) {
      accType = 'switch';
      reasonDe = 'Schaltbare Steckdose mit Energiemessung';
    } else if (flags.hasSwitch) {
      accType = 'switch';
      reasonDe = 'Schaltbare Steckdose';
    } else if (flags.hasBlind) {
      accType = 'blind';
      reasonDe = 'Rolllade';
    } else if (flags.isObisSubain && flags.hasPowermeter) {
      // OBIS sub-AIN of a Smart Energy 250 reader: powermeter present, no
      // other interactive features. Recommend energy-temperature so Apple
      // Home shows the numeric values natively.
      accType = 'energy-temperature';
      reasonDe = `OBIS-Reader Sub-AIN (${flags.obisDirection === 'consumption' ? 'Bezug 1.x' : 'Einspeisung 2.x'}) — 4-Tiles-Setup in Schritt 3`;
    } else if (flags.hasButton) {
      accType = 'button';
      reasonDe = 'DECT-Taster';
    } else if (flags.hasAlert) {
      accType = 'contact';
      reasonDe = 'Alarm-/Fenster-Sensor';
    } else if (flags.hasTemperature) {
      accType = 'temperature';
      reasonDe = 'Temperatur-Sensor';
    } else if (flags.hasPowermeter) {
      // HAN-FUN gateway base AIN (no sub-AIN) — typically the Smart Energy 250 base.
      accType = 'skip';
      reasonDe = 'HAN-FUN-Gateway (z.B. Smart Energy 250 Basis) — wird in Schritt 3 verarbeitet';
    }

    return { accType, reasonDe, flags };
  }

  async handleDiscoverDevices(payload = {}) {
    if (!payload.host || !payload.username || !payload.password) {
      return { ok: false, error: 'Host, Username und Password sind Pflichtfelder.' };
    }

    const fb = this.makeFritzbox(payload);

    try {
      const list = await withTimeout(fb.getSmarthomeDevices(), DISCOVER_TIMEOUT_MS);
      const rawDevices = (list && list.devices) || [];

      const devices = rawDevices.map((d) => {
        const detection = this.detectAccType(d);
        return {
          ain: d.ain,
          name: d.name,
          productname: d.productname || '',
          functionbitmask: d.functionbitmask || null,
          online: d.online !== false,
          ...detection,
        };
      });

      return {
        ok: true,
        message: `${devices.length} Gerät(e) gefunden.`,
        devices,
      };
    } catch (err) {
      return this.formatConnectionError(err);
    }
  }
}

(() => new UiServer())();
