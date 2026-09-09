const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, access, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { generateBugReport, redact, triage } = require('../bugs/report');
const { runSuite } = require('../run-suite');
const record = { suite: 'visual', runId: 'test-run', exitCode: 1, status: 'failed', output: 'Visual login: failed (10 changed pixels)' };
async function directory(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'bug-reports-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('offline drafts use real evidence and redact credentials; passed reruns clear stale drafts', async t => {
  const dir = await directory(t);
  const result = await generateBugReport({ ...record, output: 'Bearer session-value token="token-value" password=demo-password sk-testsecret configured-secret' }, {
    dir, env: { OPENAI_API_KEY: 'configured-secret' }, fetchImpl: () => { throw new Error('No network allowed'); }
  });
  assert.equal(result.ai.status, 'pending');
  assert.equal(result.reproduction, 'npm run test:visual');
  const json = await readFile(path.join(dir, 'visual.json'), 'utf8');
  for (const secret of ['session-value', 'token-value', 'demo-password', 'sk-testsecret', 'configured-secret']) assert.ok(!json.includes(secret));
  await generateBugReport({ ...record, exitCode: 0, status: 'passed', output: 'Expected 401 and errors were tested' }, { dir });
  await assert.rejects(access(path.join(dir, 'visual.md')), { code: 'ENOENT' });
});

test('online triage is advisory, validates its response, and sends only redacted evidence', async t => {
  const dir = await directory(t);
  const assessment = { summary: 'The visual check failed.', category: 'uncertain', hypothesis: 'A layout change may explain the diff.', nextChecks: ['Inspect the current image.'] };
  let calls = 0;
  const result = await generateBugReport({ ...record, output: 'Bearer private-token' }, { dir, mode: 'online', model: 'test-model', apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.ok(!options.body.includes('private-token'));
      assert.equal(JSON.parse(options.body).store, false);
      return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(assessment) }] }] }) };
    } });
  assert.equal(calls, 1);
  assert.equal(result.ai.status, 'reviewed');
  assert.equal(result.evidence.exitCode, 1);
  assert.deepEqual(result.ai.assessment, assessment);
});

test('provider failures preserve the offline evidence with explicit AI error', async t => {
  const dir = await directory(t);
  const result = await generateBugReport(record, { dir, mode: 'online', model: 'test-model', apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(result.ai.status, 'error');
  assert.match(result.ai.error, /429/);
  assert.equal(result.evidence.output, record.output);
  const options = { model: 'test-model', apiKey: 'test-key' };
  for (const payload of [{ status: 'incomplete' }, { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'output_text', text: '{}' }] }] }]) {
    await assert.rejects(triage(record, { ...options, fetchImpl: async () => ({ ok: true, json: async () => payload }) }));
  }
});

test('suite wrapper uses process exit status, not error keywords, and persists run evidence', async t => {
  const root = await directory(t);
  function fakeSpawn(code) {
    return () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      process.nextTick(() => { child.stdout.end('Deliberate failure-message fixture\n'); child.emit('close', code, null); });
      return child;
    };
  }
  assert.equal(await runSuite('unit', { root, runId: 'failure-run', spawnImpl: fakeSpawn(7) }), 7);
  const file = path.join(root, 'qa/reports/bugs/unit.json');
  assert.equal(JSON.parse(await readFile(file)).evidence.exitCode, 7);
  assert.equal(await runSuite('unit', { root, runId: 'passing-run', spawnImpl: fakeSpawn(0) }), 0);
  await assert.rejects(access(file), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(path.join(root, 'qa/reports/runs/unit.json'))).runId, 'passing-run');
  await assert.rejects(runSuite('../unsafe', { root }), /Unknown suite/);
});

test('invalid records are rejected and redaction covers UUID session tokens', async t => {
  const dir = await directory(t);
  await assert.rejects(generateBugReport({ ...record, suite: '../escape' }, { dir }), /Invalid suite/);
  await assert.rejects(generateBugReport({ ...record, exitCode: 0 }, { dir }), /Invalid suite/);
  assert.ok(!redact('550e8400-e29b-41d4-a716-446655440000').includes('550e8400'));
});
