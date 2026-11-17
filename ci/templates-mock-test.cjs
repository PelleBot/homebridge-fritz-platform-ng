'use strict';

// Mock test for FRITZ!Box templates and scenarios as HomeKit switches (v1.4.0).
// Runs without Homebridge and without a FRITZ!Box:
//   node ci/templates-mock-test.cjs
// Checks:
//   1. XML parsing: template, scenario with sub_templates, empty list, umlauts.
//   2. SID handling: cached SID, one re-login on 403, no loop on a second 403.
//   3. Scenario: applytemplate on the scenario; fallback to its sub-templates on 400/"inval".
//   4. Without the "templates" block nothing changes (no manager, no switches).
//   5. Buttons: created from include (name or identifier), UUID from the identifier,
//      display name override, missing entry → warning, switch resets after ~1 s.
//   6. Mode switch: applies on/off template, persists the state across a restart,
//      reverts and reports SERVICE_COMMUNICATION_FAILURE when applytemplate fails.
//   7. Refresh: template removed in the FRITZ!Box → switch removed; FRITZ!Box
//      unreachable → switches stay.
//   8. Cached template switches are removed when the feature is switched off.
//   9. No session ID in the log (debug on).

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { parseTemplateList } = require('../src/accessories/templates/templates.parser');
const { AhaTemplateClient } = require('../src/accessories/templates/templates.client');

// ---------------------------------------------------------------- fixtures
// Structure as returned by FRITZ!OS 8 (FRITZ!Box 6690 Cable), identifiers synthetic.
const ID = {
  urlaub: 'tmpAAAAAA-000000001',
  zuhause: 'tmpAAAAAA-000000002',
  bad: 'tmpAAAAAA-000000003',
  buero: 'tmpAAAAAA-000000004',
  auto: 'tmpAAAAAA-000000005',
};

const tpl = (id, num, name, { mask = '<hkr_time_table/>', bits = 16, subs = [], autocreate = 0, meta = '' } = {}) => `
  <template identifier="${id}" id="${num}" functionbitmask="4160" autocreate="${autocreate}" applymask="${bits}">
    <name>${name}</name>
    <metadata>${meta}</metadata>
    <devices>${
      subs.length ? '' : '<device identifier="grpAAAAAA-111111111"/><device identifier="09995 0000001"/>'
    }</devices>
    <triggers/>
    <sub_templates>${subs.map((s) => `<template identifier="${s}"/>`).join('')}</sub_templates>
    <applymask>${mask}</applymask>
  </template>`;

const xmlList = (parts) => `<?xml version="1.0"?>\n<templatelist version="1">${parts.join('')}</templatelist>`;

const FULL = xmlList([
  tpl(ID.urlaub, 60100, 'Urlaub'),
  tpl(ID.zuhause, 60235, 'Zuhause', {
    mask: '<sub_templates/>',
    bits: 2048,
    subs: [ID.bad, ID.buero],
    meta: '{"type":"generic","icon":3}',
  }),
  tpl(ID.bad, 60163, 'Zuhause B&#xE4;der'),
  tpl(ID.buero, 60119, 'Zuhause B&#xFC;ros'),
  tpl(ID.auto, 60300, 'Auto-Vorlage', { autocreate: 1 }),
]);

const WITHOUT_ZUHAUSE = xmlList([tpl(ID.urlaub, 60100, 'Urlaub'), tpl(ID.bad, 60163, 'Zuhause B&#xE4;der')]);

const SID1 = 'a1b2c3d4e5f60718';
const SID2 = 'f0e1d2c3b4a59687';

// ---------------------------------------------------------------- fake FRITZ!Box
function makeBox() {
  const box = {
    sids: [SID1, SID2, 'c0ffee0000000001', 'c0ffee0000000002'],
    exec: 0,
    calls: [],
    list: FULL,
    reachable: true,
    validSids: new Set(),
    failApply: new Set(), // identifiers answered with 500
    rejectScenario: false, // answer 400 for scenarios
    inval: new Set(),
  };
  box.fritzbox = {
    url: { hostname: 'fritz.test' },
    exec: async () => {
      if (!box.reachable) {
        const e = new Error('connect ECONNREFUSED');
        e.code = 'ECONNREFUSED';
        throw e;
      }
      const sid = box.sids[box.exec++];
      box.validSids.add(sid);
      return { 'NewX_AVM-DE_UrlSID': `sid=${sid}` };
    },
  };
  const httpError = (code) => Object.assign(new Error(`${code} - ${code}`), { code, title: 'Invalid Response' });
  box.request = async (host, cmd) => {
    box.calls.push({ ...cmd });
    if (!box.reachable) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    if (!box.validSids.has(cmd.sid)) throw httpError(403);
    if (cmd.switchcmd === 'gettemplatelistinfos') return box.list;
    if (cmd.switchcmd === 'applytemplate') {
      if (box.failApply.has(cmd.ain)) throw httpError(500);
      if (box.inval.has(cmd.ain)) return 'inval\n';
      if (box.rejectScenario && cmd.ain === ID.zuhause) throw httpError(400);
      return '60100\n';
    }
    throw httpError(400);
  };
  return box;
}

// ---------------------------------------------------------------- HAP mock
class Characteristic {
  constructor(name) {
    this.name = name;
    this.value = name === 'On' ? false : 0;
    this.getHandler = null;
    this.setHandler = null;
  }
  on() {
    return this;
  }
  onGet(fn) {
    this.getHandler = fn;
    return this;
  }
  onSet(fn) {
    this.setHandler = fn;
    return this;
  }
  updateValue(v) {
    this.value = v;
    return this;
  }
  setValue(v) {
    return this.updateValue(v);
  }
  // emulates HAP-NodeJS: value is taken over only if the set handler succeeds
  async homekitSet(v) {
    await this.setHandler(v);
    this.value = v;
  }
}

const charClass = (name) => {
  const C = function () {};
  C.charName = name;
  return C;
};
class HapCharacteristicBase {
  setProps() {
    return this;
  }
  getDefaultValue() {
    return 0;
  }
}
const CharacteristicTypes = new Proxy(HapCharacteristicBase, {
  get: (t, k) => {
    if (k in t || typeof k === 'symbol') return t[k];
    t[k] = charClass(String(k));
    return t[k];
  },
});

class Service {
  constructor(name, subtype) {
    this.displayName = name;
    this.subtype = subtype;
    this.chars = new Map();
  }
  getCharacteristic(C) {
    const key = C.charName || C.name;
    if (!this.chars.has(key)) this.chars.set(key, new Characteristic(key));
    return this.chars.get(key);
  }
  testCharacteristic(C) {
    return this.chars.has(C.charName || C.name);
  }
  addCharacteristic(C) {
    return this.getCharacteristic(C);
  }
  setCharacteristic(C, v) {
    this.getCharacteristic(C).updateValue(v);
    return this;
  }
}
const serviceClass = (name) => {
  const S = class extends Service {};
  Object.defineProperty(S, 'name', { value: name });
  return S;
};
const ServiceTypes = new Proxy(
  {},
  {
    get: (t, k) => {
      if (!t[k]) t[k] = serviceClass(String(k));
      return t[k];
    },
  }
);

class MockAccessory {
  constructor(name, uuid) {
    this.displayName = name;
    this.UUID = uuid;
    this.context = {};
    this.services = [new ServiceTypes.AccessoryInformation(name)];
  }
  getService(S) {
    return this.services.find((s) => s instanceof S);
  }
  addService(S, name, subtype) {
    const s = new S(name, subtype);
    this.services.push(s);
    return s;
  }
  removeService(s) {
    this.services = this.services.filter((x) => x !== s);
  }
  on() {}
}

class HapStatusError extends Error {
  constructor(status) {
    super(`HAP status ${status}`);
    this.hapStatus = status;
  }
}

// ---------------------------------------------------------------- helpers
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fritz-templates-'));
const logLines = [];
const allLogLines = [];
const capture =
  (level) =>
  (...args) => {
    const line = `${level} ${args.map(String).join(' ')}`;
    logLines.push(line);
    allLogLines.push(line);
  };
const log = Object.assign(capture('log'), {
  info: capture('info'),
  warn: capture('warn'),
  error: capture('error'),
  debug: capture('debug'),
  success: capture('success'),
});

function makeApi(persistDir) {
  const handlers = {};
  return {
    hap: {
      Service: ServiceTypes,
      Characteristic: CharacteristicTypes,
      uuid: { generate: (s) => 'uuid-' + s },
      HapStatusError,
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      Formats: {},
      Perms: {},
      Units: {},
    },
    user: { storagePath: () => persistDir, persistPath: () => persistDir },
    registered: [],
    unregistered: [],
    on: (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn),
    emit: async (ev) => {
      for (const fn of handlers[ev] || []) await fn();
    },
    registerPlatformAccessories(plugin, platform, accs) {
      this.registered.push(...accs);
    },
    unregisterPlatformAccessories(plugin, platform, accs) {
      this.unregistered.push(...accs);
    },
  };
}

const routerDevice = { name: 'Box', active: true, master: true, hide: true, host: '127.0.0.1' };
const FritzPlatform = require('../src/platform.js')({ platformAccessory: MockAccessory });

// Builds a platform, swaps in the fake FRITZ!Box client and runs didFinishLaunching.
async function launch({ templates, box, persistDir, cached = [] }) {
  const api = makeApi(persistDir);
  const config = { debug: true, devices: [routerDevice] };
  if (templates !== undefined) config.templates = templates;
  const p = new FritzPlatform(log, config, api);
  cached.forEach((acc) => p.configureAccessory(acc));
  if (p.templateManager) {
    p.templateManager.resetMs = 30;
    p.templateManager.client = new AhaTemplateClient({ fritzbox: box.fritzbox, request: box.request });
  }
  await api.emit('didFinishLaunching');
  // didFinishLaunching starts the manager without awaiting it
  await new Promise((r) => setTimeout(r, 20));
  return { p, api };
}

const switchOf = (acc) => acc.getService(ServiceTypes.Switch).getCharacteristic(CharacteristicTypes.On);
const templateAccs = (p) => p.accessories.filter((a) => a.context.config && a.context.config.type === 'template');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. parser ---------------------------------------------------------------
  {
    const list = await parseTemplateList(FULL);
    assert.strictEqual(list.length, 5);
    const urlaub = list.find((t) => t.identifier === ID.urlaub);
    assert.strictEqual(urlaub.name, 'Urlaub');
    assert.strictEqual(urlaub.isScenario, false);
    assert.deepStrictEqual(urlaub.applymask, ['hkr_time_table']);
    assert.deepStrictEqual(urlaub.devices, ['grpAAAAAA-111111111', '09995 0000001']);
    const zuhause = list.find((t) => t.identifier === ID.zuhause);
    assert.strictEqual(zuhause.isScenario, true);
    assert.deepStrictEqual(zuhause.subTemplates, [ID.bad, ID.buero]);
    assert.deepStrictEqual(zuhause.metadata, { type: 'generic', icon: 3 });
    assert.strictEqual(list.find((t) => t.identifier === ID.bad).name, 'Zuhause Bäder');
    assert.strictEqual(list.find((t) => t.identifier === ID.auto).autocreate, true);
    assert.deepStrictEqual(await parseTemplateList('<templatelist version="1"/>'), []);
    assert.deepStrictEqual(await parseTemplateList('<templatelist version="1"></templatelist>'), []);
    await assert.rejects(parseTemplateList(''));
    await assert.rejects(parseTemplateList('<devicelist/>'));
    console.log('✓ parser: template, scenario with sub_templates, empty list, umlauts');
  }

  // 2. SID handling ---------------------------------------------------------
  {
    const box = makeBox();
    const client = new AhaTemplateClient({ fritzbox: box.fritzbox, request: box.request });
    await client.getTemplates();
    await client.getTemplates();
    assert.strictEqual(box.exec, 1, 'SID is cached');

    box.validSids.clear(); // session expired
    const list = await client.getTemplates();
    assert.strictEqual(list.length, 5);
    assert.strictEqual(box.exec, 2, 'exactly one re-login');
    assert.strictEqual(box.calls.length, 4, 'expired request repeated once');

    // user without Smart Home right: every SID is refused
    const denied = makeBox();
    denied.fritzbox.exec = async () => ({ 'NewX_AVM-DE_UrlSID': `sid=${denied.sids[denied.exec++]}` });
    const c2 = new AhaTemplateClient({ fritzbox: denied.fritzbox, request: denied.request });
    await assert.rejects(c2.getTemplates(), (err) => err.code === 403 && /Smart Home/.test(err.message));
    assert.strictEqual(denied.calls.length, 2, 'no loop: two requests in total');
    assert.strictEqual(denied.exec, 2);

    // FRITZ!Box answers with the "no session" SID
    const zero = makeBox();
    zero.fritzbox.exec = async () => ({ 'NewX_AVM-DE_UrlSID': 'sid=0000000000000000' });
    const c3 = new AhaTemplateClient({ fritzbox: zero.fritzbox, request: zero.request });
    await assert.rejects(c3.getTemplates(), (err) => err.code === 'NO_SID');
    console.log('✓ SID: cached, one re-login on 403, no loop, no-session SID rejected');
  }

  // 3. scenario fallback ----------------------------------------------------
  {
    const box = makeBox();
    const client = new AhaTemplateClient({ fritzbox: box.fritzbox, request: box.request });
    const list = await client.getTemplates();
    const zuhause = list.find((t) => t.identifier === ID.zuhause);

    let r = await client.applyTemplate(zuhause);
    assert.strictEqual(r.mode, 'direct');
    assert.deepStrictEqual(
      box.calls.filter((c) => c.switchcmd === 'applytemplate').map((c) => c.ain),
      [ID.zuhause]
    );

    box.calls = [];
    box.rejectScenario = true;
    r = await client.applyTemplate(zuhause);
    assert.strictEqual(r.mode, 'subtemplates');
    assert.deepStrictEqual(
      box.calls.map((c) => c.ain),
      [ID.zuhause, ID.bad, ID.buero],
      'sub-templates applied in order'
    );

    box.calls = [];
    box.rejectScenario = false;
    box.inval.add(ID.zuhause);
    r = await client.applyTemplate(zuhause);
    assert.strictEqual(r.mode, 'subtemplates', '"inval" also triggers the fallback');

    // a normal template is not "fallen back"
    box.inval.add(ID.urlaub);
    await assert.rejects(client.applyTemplate(list.find((t) => t.identifier === ID.urlaub)), (e) => e.code === 'INVAL');

    // timeout
    const slow = new AhaTemplateClient({
      fritzbox: box.fritzbox,
      request: () => new Promise(() => {}),
      timeoutMs: 50,
    });
    await assert.rejects(slow.applyTemplate(zuhause), (e) => e.code === 'TEMPLATE_TIMEOUT');
    console.log('✓ scenario: direct apply, fallback to sub-templates on 400/"inval", timeout');
  }

  // 4. feature off -----------------------------------------------------------
  {
    const box = makeBox();
    const { p, api } = await launch({ box, persistDir: fs.mkdtempSync(path.join(tmpRoot, 'off-')) });
    assert.strictEqual(p.templateManager, undefined);
    assert.strictEqual(p.config.templates.enabled, false);
    assert.strictEqual(api.registered.length, 0);
    assert.strictEqual(box.calls.length, 0, 'no AHA call without the templates block');

    const { p: p2 } = await launch({
      templates: { enabled: false, include: ['Urlaub'] },
      box,
      persistDir: fs.mkdtempSync(path.join(tmpRoot, 'off-')),
    });
    assert.strictEqual(p2.templateManager, undefined);
    console.log('✓ without "templates" (or enabled: false) the plugin behaves as before');
  }

  // 5. buttons ----------------------------------------------------------------
  const persistDir = fs.mkdtempSync(path.join(tmpRoot, 'on-'));
  {
    const box = makeBox();
    logLines.length = 0;
    const { p, api } = await launch({
      templates: {
        enabled: true,
        include: ['Urlaub', ID.zuhause, 'Gibt es nicht'],
        names: [{ template: 'Urlaub', name: 'Heizung Urlaub' }],
      },
      box,
      persistDir,
    });
    const accs = templateAccs(p);
    assert.strictEqual(accs.length, 2);
    assert.strictEqual(api.registered.length, 2);
    const urlaub = accs.find((a) => a.UUID === `uuid-fritz-template:${ID.urlaub}`);
    const zuhause = accs.find((a) => a.UUID === `uuid-fritz-template:${ID.zuhause}`);
    assert.ok(urlaub && zuhause, 'UUID derived from the template identifier');
    assert.strictEqual(urlaub.displayName, 'Heizung Urlaub', 'display name override');
    assert.strictEqual(zuhause.displayName, 'Zuhause');
    assert.ok(logLines.some((l) => l.startsWith('warn') && l.includes('"Gibt es nicht" does not exist')));

    const on = switchOf(urlaub);
    await on.homekitSet(true);
    assert.strictEqual(on.value, true);
    assert.deepStrictEqual(
      box.calls.filter((c) => c.switchcmd === 'applytemplate').map((c) => c.ain),
      [ID.urlaub]
    );
    await sleep(60);
    assert.strictEqual(on.value, false, 'button switches itself off');
    assert.strictEqual(on.getHandler(), false);

    // failing apply → HomeKit error, value unchanged
    box.failApply.add(ID.urlaub);
    await assert.rejects(on.homekitSet(true), (e) => e.hapStatus === -70402);
    await sleep(60);
    assert.strictEqual(on.value, false);

    // exposeAll hides auto-created templates without sub_templates
    const { p: all } = await launch({
      templates: { enabled: true, exposeAll: true },
      box: makeBox(),
      persistDir: fs.mkdtempSync(path.join(tmpRoot, 'all-')),
    });
    assert.deepStrictEqual(
      templateAccs(all)
        .map((a) => a.displayName)
        .sort(),
      ['Urlaub', 'Zuhause', 'Zuhause Bäder', 'Zuhause Büros']
    );
    p.templateManager.stop();
    all.templateManager.stop();
    console.log('✓ buttons: include by name/identifier, stable UUID, rename, warning, auto-off, error');
  }

  // 6. mode switch ------------------------------------------------------------
  {
    const box = makeBox();
    const templates = { enabled: true, modeSwitch: { enabled: true } };
    const { p } = await launch({ templates, box, persistDir });
    const mode = templateAccs(p).find((a) => a.context.config.subtype === 'template-mode');
    assert.ok(mode, 'mode switch created');
    assert.strictEqual(mode.displayName, 'Urlaubsmodus');
    const on = switchOf(mode);
    assert.strictEqual(on.getHandler(), false, 'default Off');

    await on.homekitSet(true);
    assert.deepStrictEqual(
      box.calls.filter((c) => c.switchcmd === 'applytemplate').map((c) => c.ain),
      [ID.urlaub]
    );
    const file = path.join(persistDir, 'homebridge-fritz-platform-hb2.templates.json');
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).mode[mode.UUID], true, 'state persisted');
    p.templateManager.stop();

    // restart: state restored from persistPath, cached accessory reused
    const box2 = makeBox();
    const cached = new MockAccessory(mode.displayName, mode.UUID);
    cached.context = JSON.parse(JSON.stringify(mode.context));
    const { p: p2, api: api2 } = await launch({ templates, box: box2, persistDir, cached: [cached] });
    assert.strictEqual(api2.registered.length, 0, 'cached accessory reused');
    const on2 = switchOf(cached);
    assert.strictEqual(on2.value, true);
    assert.strictEqual(on2.getHandler(), true, 'state restored after restart');
    assert.strictEqual(box2.calls.filter((c) => c.switchcmd === 'applytemplate').length, 0, 'nothing applied at start');

    // Off fails → stays On, HomeKit error, persisted state unchanged
    box2.failApply.add(ID.zuhause);
    box2.rejectScenario = false;
    await assert.rejects(on2.homekitSet(false), (e) => e.hapStatus === -70402);
    await sleep(5);
    assert.strictEqual(on2.value, true, 'reverted to previous state');
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).mode[cached.UUID], true);

    // Off works → scenario applied
    box2.failApply.clear();
    await on2.homekitSet(false);
    assert.strictEqual(on2.getHandler(), false);
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).mode[cached.UUID], false);
    p2.templateManager.stop();

    // missing off template → no mode switch, warning
    logLines.length = 0;
    const { p: p3 } = await launch({
      templates: { enabled: true, modeSwitch: { enabled: true, offTemplate: 'Weg' } },
      box: makeBox(),
      persistDir: fs.mkdtempSync(path.join(tmpRoot, 'miss-')),
    });
    assert.strictEqual(templateAccs(p3).length, 0);
    assert.ok(logLines.some((l) => l.includes('"Weg" does not exist')));
    p3.templateManager.stop();
    console.log('✓ mode switch: on/off templates, persisted, restored, reverted on error, missing template');
  }

  // 7. refresh ----------------------------------------------------------------
  {
    const box = makeBox();
    const { p, api } = await launch({
      templates: { enabled: true, include: ['Urlaub', 'Zuhause'] },
      box,
      persistDir: fs.mkdtempSync(path.join(tmpRoot, 'refresh-')),
    });
    assert.strictEqual(templateAccs(p).length, 2);

    box.reachable = false;
    assert.strictEqual(await p.templateManager.sync(), false);
    assert.strictEqual(templateAccs(p).length, 2, 'unreachable FRITZ!Box: switches stay');

    box.reachable = true;
    box.list = WITHOUT_ZUHAUSE;
    assert.strictEqual(await p.templateManager.sync(), true);
    assert.deepStrictEqual(
      templateAccs(p).map((a) => a.displayName),
      ['Urlaub']
    );
    assert.strictEqual(api.unregistered.length, 1, 'orphan unregistered');
    p.templateManager.stop();
    console.log('✓ refresh: orphan removed after successful read, kept while unreachable');
  }

  // 8. feature switched off with cached switches ------------------------------
  {
    const cached = new MockAccessory('Urlaub', `uuid-fritz-template:${ID.urlaub}`);
    cached.context.config = { type: 'template', subtype: 'template-button', name: 'Urlaub' };
    const { p, api } = await launch({
      box: makeBox(),
      persistDir: fs.mkdtempSync(path.join(tmpRoot, 'gone-')),
      cached: [cached],
    });
    assert.strictEqual(api.unregistered.length, 1);
    assert.strictEqual(templateAccs(p).length, 0);
    console.log('✓ cached template switches are removed when the feature is off');
  }

  // 9. no SID in the log --------------------------------------------------------
  {
    assert.ok(
      allLogLines.some((l) => l.includes('[DEBUG]')),
      'debug output was produced'
    );
    const leaked = allLogLines.filter((l) => [SID1, SID2, 'c0ffee'].some((s) => l.includes(s)));
    assert.deepStrictEqual(leaked, [], 'session IDs must not appear in the log');
    console.log('✓ no session ID in the log');
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('\nAll template tests passed.');
  process.exit(0);
})().catch((err) => {
  console.error('FAIL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
