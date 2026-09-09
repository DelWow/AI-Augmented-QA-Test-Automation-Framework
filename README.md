# AI-Augmented QA Test Automation Framework

TaskTracker is a small application used to demonstrate API, browser, cross-browser, and visual testing with optional Claude-assisted test generation, selector recovery, and failure analysis.

## Baseline API checks with Postman

1. Install Node.js 22, 24, or 26+ (supported by Cypress 16), then run `npm ci` and `npm start`.
2. Import `qa/postman/baseline.postman_collection.json` into Postman.
3. The collection's `baseUrl` defaults to `http://127.0.0.1:3000`. Change it if the server uses a different port; omit the trailing slash. No Postman environment is required.
4. Run the entire collection in order using Collection Runner. Keep all requests selected so login, task creation, and cleanup run together.

The 13 requests check missing authentication, invalid credentials, login, an empty initial list, missing-title validation, and task creation, reading, listing, updating, and deletion. Assertions check status codes and response bodies, including persisted updates and a 404 after deletion.

Each iteration creates a unique demo username and uses `demo-password`. The token and task ID are captured automatically in run-local variables. Successful runs delete their task; an interrupted run may leave a task in memory. Restarting the server clears all tasks and sessions. Avoid environment or data-file variables named `baseUrl` unless intentionally overriding the collection URL.

## AI-generated Postman edge cases

Import `qa/postman/ai-edge-cases.postman_collection.json` and run the whole collection in order using the same server and `baseUrl` setup above. It runs independently of the baseline collection and requires no API key or Postman environment.

The cases cover username/title boundaries (including UTF-16 length), whitespace, invalid types and fields, duplicate titles, completion updates, invalid IDs, JSON parsing and body limits, and ownership isolation. They also check that rejected writes preserve data and that successful runs clean up their tasks.

The cases and assertion scripts were AI-authored from the API contract and implementation. The [generation brief](qa/postman/edge-cases.prompt.md) records their scope and provenance. To rebuild the checked-in collection offline after editing the cases, run:

```sh
node qa/postman/generate-edge-cases.js
```

This script serializes the reviewed cases; it does not call a model or generate new suggestions at runtime.

## Run Postman collections with Newman

After `npm ci`, run:

```sh
npm run test:api
```

This starts an isolated TaskTracker server on an available localhost port, runs the baseline and AI edge-case collections sequentially, and closes the server afterward. No separate `npm start` or API key is needed. Both collections run even if one fails; assertion, script, and request failures produce a nonzero exit code. Requests time out after 10 seconds, scripts after 5 seconds, and each collection after 2 minutes.

To test an already running server, export `BASE_URL` for the command:

```sh
BASE_URL=http://127.0.0.1:3000 npm run test:api
```

The runner reads `BASE_URL` from the process environment, not from `.env`. When set, it uses that server without starting or stopping it. Collections create unique demo users and delete their tasks on successful runs; interrupted runs may leave data in the target server.

Console results and JUnit XML reports are produced for each collection at `qa/reports/postman/baseline.xml` and `qa/reports/postman/ai-edge-cases.xml`. Reports are overwritten on subsequent runs and ignored by Git. Use `npm test` for unit checks, or `npm run test:all` to run unit checks, both full collections, Cypress E2E tests, Selenium smoke tests, and visual regression checks.

## Baseline browser tests with Cypress

After `npm ci`, run `npm run test:e2e`. The runner starts an isolated TaskTracker server on an available localhost port, runs the baseline, AI-suggested, and selector-recovery specs in headless Electron, and shuts down the server. Cypress downloads its browser binary during installation; if install scripts were disabled, run `npx cypress install` first.

The tests cover login failure and recovery, task creation/completion/reopening/deletion with reload persistence, logout persistence, and title validation with recovery. They exercise the real frontend and API, wait for network responses instead of fixed delays, and use a unique user per test. An after-test cleanup removes that user's tasks, including when a UI assertion fails; interrupted runs may still leave data on an external server.

Use `npm run test:e2e:open` for the interactive Cypress runner and close it when finished to stop the temporary server. To target an existing server, run `BASE_URL=http://127.0.0.1:3000 npm run test:e2e` (or `test:e2e:open`). As with Newman, the runner reads the exported variable, not `.env`, and leaves external servers running.

Results appear in the terminal. Failed headless tests save screenshots under `qa/reports/cypress/screenshots/`, which Git ignores; video recording is disabled. Test failures, launch errors, and runs with no tests return a nonzero exit code. The configuration is in `cypress.config.js` and the baseline spec is `qa/cypress/e2e/tasktracker.cy.js`.

If a terminal inherited `ELECTRON_RUN_AS_NODE` from an Electron-based editor and Cypress reports `bad option: --smoke-test`, unset that variable before running Cypress. On macOS/Linux, use `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`.

## AI-suggested browser coverage

The [ranked suggestions and generation brief](qa/cypress/test-suggestions.md) document eight AI-authored proposals and why five were selected. Their implementation is in `qa/cypress/e2e/ai-suggestions.cy.js`: account isolation, literal HTML-like titles, invalid-session recovery, retrying a rejected save, and independent actions on duplicate titles. They run automatically with the baseline and require no AI credentials. Only the single failed-save response is stubbed; the remaining requests use the real API.

## AI-assisted selector recovery

The login, add-task, and logout lookups use `cy.byIntent(...)`. If a primary selector disappears, an AI-authored rule can recover a unique visible button with the expected scope, type, and exact text. Ambiguous or incorrect matches fail, and normal click/actionability checks still apply. This uses reviewed offline rules, with no runtime AI call.

Recovery details appear in the Cypress Command Log and `qa/reports/cypress/selector-recovery.jsonl`. Six verification tests cover intentional selector changes and rejection conditions. See the [rules, generation brief, and strict-mode usage](qa/cypress/selector-recovery.md) for maintenance guidance.

## Selenium cross-browser smoke tests

Run `npm run test:selenium` after `npm ci`. The runner starts an isolated local API and runs the same smoke workflow sequentially in headless Chrome and Firefox, each with a fresh browser session and unique user. It verifies login, an empty task list, creation, completion persisted through reload, deletion persisted through reload, and logout persisted through reload. DOM conditions use explicit waits; no fixed sleeps or mocked API responses are used.

[Selenium Manager](https://www.selenium.dev/documentation/selenium_manager/) resolves browser drivers and can download missing Chrome/Firefox browsers into its cache. The first run needs network access for uncached binaries; restricted environments should provision compatible browsers and drivers beforehand. Browser launch failures fail the run rather than silently skipping coverage.

To narrow a local run or use an existing server:

```sh
SELENIUM_BROWSERS=chrome npm run test:selenium
BASE_URL=http://127.0.0.1:3000 SELENIUM_BROWSERS=chrome,firefox npm run test:selenium
```

Only `chrome` and `firefox` are accepted. `BASE_URL` is read from the exported environment, not `.env`; external servers remain running. Cleanup deletes only the unique user's tasks and quits each browser even after an assertion fails. Interrupted runs may leave tasks on external servers.

The runner attempts every selected browser and returns a nonzero exit code if any workflow, launch, cleanup, or browser shutdown fails. Results, browser versions, durations, and errors are written to `qa/reports/selenium/results.json`, which is ignored by Git. The report is reset for each valid browser selection and updated as browsers finish. The implementation is `qa/selenium/run-smoke.js`.

## Visual regression checks

Run `npm run test:visual` to compare four fixed-viewport Chrome screenshots: login, empty tasks, populated tasks, and a validation error. Baselines and capture metadata are stored under `qa/visual/baseline/`; current images, pixel diffs, and the JSON report are ignored by Git. Any detected pixel mismatch, missing baseline, or environment mismatch fails the run.

The initial baseline set is for macOS ARM64 and records the exact Chrome version. On another platform or after a browser change, create and inspect the appropriate baseline explicitly with `npm run visual:update`. Routine checks never update expected images. See the [visual workflow and review instructions](qa/visual/README.md) before updating baselines.
