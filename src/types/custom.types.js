'use strict';

/**
 * Plugin-specific custom Characteristics, ported to HAP-NodeJS v2.
 *
 * HB 2.0 minimal-patch fork notes:
 * - The original file defined 22 Characteristics and a Service.Switch override
 *   for the out-of-scope subsystems (router wifi switches, callmonitor flags,
 *   childlock toggles, DNS-server toggle, ping/upload/download status, etc.).
 * - None of these are used by the DECT-only scope (thermostat / lightbulb /
 *   temperature / window / outlet). They were also all built using ES5
 *   function-inheritance which breaks under HAP-NodeJS v2.
 * - Rather than porting unused code to ES6 (and inheriting the HAP-v2 service
 *   override risk), we register nothing here. If a future expansion needs any
 *   of these characteristics back, port them to the ES6 pattern used in
 *   eve.types.js.
 */

exports.registerWith = (/* hap */) => {
  // intentionally no-op for the DECT-only fork
};
