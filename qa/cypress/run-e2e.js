const path = require('node:path');
const { once } = require('node:events');
const cypress = require('cypress');
const { createApp } = require('../../app/server');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--open')) throw new Error('Usage: node qa/cypress/run-e2e.js [--open]');
  let server;
  try {
    let baseUrl = process.env.BASE_URL;
    if (baseUrl !== undefined) {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash) {
        throw new Error('BASE_URL must be an HTTP(S) URL without a query or fragment');
      }
      baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      server = createApp().listen(0, '127.0.0.1');
      await once(server, 'listening');
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    }
    const options = {
      project: path.resolve(__dirname, '../..'),
      config: { baseUrl },
      testingType: 'e2e'
    };
    if (args.includes('--open')) {
      await cypress.open(options);
    } else {
      const results = await cypress.run({ ...options, browser: 'electron', headless: true });
      if (results.status === 'failed' || results.failures || results.totalFailed || !results.totalTests) {
        throw new Error(results.message || 'Cypress failed or ran no tests');
      }
    }
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
}

main().catch(error => {
  console.error(`Cypress runner: ${error.message}`);
  process.exitCode = 1;
});
