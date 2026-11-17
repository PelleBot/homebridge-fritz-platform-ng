'use strict';

/**
 * FRITZ!Box templates and scenarios as HomeKit switches (opt-in, v1.4.0).
 *
 *  - Button per template/scenario (stateless): On → applytemplate, back to Off
 *    after ~1 s. UUID derived from the template identifier, so renaming the
 *    template in the FRITZ!Box keeps the HomeKit assignment.
 *  - Optional mode switch (stateful): On → onTemplate, Off → offTemplate.
 *    The FRITZ!Box does not report which template was applied last, so the
 *    state lives in a small JSON file under api.user.persistPath().
 *
 * Accessories are created after the template list has been read from the
 * FRITZ!Box. Orphans are removed only after a successful read; while the
 * FRITZ!Box is unreachable the cached switches stay and keep working with the
 * last known template data.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { AhaTemplateClient, shortId } = require('./templates.client');

const TYPE = 'template';
const SUBTYPE_BUTTON = 'template-button';
const SUBTYPE_MODE = 'template-mode';
const STATE_FILE = 'homebridge-fritz-platform-hb2.templates.json';

class StateStore {
  constructor(dir) {
    this.file = dir ? path.join(dir, STATE_FILE) : null;
    this.data = { mode: {} };
    this.load();
  }

  load() {
    if (!this.file) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed && typeof parsed.mode === 'object' && parsed.mode) this.data = { mode: parsed.mode };
    } catch (err) {
      if (err.code !== 'ENOENT') logger.warn(`Templates: could not read ${STATE_FILE}, starting with mode switch Off.`);
    }
  }

  get(uuid) {
    return this.data.mode[uuid] === true;
  }

  set(uuid, value) {
    this.data.mode[uuid] = value === true;
    if (!this.file) return;
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      logger.warn(`Templates: could not save the mode switch state (${err.code || err.message}).`);
    }
  }
}

const snapshot = (t) => ({
  identifier: t.identifier,
  name: t.name,
  isScenario: t.isScenario === true,
  subTemplates: (t.subTemplates || []).slice(),
});

class TemplateManager {
  /**
   * @param {object} opts
   * @param {object} opts.api         Homebridge API
   * @param {Function} opts.Accessory platformAccessory constructor
   * @param {Function} opts.getAccessories () => cached platform accessories
   * @param {Function} opts.addAccessory   (accessory) => register with Homebridge
   * @param {Function} opts.removeAccessory (accessory) => unregister
   * @param {object} opts.meshMaster  { fritzbox }
   * @param {object} opts.config      normalised templates config
   * @param {string} opts.version     plugin version
   * @param {number} [opts.resetMs]   button auto-off delay
   */
  constructor(opts) {
    this.api = opts.api;
    this.Accessory = opts.Accessory;
    this.getAccessories = opts.getAccessories;
    this.addAccessory = opts.addAccessory;
    this.removeAccessory = opts.removeAccessory;
    this.meshMaster = opts.meshMaster;
    this.config = opts.config;
    this.version = opts.version;
    this.resetMs = opts.resetMs === undefined ? 1000 : opts.resetMs;

    this.client = null;
    this.templates = null; // last successful list
    this.bound = new Set();
    this.lastMissingKey = '';
    this.timer = null;
    this.retryMinutes = 1;
    this.stopped = false;

    let persistDir = null;
    try {
      persistDir = this.api.user && this.api.user.persistPath ? this.api.user.persistPath() : null;
    } catch {
      persistDir = null;
    }
    this.store = new StateStore(persistDir);
  }

  static isTemplateAccessory(accessory) {
    return Boolean(
      accessory && accessory.context && accessory.context.config && accessory.context.config.type === TYPE
    );
  }

  uuidFor(key) {
    return this.api.hap.uuid.generate(`fritz-template:${key}`);
  }

  async start() {
    if (!this.client) {
      this.client = new AhaTemplateClient({ fritzbox: this.meshMaster.fritzbox, log: logger });
    }

    // Cached switches work right away with their stored template data.
    this.templateAccessories().forEach((acc) => this.bind(acc));

    const ok = await this.sync();
    if (this.stopped) return;
    this.schedule(ok);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(lastOk) {
    if (this.stopped) return;
    let minutes;
    if (lastOk) {
      this.retryMinutes = 1;
      if (!this.config.refreshMinutes) return;
      minutes = this.config.refreshMinutes;
    } else {
      // back off 1, 2, 4 … minutes, at most the refresh interval (or 60)
      minutes = this.retryMinutes;
      this.retryMinutes = Math.min(this.retryMinutes * 2, this.config.refreshMinutes || 60);
    }
    this.timer = setTimeout(async () => {
      const ok = await this.sync();
      this.schedule(ok);
    }, minutes * 60 * 1000);
    if (this.timer.unref) this.timer.unref();
  }

  templateAccessories() {
    return this.getAccessories().filter((acc) => TemplateManager.isTemplateAccessory(acc));
  }

  find(list, wanted) {
    return (
      list.find((t) => t.identifier === wanted) ||
      list.find((t) => t.name === wanted) ||
      list.find((t) => t.name.toLowerCase() === wanted.toLowerCase())
    );
  }

  displayName(template) {
    const override = this.config.names.find(
      (n) => n.template === template.identifier || n.template.toLowerCase() === template.name.toLowerCase()
    );
    return override ? override.name : template.name;
  }

  /** Desired accessories for a template list. */
  resolve(list) {
    const desired = new Map();
    const missing = [];

    const buttons = [];
    if (this.config.exposeAll) {
      // AVM: auto-created templates without <sub_templates/> belong to a
      // predefined scenario and should not be shown.
      list.filter((t) => !(t.autocreate && !t.isScenario)).forEach((t) => buttons.push(t));
    }
    this.config.include.forEach((wanted) => {
      const t = this.find(list, wanted);
      if (!t) missing.push(wanted);
      else if (!buttons.includes(t)) buttons.push(t);
    });

    buttons.forEach((t) => {
      desired.set(this.uuidFor(t.identifier), {
        type: TYPE,
        subtype: SUBTYPE_BUTTON,
        name: this.displayName(t),
        template: snapshot(t),
      });
    });

    const mode = this.config.modeSwitch;
    if (mode.enabled) {
      const on = this.find(list, mode.onTemplate);
      const off = this.find(list, mode.offTemplate);
      if (!on) missing.push(mode.onTemplate);
      if (!off) missing.push(mode.offTemplate);
      if (on && off) {
        desired.set(this.uuidFor('mode-switch'), {
          type: TYPE,
          subtype: SUBTYPE_MODE,
          name: mode.name,
          on: snapshot(on),
          off: snapshot(off),
        });
      } else {
        missing.push(`(mode switch "${mode.name}" is not created)`);
      }
    }

    return { desired, missing };
  }

  async sync() {
    let list;
    try {
      list = await this.client.getTemplates();
    } catch (err) {
      logger.warn(`Templates: could not read the template list from the FRITZ!Box (${err.code || err.message}).`);
      logger.debug(err.message);
      return false;
    }
    if (this.stopped) return true;

    this.templates = list;
    logger.debug(`Templates: ${list.length} templates/scenarios read`);

    const { desired, missing } = this.resolve(list);

    const missingKey = missing.join('\n');
    if (missing.length && missingKey !== this.lastMissingKey) {
      missing.forEach((m) =>
        logger.warn(
          m.startsWith('(')
            ? `Templates: ${m.slice(1, -1)} because a template is missing.`
            : `Templates: "${m}" does not exist in the FRITZ!Box (name or identifier). Entry ignored.`
        )
      );
    }
    this.lastMissingKey = missingKey;

    // remove orphans (only after a successful read)
    this.templateAccessories().forEach((acc) => {
      if (!desired.has(acc.UUID)) {
        logger.info('Templates: removing switch that is no longer configured or no longer exists.', acc.displayName);
        this.bound.delete(acc.UUID);
        this.removeAccessory(acc);
      }
    });

    // add or update
    for (const [uuid, config] of desired.entries()) {
      let acc = this.templateAccessories().find((a) => a.UUID === uuid);
      if (!acc) {
        logger.info('Templates: adding switch...', config.name);
        acc = new this.Accessory(config.name, uuid);
        acc.context.config = config;
        this.addAccessory(acc);
      } else {
        acc.context.config = config;
      }
      this.bind(acc);
    }

    return true;
  }

  hapError() {
    const hap = this.api.hap;
    if (hap.HapStatusError && hap.HAPStatus) {
      return new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    const err = new Error('SERVICE_COMMUNICATION_FAILURE');
    err.hapStatus = -70402;
    return err;
  }

  setupInformation(acc) {
    const { Service, Characteristic } = this.api.hap;
    const cfg = acc.context.config;
    const info = acc.getService(Service.AccessoryInformation);
    if (!info) return;
    const model =
      cfg.subtype === SUBTYPE_MODE ? 'Mode switch' : cfg.template && cfg.template.isScenario ? 'Scenario' : 'Template';
    const serial = cfg.subtype === SUBTYPE_MODE ? 'mode-switch' : shortId(cfg.template.identifier);
    info.setCharacteristic(Characteristic.Manufacturer, 'AVM FRITZ!Box');
    info.setCharacteristic(Characteristic.Model, model);
    info.setCharacteristic(Characteristic.SerialNumber, serial);
    info.setCharacteristic(Characteristic.FirmwareRevision, this.version);
  }

  bind(acc) {
    const { Service, Characteristic } = this.api.hap;
    const cfg = acc.context.config;

    this.setupInformation(acc);

    let service = acc.getService(Service.Switch);
    if (!service) {
      service = acc.addService(Service.Switch, cfg.name, cfg.subtype);
    }
    service.setCharacteristic(Characteristic.Name, cfg.name);

    if (this.bound.has(acc.UUID)) return; // handlers already attached; config is read live
    this.bound.add(acc.UUID);

    const on = service.getCharacteristic(Characteristic.On);

    if (cfg.subtype === SUBTYPE_MODE) {
      on.updateValue(this.store.get(acc.UUID));
      on.onGet(() => this.store.get(acc.UUID));
      on.onSet((value) => this.setMode(acc, on, value === true || value === 1));
    } else {
      on.updateValue(false);
      on.onGet(() => false);
      on.onSet((value) => this.pressButton(acc, on, value === true || value === 1));
    }
  }

  async pressButton(acc, characteristic, value) {
    if (!value) return;
    const template = acc.context.config.template;

    const reset = setTimeout(() => characteristic.updateValue(false), this.resetMs);
    if (reset.unref) reset.unref();

    try {
      const result = await this.client.applyTemplate(template);
      logger.info(
        `${template.isScenario ? 'Scenario' : 'Template'} "${template.name}" applied` +
          (result.mode === 'subtemplates' ? ` (${result.applied.length} templates one by one)` : ''),
        acc.displayName
      );
    } catch (err) {
      logger.warn(`Applying "${template.name}" failed (${err.code || err.message}).`, acc.displayName);
      logger.debug(err.message, acc.displayName);
      throw this.hapError();
    }
  }

  async setMode(acc, characteristic, value) {
    const cfg = acc.context.config;
    const previous = this.store.get(acc.UUID);
    const template = value ? cfg.on : cfg.off;

    try {
      const result = await this.client.applyTemplate(template);
      this.store.set(acc.UUID, value);
      logger.info(
        `${value ? 'ON' : 'OFF'}: "${template.name}" applied` +
          (result.mode === 'subtemplates' ? ` (${result.applied.length} templates one by one)` : ''),
        acc.displayName
      );
    } catch (err) {
      logger.warn(
        `${value ? 'ON' : 'OFF'}: applying "${template.name}" failed (${err.code || err.message}). Switch stays ${
          previous ? 'ON' : 'OFF'
        }.`,
        acc.displayName
      );
      logger.debug(err.message, acc.displayName);
      setImmediate(() => characteristic.updateValue(previous));
      throw this.hapError();
    }
  }
}

module.exports = { TemplateManager, StateStore, TYPE, SUBTYPE_BUTTON, SUBTYPE_MODE, STATE_FILE };
