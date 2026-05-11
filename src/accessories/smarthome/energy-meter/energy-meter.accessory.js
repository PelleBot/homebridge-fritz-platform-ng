'use strict';

const logger = require('../../../utils/logger');
const Handler = require('../smarthome.handler');

/**
 * Energy-meter accessory (HB 2.0 minimal-patch fork addition).
 *
 * Designed for AVM Fritz!Smart Energy 250 in OBIS-reader mode (and similar
 * HAN-FUN energy sensors). The base AIN of such a device only acts as a
 * HAN-FUN gateway (functionbitmask=1, filtered out by @seydx/fritzbox); the
 * sub-AINs `<base>-1` and `<base>-2` carry the actual <powermeter> data —
 * `-1` typically OBIS 1.8 (consumption / Bezug), `-2` OBIS 2.8 (feed-in /
 * Einspeisung). Configure one smarthome[] entry per sub-AIN you want
 * exposed; the AIN string passes through unchanged including the `-N` suffix.
 *
 * HomeKit representation: Outlet service used as a read-only display surface.
 * The On characteristic is locked-true (any set attempt reverts after 1s),
 * because there is no relay to switch. Live power lands in Eve's
 * CurrentConsumption (W), cumulative energy in TotalConsumption (kWh).
 */
class Accessory {
  constructor(api, accessory, accessories, meshMaster, HistoryService) {
    this.api = api;
    this.accessory = accessory;
    this.HistoryService = HistoryService;

    this.handler = Handler.configure(api, accessories, accessory.context.config.polling, meshMaster);
    this.getService();
  }

  async getService() {
    let service = this.accessory.getService(this.api.hap.Service.Outlet);

    if (!service) {
      logger.info(
        'Adding Outlet service (energy-meter, read-only)',
        `${this.accessory.displayName} (${this.accessory.context.config.subtype})`
      );
      service = this.accessory.addService(
        this.api.hap.Service.Outlet,
        this.accessory.displayName,
        this.accessory.context.config.subtype
      );
    }

    if (!service.testCharacteristic(this.api.hap.Characteristic.CurrentConsumption)) {
      service.addCharacteristic(this.api.hap.Characteristic.CurrentConsumption);
    }
    if (!service.testCharacteristic(this.api.hap.Characteristic.TotalConsumption)) {
      service.addCharacteristic(this.api.hap.Characteristic.TotalConsumption);
    }

    // Lock the On characteristic to true — meter is not switchable
    service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(true);
    service.getCharacteristic(this.api.hap.Characteristic.On).onSet((state) => {
      logger.info(
        'Toggling not allowed for energy-meter (read-only sensor)',
        `${this.accessory.displayName} (${this.accessory.context.config.subtype})`
      );
      setTimeout(
        () => service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(true),
        1000
      );
    });

    // OutletInUse always true so the tile renders as active in HomeKit
    if (!service.testCharacteristic(this.api.hap.Characteristic.OutletInUse)) {
      service.addCharacteristic(this.api.hap.Characteristic.OutletInUse);
    }
    service.getCharacteristic(this.api.hap.Characteristic.OutletInUse).updateValue(true);
  }
}

module.exports = Accessory;
