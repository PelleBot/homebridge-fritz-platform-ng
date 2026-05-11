'use strict';

/**
 * Eve App custom Characteristics, ported to HAP-NodeJS v2 (ES6 class syntax).
 *
 * HB 2.0 minimal-patch fork notes:
 * - The original file used ES5 function-inheritance (`Characteristic.call(this, ...)` +
 *   `util.inherits`). HAP-NodeJS v2 makes Characteristic and Service into actual ES6
 *   classes, which require `new` to construct — the old pattern raises
 *   `TypeError: Class constructor X cannot be invoked without 'new'`.
 * - The original file also overrode the standard HAP services Outlet, Thermostat,
 *   ContactSensor and MotionSensor to inject Eve optional characteristics. Those
 *   overrides are intentionally NOT ported. DECT accessories add the Eve optionals
 *   dynamically via `service.addCharacteristic(Characteristic.X)` where needed
 *   (see e.g. thermostat.accessory.js for ValvePosition). Removing the service
 *   overrides keeps us out of the global namespace pollution that breaks HAP v2's
 *   service identity checks.
 *
 * What remains: a registry of Eve-defined Characteristics that DECT accessories
 * (and the stubbed fakegato-history service) may reference.
 */

exports.registerWith = (hap) => {
  const Characteristic = hap.Characteristic;

  // Helper to declare a Characteristic subclass with the standard pattern.
  // (Same as repeating the ES6 class definition ~20 times.)
  const declare = (name, displayName, uuid, props) => {
    class Sub extends Characteristic {
      constructor() {
        super(displayName, uuid);
        this.setProps(props);
        this.value = this.getDefaultValue();
      }
    }
    Sub.UUID = uuid;
    Characteristic[name] = Sub;
  };

  // HAP protocol uses stable string values for Formats / Perms / Units.
  // In HAP-NodeJS v2 these enums are no longer attached as static members
  // on Characteristic. Using the strings directly avoids any version drift.
  //   Formats: 'uint8','uint16','uint32','uint64','int','float','string','bool','data','tlv8'
  //   Perms:   'pr' (read), 'pw' (write), 'ev' (notify), 'hd' (hidden), 'wr' (write-response)
  //   Units:   'celsius','fahrenheit','percentage','arcdegrees','lux','seconds'
  const PR_EV = ['pr', 'ev'];
  const PR_EV_PW = ['pr', 'ev', 'pw'];

  // History-related (used by fakegato-history; our stub no-ops them but
  // accessory code may still reference these as registered types).
  declare('ResetTotal', 'Reset Total', 'E863F112-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint32', unit: 'seconds', perms: PR_EV_PW,
  });
  declare('HistoryStatus', 'History Status', 'E863F116-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: PR_EV_PW,
  });
  declare('HistoryEntries', 'History Entries', 'E863F117-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: PR_EV_PW,
  });
  declare('HistoryRequest', 'History Request', 'E863F11C-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: PR_EV_PW,
  });
  declare('SetTime', 'Set Time', 'E863F121-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: PR_EV_PW,
  });

  // Window / contact sensor (Eve-extended)
  declare('LastActivation', 'Last Activation', 'E863F11A-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint32', unit: 'seconds', perms: PR_EV,
  });
  declare('TimesOpened', 'Times Opened', 'E863F129-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint32', perms: PR_EV,
  });
  declare('OpenDuration', 'Open Duration', 'E863F118-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint32', unit: 'seconds', perms: PR_EV_PW,
  });
  declare('ClosedDuration', 'Closed Duration', 'E863F119-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint32', unit: 'seconds', perms: PR_EV_PW,
  });

  // Outlet / energy (Eve-extended)
  declare('CurrentConsumption', 'Current Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52', {
    format: 'float', unit: 'W', perms: PR_EV,
  });
  declare('TotalConsumption', 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52', {
    format: 'float', unit: 'kWh', perms: PR_EV,
  });
  declare('Volts', 'Volts', 'E863F10A-079E-48FF-8F27-9C2605A29F52', {
    format: 'float', unit: 'V', perms: PR_EV,
  });
  declare('Amperes', 'Amperes', 'E863F126-079E-48FF-8F27-9C2605A29F52', {
    format: 'float', unit: 'A', perms: PR_EV,
  });

  // Thermostat (Eve-extended)
  declare('ValvePosition', 'Valve Position', 'E863F12E-079E-48FF-8F27-9C2605A29F52', {
    format: 'uint8', unit: 'percentage', perms: PR_EV,
  });
  declare('ProgramCommand', 'Program Command', 'E863F12C-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: ['pw'],
  });
  declare('ProgramData', 'Program Data', 'E863F12F-079E-48FF-8F27-9C2605A29F52', {
    format: 'data', perms: PR_EV,
  });

  // NOTE: The original file overrode Service.Outlet, Service.Thermostat,
  // Service.ContactSensor, Service.MotionSensor to inject the Eve optional
  // characteristics into those services. Those overrides are intentionally
  // NOT ported — DECT accessories add the optionals dynamically with
  // service.addCharacteristic(...) where they need them. See thermostat.accessory.js
  // lines 126-128 for ValvePosition for a concrete example.
};
