const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { Builder, By, until, error: webdriverError } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const { createApp } = require('../../app/server');

function parseBrowsers(value = 'chrome,firefox') {
  const browsers = value.split(',').map(name => name.trim().toLowerCase());
  if (!browsers.length || browsers.some(name => !['chrome', 'firefox'].includes(name))) {
    throw new Error('SELENIUM_BROWSERS must be a comma-separated list of chrome and/or firefox');
  }
  return [...new Set(browsers)];
}

async function runSmoke(browser, baseUrl) {
  let driver;
  let token;
  const failures = [];
  const result = { browser, status: 'failed' };
  const started = Date.now();
  try {
    const builder = new Builder().forBrowser(browser);
    if (browser === 'chrome') builder.setChromeOptions(new chrome.Options().addArguments('--headless=new', '--window-size=1280,800'));
    else builder.setFirefoxOptions(new firefox.Options().addArguments('-headless'));
    driver = await builder.build();
    result.version = (await driver.getCapabilities()).get('browserVersion');
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30000, script: 10000 });
    const visible = async selector => {
      const element = await driver.wait(until.elementLocated(By.css(selector)), 10000);
      return driver.wait(until.elementIsVisible(element), 10000);
    };
    // Re-find elements on every poll because rendering replaces task rows.
    const waitFor = (check, message) => driver.wait(async () => {
      try { return await check(); } catch (error) {
        if (error instanceof webdriverError.StaleElementReferenceError || error instanceof webdriverError.NoSuchElementError) return false;
        throw error;
      }
    }, 10000, message);
    await driver.get(baseUrl + '/');
    await (await visible('#username')).sendKeys(`selenium-${browser}-${randomUUID()}`);
    await (await visible('#password')).sendKeys('demo-password');
    await (await visible('#login-button')).click();
    await visible('#tasks-page');
    token = await driver.executeScript('return sessionStorage.getItem("token")');
    assert.ok(token, 'Login must store a session token');
    await visible('#empty-state');
    assert.equal((await driver.findElements(By.css('#task-list li'))).length, 0);

    const title = `Smoke task in ${browser}`;
    await (await visible('#task-title')).sendKeys(title);
    await (await visible('[data-testid="create-task"]')).click();
    await waitFor(async () => (await driver.findElements(By.css('#task-list li'))).length === 1, 'Created task must appear');
    assert.equal(await (await visible('#task-list li span')).getText(), title);
    assert.equal(await driver.findElement(By.id('task-title')).getAttribute('value'), '');
    await (await visible('[data-action="toggle"]')).click();
    await waitFor(async () => (await driver.findElement(By.css('#task-list li span')).getAttribute('class')).split(/\s+/).includes('complete'), 'Task must become complete');
    await driver.navigate().refresh();
    await visible('#tasks-page');
    await visible('#task-list li span.complete');
    assert.equal(await driver.findElement(By.css('#task-list li span')).getText(), title);
    assert.equal(await driver.findElement(By.css('[data-action="toggle"]')).getText(), 'Reopen');

    await (await visible('[data-action="delete"]')).click();
    await visible('#empty-state');
    assert.equal((await driver.findElements(By.css('#task-list li'))).length, 0);
    await driver.navigate().refresh();
    await visible('#tasks-page');
    await visible('#empty-state');
    assert.equal((await driver.findElements(By.css('#task-list li'))).length, 0);
    await (await visible('#logout-button')).click();
    await visible('#login-page');
    assert.equal(await driver.executeScript('return sessionStorage.getItem("token")'), null);
    await driver.navigate().refresh();
    await visible('#login-page');
    assert.equal(await driver.findElement(By.id('tasks-page')).isDisplayed(), false);
    assert.equal(await driver.findElement(By.id('error')).getText(), '');
  } catch (error) {
    failures.push(error.message);
  } finally {
    if (token) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(baseUrl + '/tasks', { headers, signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200, 'Cleanup must list the test user tasks');
        for (const task of await response.json()) {
          const deleted = await fetch(`${baseUrl}/tasks/${task.id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(10000) });
          assert.equal(deleted.status, 204, 'Cleanup must delete the test task');
        }
      } catch (error) { failures.push(`Cleanup: ${error.message}`); }
    }
    if (driver) {
      try { await driver.quit(); } catch (error) { failures.push(`Browser shutdown: ${error.message}`); }
    }
  }
  result.durationMs = Date.now() - started;
  if (failures.length) result.errors = failures;
  else result.status = 'passed';
  return result;
}

async function main() {
  const browsers = parseBrowsers(process.env.SELENIUM_BROWSERS);
  const report = path.resolve(__dirname, '../reports/selenium/results.json');
  await mkdir(path.dirname(report), { recursive: true });
  const results = [];
  await writeFile(report, JSON.stringify({ status: 'running', results }, null, 2) + '\n');
  let server;
  try {
    let baseUrl = process.env.BASE_URL;
    if (baseUrl !== undefined) {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash) throw new Error('BASE_URL must be an HTTP(S) URL without a query or fragment');
      baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      server = createApp().listen(0, '127.0.0.1');
      await once(server, 'listening');
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    }
    for (const browser of browsers) {
      console.log(`Selenium: running ${browser} smoke workflow`);
      const result = await runSmoke(browser, baseUrl);
      results.push(result);
      console.log(`Selenium ${browser}: ${result.status}${result.version ? ` (${result.version})` : ''}`);
      if (result.errors) console.error(result.errors.join('\n'));
      await writeFile(report, JSON.stringify({ status: 'running', results }, null, 2) + '\n');
    }
    const status = results.every(result => result.status === 'passed') ? 'passed' : 'failed';
    await writeFile(report, JSON.stringify({ status, results }, null, 2) + '\n');
    if (status === 'failed') process.exitCode = 1;
    console.log(`Selenium report: ${report}`);
  } catch (error) {
    await writeFile(report, JSON.stringify({ status: 'failed', error: error.message, results }, null, 2) + '\n');
    throw error;
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
}

if (require.main === module) main().catch(error => {
  console.error(`Selenium runner: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { parseBrowsers, runSmoke };
