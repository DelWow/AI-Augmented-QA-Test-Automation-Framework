const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:3000',
    specPattern: 'qa/cypress/e2e/**/*.cy.js',
    supportFile: false,
    fixturesFolder: false,
    testIsolation: true
  },
  viewportWidth: 1280,
  viewportHeight: 800,
  video: false,
  screenshotsFolder: 'qa/reports/cypress/screenshots',
  videosFolder: 'qa/reports/cypress/videos'
});
