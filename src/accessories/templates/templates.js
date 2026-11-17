'use strict';

module.exports = {
  ...require('./templates.manager'),
  ...require('./templates.client'),
  parseTemplateList: require('./templates.parser').parseTemplateList,
  TemplatesConfig: require('./templates.config'),
};
