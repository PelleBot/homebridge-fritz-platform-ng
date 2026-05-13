'use strict';

const logger = require('./utils/logger');
const { createPluginStorageDir, generateConfig } = require('./utils/utils');
const { version } = require('../package.json');

const Telegram = require('./lib/telegram');

// Accessories — DECT-only Minimal-Patch-Fork.
// Out-of-scope subsystems (callmonitor, presence, network, wol, childlock) are not
// wired in here. Their directories remain in src/accessories/ as dead code — they
// are intentionally not deleted because router/router.accessory.js still has a
// top-level require('../extras/extras.handler') that would fail at load time
// otherwise. The router/ module itself is REQUIRED for FritzBox initialization:
// RouterSetup creates the @seydx/fritzbox client that all smarthome accessories
// depend on via meshMaster.fritzbox.
//
// extras/extras.accessory.js IS wired in (case 'extra' below) because it handles
// the Router-Companion switches (wifi_guest, wps, dect, etc.) — the WiFi/WPS
// dispatch is routed via validOptionsSwitches to RouterHandler, not to the
// out-of-scope extras subsystems (DNS, phonebook, etc.).
const { RouterAccessory, RouterSetup } = require('./accessories/router/router');
const ExtrasAccessory = require('./accessories/extras/extras.accessory');
const {
  SHBlindAccessory,
  SHButtonAccessory,
  SHContactAccessory,
  SHEnergyMeterAccessory,
  SHEnergyTemperatureAccessory,
  SHHumidityAccessory,
  SHLightbulbAccessory,
  SHOutletAccessory,
  SHOutletLightbulbAccessory,
  SHSmokeAccessory,
  SHSwitchAccessory,
  SHSwitchLightbulbAccessory,
  SHTemperatureAccessory,
  SHThermostatAccessory,
  SHWindowAccessory,
  SHWindowSwitchAccessory,
  SHSetup,
} = require('./accessories/smarthome/smarthome');

//Custom Types
const CustomTypes = require('./types/custom.types');
const EveTypes = require('./types/eve.types');

const PLUGIN_NAME = 'homebridge-fritz-platform';
const PLATFORM_NAME = 'FritzPlatform';

var Accessory, HistoryService;

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  return FritzPlatform;
};

function FritzPlatform(log, config, api) {
  if (!api || !config) return;

  logger.configure(log, config);

  CustomTypes.registerWith(api.hap);
  EveTypes.registerWith(api.hap);

  // fakegato-history (Eve App graph storage) is not HAP-v2 compatible —
  // it uses ES5 function-inheritance that breaks against HAP-NodeJS v2's
  // ES6 Characteristic class. Rather than vendoring a patched fork, we
  // pass a no-op stub: DECT accessories call `new HistoryService(...)`
  // and `.addEntry()` on the result; both become no-ops.
  // Functional impact: Eve App will not show historical graphs for
  // thermostats, temperature, humidity, contact/window, outlet energy.
  // HomeKit core functionality (control, current state) is unaffected.
  HistoryService = function NoOpHistoryService() {};
  HistoryService.prototype.addEntry = function () {};
  HistoryService.prototype.cleanPersist = function () {};
  HistoryService.prototype.setExtraPersistedData = function () {};
  HistoryService.prototype.getExtraPersistedData = function () { return null; };

  this.api = api;
  this.log = log;
  this.accessories = [];
  this.config = generateConfig(config);

  this.devices = new Map();

  this.meshMaster = {
    configured: false,
    cityPrefix: this.config.callmonitor.cityPrefix || false,
    countryPrefix: this.config.callmonitor.countryPrefix || false,
    wifiUnits: 2,
    fritzbox: null,
  };

  this.polling = this.config.options.polling;

  if (this.config.telegram.active && this.config.telegram.token && this.config.telegram.chatID) {
    Telegram.configure(this.config.telegram, this.messages);
  }

  if (this.config.devices) {
    RouterSetup(this.devices, this.config.devices, this.config.extras, this.config.options, this.meshMaster);
  }

  if (!this.meshMaster.configured) {
    logger.warn('WARNING: There is no master router configured! Please check if "master" is enabled in config.');
    return;
  }

  if (this.config.smarthome) {
    SHSetup(this.devices, this.config.smarthome);
  }

  this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}

FritzPlatform.prototype = {
  didFinishLaunching: async function () {
    await createPluginStorageDir(`${this.api.user.storagePath()}/fritzbox`);

    //configure accessories
    for (const [uuid, device] of this.devices.entries()) {
      const cachedAccessory = this.accessories.find((curAcc) => curAcc.UUID === uuid);

      if (!cachedAccessory) {
        logger.info('Configuring new accessory...', device.name);

        const accessory = new Accessory(device.name, uuid);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
      } else {
        logger.info('Configuring cached accessory...', device.name);
      }
    }

    //remove unused accessories
    this.accessories.forEach((accessory) => {
      const device = this.devices.get(accessory.UUID);

      try {
        if (!device) {
          this.removeAccessory(accessory);
        }
      } catch (err) {
        logger.info('It looks like the accessory has already been removed. Skip removing.');
        logger.debug(err);
      }
    });

    //setup new accessories
    this.accessories.forEach((accessory) => {
      const device = this.devices.get(accessory.UUID);

      if (device) {
        logger.info('Setup accessory...', device.name);
        this.setupAccessory(accessory, device);
      }
    });
  },

  setupAccessoryInformation: function (accessory, device) {
    const manufacturer = device.manufacturer || this.meshMaster.manufacturer || 'Homebridge';
    const model = device.model || this.meshMaster.model || device.type || 'Model';
    const serialNumber = device.serialNumber || accessory.displayName || 'SerialNumber';

    const AccessoryInformation = accessory.getService(this.api.hap.Service.AccessoryInformation);

    AccessoryInformation.setCharacteristic(this.api.hap.Characteristic.Manufacturer, manufacturer);
    AccessoryInformation.setCharacteristic(this.api.hap.Characteristic.Model, model);
    AccessoryInformation.setCharacteristic(this.api.hap.Characteristic.SerialNumber, serialNumber);
    AccessoryInformation.setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, version);
  },

  setupAccessory: function (accessory, device) {
    this.setupAccessoryInformation(accessory, device);

    accessory.on('identify', () => logger.info('Identify requested.', `${accessory.displayName} (${device.subtype})`));

    accessory.context.config = device;
    accessory.context.config.polling = this.polling;

    switch (device.type) {
      case 'router':
        new RouterAccessory(this.api, accessory, this.accessories, this.meshMaster);
        break;
      case 'extra':
        new ExtrasAccessory(this.api, accessory, this.accessories, this.meshMaster);
        break;
      case 'smarthome':
        if (device.subtype === 'smarthome-switch' && device.energy)
          new SHOutletAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-switch' && !device.energy)
          new SHSwitchAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-humidity')
          new SHHumidityAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-temperature')
          new SHTemperatureAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-thermostat')
          new SHThermostatAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-blind')
          new SHBlindAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-button')
          new SHButtonAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-contact')
          new SHContactAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-window')
          new SHWindowAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-window-switch')
          new SHWindowSwitchAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-lightbulb')
            new SHLightbulbAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-smoke')
            new SHSmokeAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-switch-lightbulb' && device.energy)
          new SHOutletLightbulbAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-switch-lightbulb' && !device.energy)
          new SHSwitchLightbulbAccessory(this.api, accessory, this.accessories, this.meshMaster);
        else if (device.subtype === 'smarthome-energy-meter')
          new SHEnergyMeterAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        else if (device.subtype === 'smarthome-energy-temperature')
          new SHEnergyTemperatureAccessory(this.api, accessory, this.accessories, this.meshMaster, HistoryService);
        break;
      default:
        logger.warn(`Can not setup accessory, type (${device.type}) unknown!`, device.name);
        break;
    }
  },

  configureAccessory: function (accessory) {
    this.accessories.push(accessory);
  },

  removeAccessory: function (accessory) {
    logger.info('Removing accessory...', `${accessory.displayName} (${accessory.context.config.subtype})`);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

    this.accessories = this.accessories.filter(
      (cachedAccessory) => cachedAccessory.displayName !== accessory.displayName
    );
  },
};
