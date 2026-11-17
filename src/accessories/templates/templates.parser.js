'use strict';

/**
 * Parser for the AHA command `gettemplatelistinfos`
 * (AHA-HTTP-Interface 1.63, section 3.4, FRITZ!OS >= 7.39 for <sub_templates>).
 *
 *   <templatelist version="1">
 *     <template identifier="tmp…" id="60100" functionbitmask="…" autocreate="0" applymask="…">
 *       <name>…</name> <metadata>…</metadata>
 *       <devices><device identifier="…"/></devices>
 *       <triggers/> <sub_templates><template identifier="…"/></sub_templates>
 *       <applymask><hkr_time_table/></applymask>
 *     </template>
 *   </templatelist>
 *
 * A scenario is a template whose <applymask> contains <sub_templates/>; it
 * combines other templates (listed under <sub_templates>).
 */

const { parseStringPromise } = require('xml2js');

// applymask attribute bit for <sub_templates/>. Not listed in the AVM document;
// observed on FRITZ!OS 8 (scenario: applymask="2048"). Only used as a fallback
// when the <applymask> element is missing.
const APPLYMASK_SUB_TEMPLATES_BIT = 2048;

const first = (value) => (Array.isArray(value) ? value[0] : value);

const text = (value) => {
  const v = first(value);
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && typeof v._ === 'string') return v._.trim();
  return '';
};

const childIdentifiers = (container, childName) => {
  const c = first(container);
  if (!c || typeof c !== 'object') return [];
  const children = c[childName] || [];
  return children.map((child) => child && child.$ && child.$.identifier).filter((id) => typeof id === 'string' && id);
};

const elementNames = (container) => {
  const c = first(container);
  if (!c || typeof c !== 'object') return [];
  return Object.keys(c).filter((key) => key !== '$' && key !== '_');
};

const parseMetadata = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * @param {string} xml  body of gettemplatelistinfos
 * @returns {Promise<Array<object>>}  normalised templates
 */
async function parseTemplateList(xml) {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new Error('Empty response for gettemplatelistinfos');
  }

  const doc = await parseStringPromise(xml, { explicitArray: true });

  if (!doc || !Object.prototype.hasOwnProperty.call(doc, 'templatelist')) {
    throw new Error('Unexpected response for gettemplatelistinfos (no <templatelist>)');
  }

  const root = doc.templatelist;
  const templates = root && typeof root === 'object' && Array.isArray(root.template) ? root.template : [];

  return templates
    .filter((t) => t && t.$ && t.$.identifier)
    .map((t) => {
      const attrs = t.$;
      const applymask = elementNames(t.applymask);
      const applymaskBits = parseInt(attrs.applymask, 10) || 0;
      const subTemplates = childIdentifiers(t.sub_templates, 'template');
      const metadata = parseMetadata(text(t.metadata));
      const isScenario = applymask.length
        ? applymask.includes('sub_templates')
        : (applymaskBits & APPLYMASK_SUB_TEMPLATES_BIT) !== 0;

      return {
        identifier: attrs.identifier,
        id: attrs.id,
        name: text(t.name) || attrs.identifier,
        functionbitmask: parseInt(attrs.functionbitmask, 10) || 0,
        applymaskBits,
        applymask,
        autocreate: attrs.autocreate === '1',
        metadata,
        devices: childIdentifiers(t.devices, 'device'),
        triggers: childIdentifiers(t.triggers, 'trigger'),
        subTemplates,
        isScenario,
      };
    });
}

module.exports = { parseTemplateList, APPLYMASK_SUB_TEMPLATES_BIT };
