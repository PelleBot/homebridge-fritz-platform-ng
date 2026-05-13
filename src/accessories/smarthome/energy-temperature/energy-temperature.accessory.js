'use strict';

const logger = require('../../../utils/logger');
const Handler = require('../smarthome.handler');

/**
 * Energy-temperature accessory — exposes a single numeric energy value
 * (current power in W, or cumulative energy in kWh) as a TemperatureSensor.
 *
 * Designed for AVM Fritz!Smart Energy 250 in OBIS-reader mode (and similar
 * HAN-FUN energy sensors). The base AIN of such a device only acts as a
 * HAN-FUN gateway (functionbitmask=1, filtered out by @seydx/fritzbox); the
 * sub-AINs `<base>-1` and `<base>-2` carry the actual <powermeter> data.
 * Configure one smarthome[] entry per (sub-AIN x obisChannel) combination
 * you want exposed.
 *
 * The TemperatureSensor service is "abused" because HomeKit has no native
 * energy/power service. Apple Home then displays the tile with the raw
 * numeric value and graphs the history natively — no Eve-App dependency.
 *
 * Trade-off: the unit shown in HomeKit is "°C", which the user is expected
 * to mentally remap to W or kWh. Rename the tile in the Home App after
 * adding ("Aktueller Verbrauch", "Gesamt Einspeisung", …) to make it clear.
 *
 * Config:
 *   accType: "energy-temperature"
 *   ain: "<base-AIN>-1" (Bezug / OBIS 1.8) or "<base-AIN>-2" (Einspeisung / OBIS 2.8)
 *   obisChannel:
 *     "current_power" -> Math.abs(powermeter.power) in W  (default)
 *     "total_energy"  -> powermeter.energy in kWh
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
    let service = this.accessory.getService(this.api.hap.Service.TemperatureSensor);

    if (!service) {
      logger.info(
        'Adding TemperatureSensor service (energy-temperature, read-only)',
        `${this.accessory.displayName} (${this.accessory.context.config.subtype})`
      );
      service = this.accessory.addService(
        this.api.hap.Service.TemperatureSensor,
        this.accessory.displayName,
        this.accessory.context.config.subtype
      );
    }

    // Expand the value range so high kWh totals (multi-year cumulative) and
    // high-power moments (heat pumps, induction stoves) display without
    // clipping. Default HAP CurrentTemperature is 0..100 which is too narrow.
    service.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature).setProps({
      minValue: -100000,
      maxValue: 999999,
      minStep: 0.1,
    });
  }
}

module.exports = Accessory;
