'use strict';

/**
 * AHA client for templates and scenarios.
 *
 * Uses the same login path as the rest of the plugin: the session ID comes
 * from TR-064 `X_AVM-DE_CreateUrlSID` on the shared FritzBox client
 * (meshMaster.fritzbox), the request goes through `requestAHA`.
 *
 * Differences to the per-call pattern in smarthome.handler.js:
 *  - the SID is cached and reused;
 *  - on HTTP 403 ("Session-ID ungültig oder Benutzer nicht autorisiert",
 *    AHA-HTTP-Interface 1.63, section 4) a new SID is fetched and the request
 *    is repeated exactly once. A second 403 is reported, never retried again.
 *  - the SID is never logged.
 */

const { requestAHA } = require('../../lib/fritzbox/request');
const { parseTemplateList } = require('./templates.parser');

const DEFAULT_TIMEOUT_MS = 9000; // stay below HomeKit's ~10 s write timeout

const shortId = (id) => {
  const s = String(id || '');
  return s.length > 9 ? `${s.slice(0, 3)}…${s.slice(-4)}` : s;
};

const withTimeout = (promise, ms, what) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${what}: no answer from the FRITZ!Box within ${Math.round(ms / 1000)} s`);
      err.code = 'TEMPLATE_TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

class AhaTemplateClient {
  /**
   * @param {object} opts
   * @param {object} opts.fritzbox   FritzBox client (exec(), url.hostname)
   * @param {Function} [opts.request] requestAHA(host, cmd) – injectable for tests
   * @param {number} [opts.timeoutMs]
   * @param {object} [opts.log]      logger with debug/warn
   */
  constructor({ fritzbox, request = requestAHA, timeoutMs = DEFAULT_TIMEOUT_MS, log } = {}) {
    if (!fritzbox) throw new Error('AhaTemplateClient needs a FritzBox client');
    this.fritzbox = fritzbox;
    this.request = request;
    this.timeoutMs = timeoutMs;
    this.log = log || { debug() {}, warn() {} };
    this.sid = null;
  }

  async getSid(force = false) {
    if (this.sid && !force) return this.sid;

    const response = await this.fritzbox.exec('urn:DeviceConfig-com:serviceId:DeviceConfig1', 'X_AVM-DE_CreateUrlSID');
    const urlSid = (response && response['NewX_AVM-DE_UrlSID']) || '';
    const sid = urlSid.split('sid=')[1];

    if (!sid || /^0+$/.test(sid)) {
      this.sid = null;
      const err = new Error(
        'FRITZ!Box did not issue a session ID (check user name, password and the "Smart Home" right)'
      );
      err.code = 'NO_SID';
      throw err;
    }

    this.sid = sid;
    return sid;
  }

  /** One AHA command with SID handling; one retry on 403 with a fresh SID. */
  async call(cmd) {
    const host = this.fritzbox.url.hostname;
    const sid = await this.getSid(false);

    try {
      return await this.request(host, { ...cmd, sid });
    } catch (err) {
      if (err.code !== 403) throw err;
      this.log.debug(`AHA ${cmd.switchcmd}: session expired (403), logging in again once`);
    }

    const freshSid = await this.getSid(true);
    try {
      return await this.request(host, { ...cmd, sid: freshSid });
    } catch (err) {
      if (err.code === 403) {
        this.sid = null;
        const denied = new Error(
          `AHA ${cmd.switchcmd}: access denied (403) after a fresh login. The FRITZ!Box user needs the "Smart Home" right.`
        );
        denied.code = 403;
        throw denied;
      }
      throw err;
    }
  }

  async getTemplates() {
    const body = await withTimeout(
      this.call({ switchcmd: 'gettemplatelistinfos' }),
      this.timeoutMs * 2,
      'gettemplatelistinfos'
    );
    return parseTemplateList(String(body));
  }

  async applyOne(identifier) {
    const body = await this.call({ switchcmd: 'applytemplate', ain: identifier });
    const answer = String(body === undefined || body === null ? '' : body).trim();

    if (answer.toLowerCase() === 'inval') {
      const err = new Error(`applytemplate ${shortId(identifier)}: FRITZ!Box answered "inval"`);
      err.code = 'INVAL';
      throw err;
    }

    this.log.debug(`applytemplate ${shortId(identifier)}: answer "${answer.slice(0, 20)}"`);
    return answer;
  }

  /**
   * Apply a template or scenario.
   *
   * Scenarios are applied with applytemplate on the scenario identifier
   * (the AVM document lists scenarios as templates with <sub_templates/>).
   * If the FRITZ!Box rejects that (HTTP 400 or "inval"), the sub-templates
   * are applied one after another instead (fallback, logged as a warning).
   *
   * @param {object} template  { identifier, name, isScenario, subTemplates }
   * @returns {Promise<{mode: 'direct'|'subtemplates', applied: string[]}>}
   */
  async applyTemplate(template) {
    const run = async () => {
      try {
        await this.applyOne(template.identifier);
        return { mode: 'direct', applied: [template.identifier] };
      } catch (err) {
        const rejected = err.code === 400 || err.code === 'INVAL';
        const subs = template.subTemplates || [];

        if (!template.isScenario || !rejected || !subs.length) throw err;

        this.log.warn(
          `Scenario "${template.name}": the FRITZ!Box did not accept applytemplate for the scenario itself ` +
            `(${err.code}). Applying its ${subs.length} templates one by one instead.`
        );

        for (const sub of subs) {
          await this.applyOne(sub);
        }
        return { mode: 'subtemplates', applied: subs.slice() };
      }
    };

    return withTimeout(run(), this.timeoutMs, `applytemplate "${template.name}"`);
  }
}

module.exports = { AhaTemplateClient, shortId, withTimeout, DEFAULT_TIMEOUT_MS };
