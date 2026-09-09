const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const { compareScreenshot } = require('../visual/compare');
const { reviewVisualReport, askModel } = require('../visual/review-diffs');

const assessment = { severity: 'functional', summary: 'The control moved.', observations: ['A button overlaps a label.'], nextAction: 'Review the layout change.' };
const response = text => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }) });

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'semantic-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['baseline', 'current', 'diffs']) await mkdir(path.join(root, folder, 'darwin-arm64'), { recursive: true });
  const files = Object.fromEntries(['baseline', 'current', 'diffs'].map(folder => [folder, path.join(root, folder, 'darwin-arm64/login.png')]));
  const png = new PNG({ width: 4, height: 4 });
  png.data.fill(255);
  await writeFile(files.baseline, PNG.sync.write(png));
  png.data[0] = png.data[1] = png.data[2] = 0;
  await writeFile(files.current, PNG.sync.write(png));
  const diff = await compareScreenshot(files.baseline, files.current, files.diffs);
  const source = { mode: 'compare', status: 'failed', environment: 'darwin-arm64', results: [
    { name: 'login', ...diff }, ...['empty-tasks', 'populated-tasks', 'validation-error'].map(name => ({ name, status: 'passed', changedPixels: 0 }))
  ] };
  const reportFile = path.join(root, 'results.json');
  await writeFile(reportFile, JSON.stringify(source));
  return { visualRoot: root, reportFile, files, source };
}

test('offline review never calls a model or changes pixel evidence', async t => {
  const f = await fixture(t);
  const before = await readFile(f.reportFile);
  const baseline = await readFile(f.files.baseline);
  const result = await reviewVisualReport({ ...f, fetchImpl: () => { throw new Error('Unexpected network call'); } });
  assert.equal(result.status, 'pending');
  assert.equal(result.pixelStatus, 'failed');
  assert.equal(result.reviews[0].assessment, undefined);
  assert.equal(result.reviews[1].status, 'not_needed');
  assert.deepEqual(await readFile(f.reportFile), before);
  assert.deepEqual(await readFile(f.files.baseline), baseline);
});

test('online review sends three labeled images and validates structured output without passing pixel failures', async t => {
  const f = await fixture(t);
  let calls = 0;
  const result = await reviewVisualReport({ ...f, mode: 'online', model: 'test-model', apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      const images = body.input[0].content.filter(part => part.type === 'input_image');
      assert.equal(images.length, 3);
      assert.ok(images.every(image => image.image_url.startsWith('data:image/png;base64,')));
      return response(JSON.stringify(assessment));
    } });
  assert.equal(calls, 1);
  assert.equal(result.reviews[0].status, 'reviewed');
  assert.deepEqual(result.reviews[0].assessment, assessment);
  assert.equal(result.pixelStatus, 'failed');
  assert.ok(!(await readFile(path.join(f.visualRoot, 'semantic-review.json'), 'utf8')).includes('test-key'));
});

test('stale or missing images prevent model calls', async t => {
  const f = await fixture(t);
  await writeFile(f.files.current, 'changed after comparison');
  const options = { ...f, mode: 'online', model: 'test-model', apiKey: 'test-key', fetchImpl: () => { throw new Error('Should not call API'); } };
  const stale = await reviewVisualReport(options);
  assert.match(stale.reviews[0].error, /stale/);
  await rm(f.files.current);
  assert.match((await reviewVisualReport(options)).reviews[0].error, /missing/);
});

test('invalid paths, update reports, and non-pixel failures are rejected', async t => {
  const f = await fixture(t);
  await writeFile(f.reportFile, JSON.stringify({ ...f.source, environment: '../../private' }));
  await assert.rejects(reviewVisualReport(f), /completed visual comparison/);
  await writeFile(f.reportFile, JSON.stringify({ ...f.source, mode: 'update' }));
  await assert.rejects(reviewVisualReport(f), /completed visual comparison/);
  f.source.results[0] = { name: 'login', status: 'failed', reason: 'Missing baseline' };
  await writeFile(f.reportFile, JSON.stringify(f.source));
  assert.match((await reviewVisualReport(f)).reviews[0].error, /No comparable pixel diff/);
});

test('API errors, refusal, truncation, and malformed assessments are explicit failures', async () => {
  const images = { baseline: Buffer.from('test') };
  const options = { model: 'test-model', apiKey: 'test-key' };
  await assert.rejects(askModel(images, 'login', {}), /requires/);
  for (const [fetchImpl, expected] of [
    [async () => { throw new Error('secret request details'); }, /failed or timed out/],
    [async () => ({ ok: false, status: 429 }), /HTTP 429/],
    [async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) }), /not completed/],
    [async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }), /declined/],
    [async () => response('not JSON'), /invalid assessment/],
    [async () => response(JSON.stringify({ ...assessment, severity: 'approved' })), /schema/]
  ]) await assert.rejects(askModel(images, 'login', { ...options, fetchImpl }), expected);
});
