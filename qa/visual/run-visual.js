const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { mkdir, readFile, writeFile, rm, copyFile } = require('node:fs/promises');
const path = require('node:path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { createApp } = require('../../app/server');
const { compareScreenshot } = require('./compare');
const { reviewVisualReport } = require('./review-diffs');

const states = ['login', 'empty-tasks', 'populated-tasks', 'validation-error'];
const environment = `${process.platform}-${process.arch}`;
const viewport = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--update')) throw new Error('Usage: node qa/visual/run-visual.js [--update]');
  const update = args.includes('--update');
  const baselineDir = path.join(__dirname, 'baseline', environment);
  const currentDir = path.join(__dirname, 'current', environment);
  const diffDir = path.join(__dirname, 'diffs', environment);
  const reportFile = path.resolve(__dirname, '../reports/visual/results.json');
  for (const dir of [currentDir, diffDir]) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }
  await mkdir(path.dirname(reportFile), { recursive: true });
  const report = { status: 'running', mode: update ? 'update' : 'compare', environment, results: [] };
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  let driver;
  let server;
  let token;
  let baseUrl;
  try {
    let expected;
    if (!update) {
      try { expected = JSON.parse(await readFile(path.join(baselineDir, 'manifest.json'), 'utf8')); }
      catch (error) {
        if (error.code === 'ENOENT') throw new Error(`No baseline for ${environment}. Run npm run visual:update and review the images.`);
        throw error;
      }
    }
    baseUrl = process.env.BASE_URL;
    if (baseUrl !== undefined) {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash) throw new Error('BASE_URL must be an HTTP(S) URL without a query or fragment');
      baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      server = createApp().listen(0, '127.0.0.1');
      await once(server, 'listening');
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    }
    driver = await new Builder().forBrowser('chrome').setChromeOptions(
      new chrome.Options().addArguments('--headless=new', '--force-color-profile=srgb', '--lang=en-US')
    ).build();
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30000, script: 10000 });
    await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', viewport);
    await driver.sendDevToolsCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    const metadata = { environment, browser: 'chrome', browserVersion: (await driver.getCapabilities()).get('browserVersion'), viewport, states };
    report.capture = metadata;
    if (expected) assert.deepEqual(metadata, expected, 'Capture environment differs from baseline; review before updating');
    const visible = async selector => {
      const element = await driver.wait(until.elementLocated(By.css(selector)), 10000);
      return driver.wait(until.elementIsVisible(element), 10000);
    };
    const capture = async name => {
      await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        document.activeElement.blur();
        window.scrollTo(0, 0);
        document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(done)));
      `);
      const file = path.join(currentDir, `${name}.png`);
      await writeFile(file, Buffer.from(await driver.takeScreenshot(), 'base64'));
      if (!update) {
        const result = await compareScreenshot(path.join(baselineDir, `${name}.png`), file, path.join(diffDir, `${name}.png`));
        report.results.push({ name, ...result });
        console.log(`Visual ${name}: ${result.status}${result.changedPixels !== undefined ? ` (${result.changedPixels} changed pixels)` : ''}`);
      }
    };
    await driver.get(baseUrl + '/');
    await visible('#login-page');
    await capture('login');
    await driver.findElement(By.id('username')).sendKeys(`visual-${randomUUID()}`);
    await driver.findElement(By.id('password')).sendKeys('demo-password');
    await driver.findElement(By.id('login-button')).click();
    await visible('#tasks-page');
    token = await driver.executeScript('return sessionStorage.getItem("token")');
    assert.ok(token);
    await visible('#empty-state');
    await capture('empty-tasks');
    for (const body of [
      { title: 'Review the release checklist', completed: false },
      { title: 'Run the API test suite', completed: true }
    ]) {
      const response = await fetch(baseUrl + '/tasks', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 201);
      await response.json();
    }
    await driver.navigate().refresh();
    await visible('#task-list li span.complete');
    assert.equal((await driver.findElements(By.css('#task-list li'))).length, 2);
    await capture('populated-tasks');
    await driver.findElement(By.id('task-title')).sendKeys('   ');
    await driver.findElement(By.id('create-task')).click();
    await driver.wait(until.elementTextContains(await driver.findElement(By.id('error')), 'Title must contain'), 10000);
    await capture('validation-error');
    // Only publish baselines after every state was successfully captured.
    if (update) {
      await mkdir(baselineDir, { recursive: true });
      for (const name of states) {
        await copyFile(path.join(currentDir, `${name}.png`), path.join(baselineDir, `${name}.png`));
        report.results.push({ name, status: 'updated' });
      }
      await writeFile(path.join(baselineDir, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
      console.log(`Updated ${states.length} baselines in ${baselineDir}; review the images before committing.`);
    }
    report.status = report.results.some(result => result.status === 'failed') ? 'failed' : 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    console.error(error.message);
  } finally {
    const cleanupErrors = [];
    if (token) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(baseUrl + '/tasks', { headers, signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200);
        for (const task of await response.json()) {
          const deleted = await fetch(`${baseUrl}/tasks/${task.id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(10000) });
          assert.equal(deleted.status, 204);
        }
      } catch (error) { cleanupErrors.push(`Task cleanup: ${error.message}`); }
    }
    if (driver) {
      try { await driver.quit(); } catch (error) { cleanupErrors.push(`Browser shutdown: ${error.message}`); }
    }
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(error => { if (error) cleanupErrors.push(error.message); resolve(); }));
    }
    if (cleanupErrors.length) { report.status = 'failed'; report.cleanupErrors = cleanupErrors; }
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
    if (report.status === 'failed') process.exitCode = 1;
    console.log(`Visual report: ${reportFile}`);
    if (!update) {
      const review = await reviewVisualReport({ reportFile, mode: 'offline' });
      console.log(`Semantic review: ${review.status} (offline)`);
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
