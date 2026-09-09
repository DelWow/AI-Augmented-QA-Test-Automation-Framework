const { spawn } = require('node:child_process');
const { mkdir, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { commands, redact, generateBugReport } = require('./bugs/report');

async function runSuite(suite, { runId = process.env.QA_RUN_ID || randomUUID(), spawnImpl = spawn,
  root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  if (!Object.hasOwn(commands, suite)) throw new Error(`Unknown suite: ${suite}`);
  const started = Date.now();
  let output = '';
  const [command, ...args] = commands[suite];
  const result = await new Promise(resolve => {
    const child = spawnImpl(process.platform === 'win32' ? `${command}.cmd` : command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const capture = stream => chunk => {
      const text = chunk.toString();
      stream.write(text);
      output = (output + text).slice(-64000);
    };
    child.stdout.on('data', capture(process.stdout));
    child.stderr.on('data', capture(process.stderr));
    child.on('error', error => { output += `\nSuite launch failed: ${error.message}`; resolve({ exitCode: 1, signal: null }); });
    child.on('close', (code, signal) => resolve({ exitCode: code ?? 1, signal }));
  });
  const record = { suite, runId, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started,
    ...result, status: result.exitCode === 0 ? 'passed' : 'failed',
    environment: { platform: process.platform, arch: process.arch, node: process.version,
      baseUrl: redact(env.BASE_URL || 'isolated temporary server', env),
      seleniumBrowsers: env.SELENIUM_BROWSERS || 'chrome,firefox' }, output: redact(output, env) };
  const reports = path.join(root, 'qa/reports');
  await mkdir(path.join(reports, 'runs'), { recursive: true });
  await writeFile(path.join(reports, 'runs', `${suite}.json`), JSON.stringify(record, null, 2) + '\n');
  await generateBugReport(record, { dir: path.join(reports, 'bugs'), mode: 'offline', env });
  if (record.status === 'failed') console.error(`Draft bug report: qa/reports/bugs/${suite}.md`);
  return result.exitCode;
}
if (require.main === module) {
  const [suite, ...extra] = process.argv.slice(2);
  if (extra.length) { console.error('Usage: node qa/run-suite.js <suite>'); process.exitCode = 1; }
  else runSuite(suite).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { runSuite };
