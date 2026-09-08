const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { once } = require('node:events');
const newman = require('newman');
const { createApp } = require('../../app/server');

function runCollection(collection, baseUrl, reportFile) {
  return new Promise((resolve, reject) => {
    newman.run({
      collection,
      envVar: [{ key: 'baseUrl', value: baseUrl }],
      reporters: ['cli', 'junit'],
      reporter: { junit: { export: reportFile } },
      timeout: 120000,
      timeoutRequest: 10000,
      timeoutScript: 5000
    }, (error, summary) => {
      if (error) return reject(error);
      if (summary.error) return reject(summary.error);
      if (summary.run.failures.length) {
        return reject(new Error(`${summary.run.failures.length} Newman failure(s)`));
      }
      resolve(summary);
    });
  });
}

async function main() {
  const reportDir = path.resolve(__dirname, '../reports/postman');
  await mkdir(reportDir, { recursive: true });
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

    for (const name of ['baseline', 'ai-edge-cases']) {
      try {
        await runCollection(
          path.join(__dirname, `${name}.postman_collection.json`),
          baseUrl,
          path.join(reportDir, `${name}.xml`)
        );
      } catch (error) {
        console.error(`${name}: ${error.message}`);
        process.exitCode = 1;
      }
    }
    console.log(`Postman reports: ${reportDir}`);
  } finally {
    if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Postman runner: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runCollection };
