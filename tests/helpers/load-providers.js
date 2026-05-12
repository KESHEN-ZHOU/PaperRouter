// tests/helpers/load-providers.js
// Loads PaperRouter/chrome/content/providers.js (an IIFE that defines `var TidyUpProviders`)
// in a sandboxed VM context so jest tests can access it without requiring CommonJS exports.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadProviders() {
  const file = path.join(__dirname, '..', '..', 'PaperRouter', 'chrome', 'content', 'providers.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    // The IIFE references `TidyUpL10n.getString(key, params)` for short error l10n.
    // In tests we just echo the key back so assertions can check the key was selected.
    TidyUpL10n: { getString: function(key, params) {
      if (params && typeof params === 'object') {
        var out = key;
        for (var k in params) out += '|' + k + '=' + params[k];
        return out;
      }
      return key;
    }}
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!sandbox.TidyUpProviders) {
    throw new Error('providers.js did not define global TidyUpProviders');
  }
  return sandbox.TidyUpProviders;
}

module.exports = { loadProviders };
