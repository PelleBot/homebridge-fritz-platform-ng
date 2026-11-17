'use strict';

/**
 * Wizard helpers for FRITZ!Box templates and scenarios (v1.4.1).
 * Pure functions, used by server.js and ci/templates-mock-test.cjs.
 */

/**
 * Reduce the parsed template list to what the wizard shows.
 * AVM: auto-created templates without <sub_templates/> belong to a predefined
 * scenario and should not be shown.
 *
 * @param {Array<object>} list  result of parseTemplateList()
 * @returns {Array<{identifier, name, isScenario, subCount, deviceCount}>}
 */
function templatesForWizard(list) {
  return (Array.isArray(list) ? list : [])
    .filter((t) => t && t.identifier && !(t.autocreate && !t.isScenario))
    .map((t) => ({
      identifier: t.identifier,
      name: t.name,
      isScenario: t.isScenario === true,
      subCount: (t.subTemplates || []).length,
      deviceCount: (t.devices || []).length,
    }))
    .sort((a, b) => (a.isScenario === b.isScenario ? a.name.localeCompare(b.name, 'de') : a.isScenario ? 1 : -1));
}

/** Wizard error text for a failed template read. */
function templateErrorText(err) {
  if (!err) return 'Unbekannter Fehler.';
  if (err.code === 403 || err.code === 'NO_SID') {
    return 'Die FritzBox verweigert den Zugriff. Der FritzBox-Benutzer braucht die Berechtigung „Smart Home“.';
  }
  if (err.code === 'TEMPLATE_TIMEOUT' || err.code === 'WIZARD_TIMEOUT') {
    return 'Die FritzBox hat nicht rechtzeitig geantwortet. Bitte später noch einmal versuchen.';
  }
  return `Vorlagen konnten nicht gelesen werden (${err.code || err.message || err}).`;
}

module.exports = { templatesForWizard, templateErrorText };
