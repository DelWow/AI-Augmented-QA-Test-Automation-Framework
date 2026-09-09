const { randomUUID } = require('node:crypto');
const { commands } = require('./bugs/report');
const { runSuite } = require('./run-suite');
(async () => {
  const runId = randomUUID();
  for (const suite of Object.keys(commands)) {
    try { if (await runSuite(suite, { runId })) process.exitCode = 1; }
    catch (error) { console.error(`${suite}: ${error.message}`); process.exitCode = 1; }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
