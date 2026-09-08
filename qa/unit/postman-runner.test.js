const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { runCollection } = require('../postman/run-collections');

test('Newman writes reports and rejects assertion and request failures', async t => {
  const reportDir = await mkdtemp(path.join(tmpdir(), 'postman-runner-'));
  t.after(() => rm(reportDir, { recursive: true, force: true }));
  const server = createServer((req, res) => {
    if (req.url === '/disconnect') return req.socket.destroy();
    res.writeHead(req.url === '/pass' ? 200 : 503);
    res.end();
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const collection = route => ({
    info: { name: 'Runner verification', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{
      name: route,
      request: { method: 'GET', url: `{{baseUrl}}/${route}` },
      event: [{ listen: 'test', script: { type: 'text/javascript', exec: ['pm.test("Status is 200", () => pm.response.to.have.status(200));'] } }]
    }]
  });
  const passingReport = path.join(reportDir, 'pass.xml');
  const result = await runCollection(collection('pass'), baseUrl, passingReport);
  assert.equal(result.run.stats.assertions.total, 1);
  assert.match(await readFile(passingReport, 'utf8'), /<testsuites[\s>]/);
  for (const route of ['fail', 'disconnect']) {
    const report = path.join(reportDir, `${route}.xml`);
    await assert.rejects(runCollection(collection(route), baseUrl, report), /Newman failure/);
    assert.match(await readFile(report, 'utf8'), /<failure[\s>]/);
  }
});
