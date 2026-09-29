const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    // `.preview/` holds the exported web build and screenshots the
    // run-scanly skill produces; it is generated output, not source.
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', '.preview/*'],
  },
];
