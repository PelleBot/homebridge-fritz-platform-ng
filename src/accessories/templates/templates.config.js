'use strict';

/**
 * Normalises the optional `templates` block of the platform config.
 * Without the block (or with enabled: false) the feature is off and the
 * plugin behaves like v1.3.4.
 */

const MIN_REFRESH_MINUTES = 5;
const DEFAULT_REFRESH_MINUTES = 60;

const strings = (value) =>
  (Array.isArray(value) ? value : []).map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0);

module.exports = (config) => {
  const t = config && typeof config === 'object' ? config : {};
  const mode = t.modeSwitch && typeof t.modeSwitch === 'object' ? t.modeSwitch : {};

  let refreshMinutes = Number(t.refreshMinutes);
  if (t.refreshMinutes === undefined || t.refreshMinutes === null || Number.isNaN(refreshMinutes)) {
    refreshMinutes = DEFAULT_REFRESH_MINUTES;
  } else if (refreshMinutes <= 0) {
    refreshMinutes = 0; // read the list only at start
  } else {
    refreshMinutes = Math.max(MIN_REFRESH_MINUTES, refreshMinutes);
  }

  const names = (Array.isArray(t.names) ? t.names : [])
    .filter((n) => n && typeof n.template === 'string' && typeof n.name === 'string')
    .map((n) => ({ template: n.template.trim(), name: n.name.trim() }))
    .filter((n) => n.template && n.name);

  return {
    enabled: t.enabled === true,
    include: strings(t.include),
    exposeAll: t.exposeAll === true,
    names,
    modeSwitch: {
      enabled: mode.enabled === true,
      name: typeof mode.name === 'string' && mode.name.trim() ? mode.name.trim() : 'Urlaubsmodus',
      onTemplate: typeof mode.onTemplate === 'string' && mode.onTemplate.trim() ? mode.onTemplate.trim() : 'Urlaub',
      offTemplate:
        typeof mode.offTemplate === 'string' && mode.offTemplate.trim() ? mode.offTemplate.trim() : 'Zuhause',
    },
    refreshMinutes,
  };
};

module.exports.MIN_REFRESH_MINUTES = MIN_REFRESH_MINUTES;
module.exports.DEFAULT_REFRESH_MINUTES = DEFAULT_REFRESH_MINUTES;
