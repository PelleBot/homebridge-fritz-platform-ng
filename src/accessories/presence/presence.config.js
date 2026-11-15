'use strict';

const { validIP, validMAC } = require('../../utils/utils');

// Default leave delay (seconds). iPhones drop off the WLAN for short periods
// while asleep; without a delay the sensor would flap between home/away.
const DEFAULT_OFF_DELAY = 300;

const toInt = (value, fallback) => {
  const parsed = parseInt(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const Config = (userConfig) => {
  const validTypes = ['occupancy', 'motion'];
  const rawAddress = typeof userConfig.address === 'string' ? userConfig.address.trim() : userConfig.address;

  return {
    active: userConfig.active || false,
    name: userConfig.name,
    // MACs are normalised to upper case (FRITZ!Box host list format)
    address: validIP(rawAddress) || validMAC(typeof rawAddress === 'string' ? rawAddress.toUpperCase() : rawAddress),
    type: 'presence',
    subtype: validTypes.find((el) => el === userConfig.accType) || 'occupancy',
    blockTelegram: userConfig.blockTelegram || false,
    // Ping fallback of the original plugin is not supported in this fork
    // (sleeping iPhones do not answer ICMP either; needs the system ping binary).
    ping: false,
    threshold: parseInt(userConfig.threshold) || 0,
    accType: validTypes.find((el) => el === userConfig.accType) || 'occupancy',
    onDelay: toInt(userConfig.onDelay, 0),
    offDelay: toInt(userConfig.offDelay, DEFAULT_OFF_DELAY),
  };
};

module.exports = Config;
