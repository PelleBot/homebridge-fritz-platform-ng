/**
 * homebridge-fritz-platform — HB 2.0 minimal-patch fork
 *
 * Homebridge 2.0 requires plugins to be loadable as ES Modules
 * ("type": "module"). The internal src/ tree remains CommonJS to keep
 * this a minimal patch — we expose an ESM entrypoint that re-uses the
 * existing CJS platform via createRequire.
 *
 * Upstream: https://github.com/SeydX/homebridge-fritz-platform (v6.0.20, EOL 2022)
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default function (homebridge) {
  const FritzPlatform = require('./src/platform.js')(homebridge);
  homebridge.registerPlatform('homebridge-fritz-platform', 'FritzPlatform', FritzPlatform, true);
}
