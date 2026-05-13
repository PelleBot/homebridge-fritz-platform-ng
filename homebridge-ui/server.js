'use strict';

/**
 * Custom UI Server for @pellebot/homebridge-fritz-platform-hb2
 *
 * Runs inside Homebridge Config UI X when the user opens the plugin's
 * settings page. Exposes endpoints that the frontend in public/index.html
 * calls via window.homebridge.request(endpoint, payload).
 *
 * Endpoints:
 *   /ping             — server health check (returns plugin metadata)
 *   /test-connection  — verify TR-064 + AHA-API reachability of a FritzBox
 *
 * Later phases will add:
 *   /discover-devices  — full Smart-Home device list with metadata
 *   /probe-energy-250  — detect HAN-FUN OBIS sub-AINs
 */

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const { version } = require('../package.json');

// Use the same FritzBox client the plugin uses (@seydx/fritzbox). Plugin root
// node_modules satisfies the resolution from homebridge-ui/server.js.
const Fritzbox = require('@seydx/fritzbox');

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest('/ping', () => this.handlePing());
    this.onRequest('/test-connection', (payload) => this.handleTestConnection(payload));

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

  /**
   * Verify FritzBox is reachable via TR-064 + AHA-API with the given creds.
   * Returns { ok, message, deviceCount, details? } or { ok: false, error, code }.
   *
   * Strategy: instantiate Fritzbox client and fetch the smart-home device list.
   * Success implies (a) TCP connection works, (b) credentials accepted, (c) AHA
   * endpoint responds with parseable XML. This single call exercises the full
   * TR-064 auth handshake and the AHA-API in one step.
   */
  async handleTestConnection(payload = {}) {
    const { host, port, username, password, ssl, tr064 } = payload;

    if (!host || !username || !password) {
      return { ok: false, error: 'Host, Username und Password sind Pflichtfelder.' };
    }

    const fb = new Fritzbox({
      host,
      port: parseInt(port, 10) > 0 ? parseInt(port, 10) : 49000,
      username,
      password,
      ssl: ssl !== false,
      tr064: tr064 !== false,
    });

    try {
      const list = await fb.getSmarthomeDevices();
      const devices = (list && list.devices) || [];

      return {
        ok: true,
        message: `Verbindung erfolgreich. ${devices.length} Smart-Home-Gerät(e) auf der FritzBox gefunden.`,
        deviceCount: devices.length,
        productNames: [...new Set(devices.map((d) => d.productname).filter(Boolean))],
      };
    } catch (err) {
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
  }
}

(() => new UiServer())();
