'use strict';

const logger = require('../../../utils/logger');
const Handler = require('../smarthome.handler');

/**
 * Energy-light accessory — same data flow as energy-temperature, but exposes
 * the value as a LightSensor service (CurrentAmbientLightLevel in lx) instead
 * of a TemperatureSensor.
 *
 * Why two service types for the same data? Apple Home renders sensor types
 * differently:
 *   - TemperatureSensor:  prominent tile in room view, °C unit, history graph
 *   - LightSensor:        passive sensor (status bar), lx unit, can be made
 *                         favorite to get a dedicated tile
 *
 * For users who don't want the °C-mislabeling of energy values, this accType
 * uses LightSensor as a more abstract numeric display vehicle. The lx-unit
 * is also incorrect for energy but psychologically less confusing than °C
 * because it is uncommon to interpret it.
 *
 * Designed for AVM Fritz!Smart Energy 250 in OBIS-reader mode — see
 * energy-temperature.accessory.js for full data-flow rationale; this file
 * is a near-clone with the service swapped.
 *
 * Config:
 *   accType: "energy-light"
 *   ain: "<base-AIN>-1" (Bezug / OBIS 1.8) or "<base-AIN>-2" (Einspeisung / OBIS 2.8)
 *   obisChannel:
 *     "current_power" -> Math.abs(powermeter.power) in W  (default)
 *     "total_energy"  -> powermeter.energy in kWh
 *
 * AmbientLightLevel value semantics:
 *   - lx range: 0.0001 (HAP minimum) up to 100000 by default — we override to
 *     999999 max so multi-year kWh totals fit. minValue stays at 0.0001 (HAP
 *     does not allow 0); a value of 0 in the handler maps to 0.0001 at the
 *     characteristic level to satisfy validation.
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
    // Remove any leftover TemperatureSensor service from a previous accType
    // configuration (e.g. user switched from energy-temperature to energy-light).
    const oldTemp = this.accessory.getService(this.api.hap.Service.TemperatureSensor);
    if (oldTemp) {
      logger.info(
        'Removing legacy TemperatureSensor service (accType switched to energy-light)',
        `${this.accessory.displayName} (${this.accessory.context.config.subtype})`
      );
      this.accessory.removeService(oldTemp);
    }

    let service = this.accessory.getService(this.api.hap.Service.LightSensor);

    if (!service) {
      logger.info(
        'Adding LightSensor service (energy-light, read-only)',
        `${this.accessory.displayName} (${this.accessory.context.config.subtype})`
      );
      service = this.accessory.addService(
        this.api.hap.Service.LightSensor,
        this.accessory.displayName,
        this.accessory.context.config.subtype
      );
    }

    // Expand the upper bound so high kWh totals (multi-year cumulative) don't
    // get clipped. HAP minValue must stay positive (lx is non-negative).
    service.getCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel).setProps({
      minValue: 0.0001,
      maxValue: 999999,
      minStep: 0.0001,
    });
  }
}

module.exports = Accessory;
