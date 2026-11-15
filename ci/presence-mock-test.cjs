'use strict';

// Mock test for the opt-in presence feature (v1.3.0).
// Runs without Homebridge and without a FRITZ!Box:
//   node ci/presence-mock-test.cjs
// Checks:
//   1. Presence stays off by default (no presence accessories without config).
//   2. Active presence entries + "Anyone" + "Guest" are registered.
//   3. Occupancy/motion services are created.
//   4. Leave delay (offDelay) suppresses short WLAN drop-outs, then switches.
//   5. Lower-case MAC in config matches the upper-case FRITZ!Box host list.
//   6. "Anyone" aggregates, "Guest" follows GetTotalAssociations.
//   7. Motion change handler does not throw with the fakegato no-op stub.

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- HAP mock
class Characteristic {
  constructor(name) {
    this.name = name;
    this.value = name === 'MotionDetected' ? false : 0;
    this.listeners = [];
  }
  on(event, fn) {
    if (event === 'change') this.listeners.push(fn);
    return this;
  }
  onGet() {
    return this;
  }
  onSet() {
    return this;
  }
  updateValue(v) {
    const oldValue = this.value;
    this.value = v;
    if (oldValue !== v) this.listeners.forEach((fn) => fn({ oldValue, newValue: v }));
    return this;
  }
  setValue(v) {
    return this.updateValue(v);
  }
}

const charClass = (name) => {
  const C = function () {};
  C.charName = name;
  return C;
};

// Base class must be extendable: src/types/*.types.js declare ES6 subclasses
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

// ---------------------------------------------------------------- helpers
const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'fritz-presence-'));
const silentLog = Object.assign(() => {}, { info() {}, warn() {}, error() {}, debug() {}, success() {} });

function makeApi() {
  const handlers = {};
  return {
    hap: {
      Service: ServiceTypes,
      Characteristic: CharacteristicTypes,
      uuid: { generate: (s) => 'uuid-' + s },
      Formats: {},
      Perms: {},
      Units: {},
    },
    user: { storagePath: () => storage },
    registered: [],
    on: (ev, fn) => (handlers[ev] = fn),
    emit: (ev) => handlers[ev] && handlers[ev](),
    registerPlatformAccessories(plugin, platform, accs) {
      this.registered.push(...accs);
    },
    unregisterPlatformAccessories() {},
  };
}

const routerDevice = { name: 'Box', active: true, master: true, hide: true, host: '127.0.0.1' };

const loadPlatform = () => require('../src/platform.js')({ platformAccessory: MockAccessory });

let now = 1_700_000_000_000;
const realNow = Date.now;
Date.now = () => now;
const advance = (sec) => (now += sec * 1000);

const stateOf = (acc) => {
  const occ = acc.getService(ServiceTypes.OccupancySensor);
  if (occ) return occ.getCharacteristic(CharacteristicTypes.OccupancyDetected).value;
  return acc.getService(ServiceTypes.MotionSensor).getCharacteristic(CharacteristicTypes.MotionDetected).value;
};

(async () => {
  const FritzPlatform = loadPlatform();

  // 1. default off
  {
    const api = makeApi();
    const p = new FritzPlatform(silentLog, { platform: 'FritzPlatform', devices: [routerDevice] }, api);
    const presence = [...p.devices.values()].filter((d) => d.type === 'presence');
    assert.strictEqual(presence.length, 0, 'presence must be off by default');
    console.log('✓ presence off by default');
  }

  // inactive entry stays off
  {
    const api = makeApi();
    const p = new FritzPlatform(
      silentLog,
      { devices: [routerDevice], presence: [{ name: 'Phone', address: '192.168.178.20' }] },
      api
    );
    assert.strictEqual([...p.devices.values()].filter((d) => d.type === 'presence').length, 0);
    console.log('✓ presence entry without active:true is ignored');
  }

  // 2./3. full opt-in config
  const api = makeApi();
  const config = {
    devices: [routerDevice],
    presence: [
      { active: true, name: 'Andreas iPhone', address: 'aa:bb:cc:dd:ee:01', accType: 'occupancy' },
      { active: true, name: 'Jutta iPhone', address: '192.168.178.21', accType: 'motion', offDelay: 120 },
    ],
    options: { presence: { anyone: true, guest: true, accType: 'occupancy' } },
  };
  const p = new FritzPlatform(silentLog, config, api);
  const presenceDevices = [...p.devices.values()].filter((d) => d.type === 'presence');
  assert.deepStrictEqual(presenceDevices.map((d) => d.name).sort(), [
    'Andreas iPhone',
    'Anyone',
    'Guest',
    'Jutta iPhone',
  ]);
  const andreasCfg = presenceDevices.find((d) => d.name === 'Andreas iPhone');
  assert.strictEqual(andreasCfg.address, 'AA:BB:CC:DD:EE:01', 'MAC normalised to upper case');
  assert.strictEqual(andreasCfg.offDelay, 300, 'default offDelay 300s');
  assert.strictEqual(presenceDevices.find((d) => d.name === 'Jutta iPhone').offDelay, 120);
  console.log('✓ active entries + Anyone + Guest registered, MAC normalised, offDelay default 300s');

  // fake FRITZ!Box (TR-064)
  let hosts = [{ mac: 'AA:BB:CC:DD:EE:01', ip: '192.168.178.20', active: true, name: 'iphone' }];
  let guestAssociations = '0';
  p.meshMaster.fritzbox = {
    getAllHostsV2: async () => hosts.map((h) => ({ ...h })),
    exec: async (service, action) => {
      if (action === 'GetTotalAssociations') return { NewTotalAssociations: guestAssociations };
      const err = new Error('NoSuchEntryInArray');
      err.soap = { errorDescription: 'NoSuchEntryInArray' };
      throw err;
    },
  };

  api.emit('didFinishLaunching');
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setTimeout(r, 300)); // motion accessory waits 250ms

  const acc = (name) => p.accessories.find((a) => a.displayName === name);
  assert.ok(acc('Andreas iPhone').getService(ServiceTypes.OccupancySensor), 'occupancy service');
  assert.ok(acc('Jutta iPhone').getService(ServiceTypes.MotionSensor), 'motion service');
  assert.ok(acc('Anyone').getService(ServiceTypes.OccupancySensor), 'anyone service');
  assert.ok(acc('Guest').getService(ServiceTypes.OccupancySensor), 'guest service');
  console.log('✓ occupancy/motion services created');

  const Handler = require('../src/accessories/presence/presence.handler');
  const GuestHandler = require('../src/accessories/presence/presence_guest.handler');
  const poll = async () => {
    Handler.hosts = await p.meshMaster.fritzbox.getAllHostsV2();
    for (const name of ['Andreas iPhone', 'Jutta iPhone']) await Handler.get(acc(name));
    await Handler.get(acc('Anyone'));
  };

  // 4./5. arrival (lower-case MAC in config matched), then delay on leave
  await poll(); // change noticed
  advance(15);
  await poll(); // onDelay 0 passed
  assert.strictEqual(stateOf(acc('Andreas iPhone')), 1, 'arrived (MAC match case-insensitive)');
  assert.strictEqual(stateOf(acc('Anyone')), 1, 'anyone detected');
  console.log('✓ arrival detected via lower-case MAC config');

  hosts[0].active = false; // iPhone sleeps, drops off WLAN
  await poll();
  advance(120);
  await poll();
  assert.strictEqual(stateOf(acc('Andreas iPhone')), 1, 'still home after 120s (offDelay 300)');
  hosts[0].active = true; // back after ~2 min
  advance(15);
  await poll();
  assert.strictEqual(stateOf(acc('Andreas iPhone')), 1, 'no flap');
  console.log('✓ short WLAN drop-out (2 min) does not flip the sensor');

  hosts[0].active = false; // really leaves
  await poll();
  advance(200);
  await poll();
  assert.strictEqual(stateOf(acc('Andreas iPhone')), 1, 'still home before offDelay');
  advance(120);
  await poll();
  assert.strictEqual(stateOf(acc('Andreas iPhone')), 0, 'away after offDelay');
  assert.strictEqual(stateOf(acc('Anyone')), 0, 'anyone not detected');
  console.log('✓ leave reported after offDelay (300s)');

  // 7. motion sensor (via IP, host not in list -> manual lookup fails -> inactive)
  hosts.push({ mac: 'AA:BB:CC:DD:EE:02', ip: '192.168.178.21', active: true, name: 'iphone2' });
  await poll();
  advance(15);
  await poll();
  assert.strictEqual(stateOf(acc('Jutta iPhone')), true, 'motion detected (IP match)');
  assert.strictEqual(stateOf(acc('Anyone')), 1);
  console.log('✓ motion type via IP works, change handler survives fakegato stub');

  // 6. guest
  guestAssociations = '2';
  await GuestHandler.get(acc('Guest'));
  assert.strictEqual(stateOf(acc('Guest')), 1);
  guestAssociations = '0';
  await GuestHandler.get(acc('Guest'));
  assert.strictEqual(stateOf(acc('Guest')), 0);
  console.log('✓ guest sensor follows guest WLAN associations');

  Date.now = realNow;
  fs.rmSync(storage, { recursive: true, force: true });
  console.log('✓ presence mock test passed');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
