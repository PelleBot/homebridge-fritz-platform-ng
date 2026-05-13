'use strict';

/**
 * Custom UI Server for @pellebot/homebridge-fritz-platform-hb2
 *
 * This server runs inside Homebridge Config UI X when the user opens the
 * plugin's settings page. It exposes endpoints that the frontend (in
 * public/index.html) calls to perform actions that need server-side context:
 *
 *   - connection-test:  ping the FritzBox via TR-064 + AHA-API
 *   - discover-devices: list all smart-home devices on the FritzBox
 *   - probe-energy-250: detect HAN-FUN OBIS-reader sub-AINs
 *
 * Phase A baseline (this file): single /ping endpoint that returns metadata
 * about the server. Used to verify the Custom-UI plumbing works at all.
 * Later phases will add the real endpoints listed above.
 */

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const { version } = require('../package.json');

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    // Baseline endpoint — proves the custom UI server is reachable.
    this.onRequest('/ping', () => this.handlePing());

    // Signal to Config UI X that we are ready to serve requests.
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
}

(() => new UiServer())();
