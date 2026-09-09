const { defineConfig } = require('cypress');
const { mkdirSync, appendFileSync, rmSync } = require('node:fs');
const path = require('node:path');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:3000',
    specPattern: 'qa/cypress/e2e/**/*.cy.js',
    supportFile: 'qa/cypress/support/e2e.js',
    fixturesFolder: false,
    testIsolation: true,
    setupNodeEvents(on) {
      const report = path.join(__dirname, 'qa/reports/cypress/selector-recovery.jsonl');
      on('before:run', () => rmSync(report, { force: true }));
      on('task', {
        selectorRecovery(record) {
          mkdirSync(path.dirname(report), { recursive: true });
          appendFileSync(report, JSON.stringify(record) + '\n');
          console.log(`Selector recovery: ${record.recoveries.length} in ${record.test}`);
          return null;
        }
      });
    }
  },
  viewportWidth: 1280,
  viewportHeight: 800,
  video: false,
  screenshotsFolder: 'qa/reports/cypress/screenshots',
  videosFolder: 'qa/reports/cypress/videos'
});
