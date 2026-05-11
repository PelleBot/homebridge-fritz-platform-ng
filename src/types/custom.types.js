'use strict';

/**
 * Custom Characteristics for FritzBox Router-Accessory.
 *
 * HB 2.0 minimal-patch fork notes:
 * The original file used ES5 function-inheritance (`Characteristic.call(this, ...)`
 * + `util.inherits`), which breaks under HAP-NodeJS v2's ES6 Characteristic class.
 * Ported to ES6 class syntax using the same `declare`-helper pattern as
 * eve.types.js, with string-literal HAP-protocol Format/Perm values
 * (`Characteristic.Formats.X` no longer exists as a static in HAP v2).
 *
 * The original also overrode `Service.Switch` to inject these as the service's
 * optional characteristics. That override is intentionally NOT ported — it
 * conflicts with HAP-v2's identity check on built-in services. The router
 * accessory adds the characteristics it needs dynamically via
 * `service.addCharacteristic(Characteristic.X)` at runtime, which works
 * regardless of the service definition's allowedCharacteristics list.
 *
 * Effect of this port: configuring a router device with `hide: false` no
 * longer crashes. The HomeKit-visible toggles for WiFi (2.4/5/Guest), WPS,
 * DECT base, answering machine, etc. become functional again.
 */

exports.registerWith = (hap) => {
  const Characteristic = hap.Characteristic;

  // Same declare helper pattern as eve.types.js — produces ES6-class
  // subclasses of Characteristic.
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

  // HAP protocol uses stable string values for Format / Perms / Units.
  //   Formats: 'bool','int','uint8','uint16','uint32','uint64','float','string','data','tlv8'
  //   Perms:   'pr' (read), 'pw' (write), 'ev' (notify)
  const PR_PW_EV = ['pr', 'pw', 'ev'];
  const PR_EV = ['pr', 'ev'];

  // ---- WiFi toggles ----
  declare('WifiTwo', 'WIFI 2.4GHZ', '0026e147-5d51-4f42-b157-6aca6050be8e', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('WifiFive', 'WIFI 5GHZ', 'a72aeeca-c6ce-45ce-b026-5d400aab5fc9', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('WifiGuest', 'WIFI Guest', 'a87bbf2b-885c-4713-8169-22abdbf0b2a1', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('WifiWPS', 'WIFI WPS', '991dd58c-7d8c-46b1-acd1-411d8f6902ac', {
    format: 'bool', perms: PR_PW_EV,
  });

  // ---- FritzBox device toggles ----
  declare('Reconnect', 'Reconnect', 'ce1cb310-d2d8-4cd1-9686-c6f2aba6ad15', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('DECT', 'DECT Station', '1718fc65-453b-403a-ab81-79a1c96ba195', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('AnsweringMachine', 'Answering Machine', 'd19ef9d5-3bc6-47ac-b6bb-7bdcf0df20b0', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('Deflection', 'Deflection', '658086c7-274c-4988-bd5e-3c720fa3054d', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('WakeUp', 'Wake Up', 'c60a4aa9-cefb-4c61-8185-ad2b3ba52842', {
    format: 'bool', perms: PR_PW_EV,
  });

  // ---- Device-control toggles ----
  declare('DeviceLED', 'LED', 'fd81f0dc-4324-457e-8164-289743873fb1', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('DeviceLock', 'Device Lock', '56af4239-46bc-4bae-b55b-dbc5be2d0897', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('RingLock', 'Ring Lock', 'cab7d43e-422c-4452-bc9a-11c89454332b', {
    format: 'bool', perms: PR_PW_EV,
  });

  // ---- Phone & alarm ----
  declare('PhoneBook', 'Refresh Phone Book', '8f9aeaa4-092f-4c3a-85f1-dfd064a07c3d', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('DialAlarm', 'Alarm', '8fe6e841-41e4-479f-b334-8af339ce5b30', {
    format: 'bool', perms: PR_PW_EV,
  });

  // ---- Network ----
  declare('DNSServer', 'DNS Server', 'c34f1eb0-92bb-44a8-b399-17f2599639f1', {
    format: 'bool', perms: PR_PW_EV,
  });
  declare('FallbackInternet', 'Internet Fallback', 'ef088934-4ec8-4174-b550-e8a8faaed88c', {
    format: 'bool', perms: PR_PW_EV,
  });

  // ---- Read-only display (callmonitor is out of scope but the router
  // accessory may still reference Caller/Called via Service.ContactSensor
  // optionals — registering here keeps router/router.accessory.js safe). ----
  declare('Caller', 'Last Caller', 'eb0b2d83-569b-44aa-989d-190a911b4397', {
    format: 'string', perms: PR_EV,
  });
  declare('Called', 'Last Called', 'cf42e4a1-ff61-4aa6-9cc5-55d3c09cfbbd', {
    format: 'string', perms: PR_EV,
  });

  // ---- Bandwidth / connection stats ----
  declare('Download', 'Download', '37574b8e-2d7c-47ee-8b5e-6bfc42f195d9', {
    format: 'string', perms: PR_EV,
  });
  declare('Upload', 'Upload', '9b2e94f7-a665-4575-9efd-1b37474d758b', {
    format: 'string', perms: PR_EV,
  });
  declare('Ping', 'Ping', 'ce18aaef-1026-4538-943b-026501599dc0', {
    format: 'float', perms: PR_EV,
    maxValue: 9999, minValue: 0, minStep: 0.1,
  });

  // NOTE on Service.Switch: original file overrode the built-in HAP Switch
  // service to inject the above as optional characteristics. NOT ported —
  // dynamic `service.addCharacteristic(...)` calls in router.accessory.js
  // do the same thing at runtime without polluting the global Service.Switch.
};
