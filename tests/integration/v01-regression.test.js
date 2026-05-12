// tests/integration/v01-regression.test.js
// Guards against the 2.9.1 merge silently reverting v0.1 improvements.
const fs = require('fs');
const path = require('path');

const xhtmlPath = path.join(__dirname, '..', '..', 'PaperRouter', 'preferences.xhtml');

describe('v0.1 UI regressions must stay fixed', () => {
  const src = fs.readFileSync(xhtmlPath, 'utf8');

  test('Algorithm selector uses native HTML radio (not XUL radiogroup)', () => {
    // Should NOT contain XUL <radiogroup> or <radio> for algorithm
    expect(src).not.toMatch(/<radiogroup[^>]*id=["']classification-algorithm/);
    // Should contain native HTML radios with name="alg"
    expect(src).toMatch(/<html:input[^>]*type=["']radio["'][^>]*name=["']alg["']/);
  });

  test('Model fields use combobox (input + datalist), not menulist', () => {
    // embedding-model menulist should be gone
    expect(src).not.toMatch(/<menulist[^>]*id=["']embedding-model-openai/);
    expect(src).not.toMatch(/<menulist[^>]*id=["']embedding-model-cohere/);
    // embedding-model <input list="..."> should be present
    expect(src).toMatch(/<html:input[^>]*id=["']embedding-model["'][^>]*list=/);
    // datalist for options
    expect(src).toMatch(/<html:datalist[^>]*id=["']embedding-model-options/);
  });
});
