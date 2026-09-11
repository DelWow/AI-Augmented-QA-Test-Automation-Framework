# Testing

Run commands from the repository root after `npm ci`. Use Node.js 24 to match CI. Browser runners start and stop a temporary server unless you export `BASE_URL`:

```sh
BASE_URL=http://127.0.0.1:3000 npm run test:api
```

An external server must already be running. Test runners read exported variables, so setting `BASE_URL` in `.env` alone has no effect. Tests use unique usernames and clean up their tasks; interrupted runs may leave data on an external server.

## Full suite

```sh
npm run test:all
```

This runs Node tests, both Postman collections, Cypress, Selenium, and visual checks. It attempts every suite and exits nonzero if any fails. All suites share a run ID for matching reports.

For one suite with the same evidence capture and failure reporting:

```sh
npm run test:suite -- postman
```

Accepted suite names are `unit`, `postman`, `cypress`, `selenium`, and `visual`. Direct commands such as `npm test` and `npm run test:api` skip this reporting wrapper.

## API tests

`npm run test:api` runs two Postman collections through Newman:

| Collection | Requests | Coverage |
| --- | --- | --- |
| Baseline | 13 | Authentication, task CRUD, validation, and persisted updates |
| Edge cases | 73 | Field boundaries and types, UTF-16 length, whitespace, duplicate titles, invalid IDs, JSON body limits, and account isolation |

Both collections run even if one fails. Request timeouts are 10 seconds, script timeouts are 5 seconds, and each collection has a 2-minute limit. JUnit reports are saved to `qa/reports/postman/`.

To use Postman directly:

1. Start the app with `npm start`.
2. Import either collection from `qa/postman/`.
3. Set the collection's `baseUrl` if needed; it defaults to `http://127.0.0.1:3000`.
4. Run the whole collection in order, including login and cleanup. No Postman environment is required.

After editing `qa/postman/generate-edge-cases.js`, rebuild the edge-case collection with:

```sh
node qa/postman/generate-edge-cases.js
```

The generator serializes the cases already defined in the script. The [generation brief](../qa/postman/edge-cases.prompt.md) records their scope.

## Cypress

`npm run test:e2e` runs 15 tests across three specs in headless Electron:

- Four baseline tests cover login, task CRUD, reload persistence, logout, and validation.
- Five [additional scenarios](../qa/cypress/test-suggestions.md) cover account isolation, literal HTML-like titles, invalid sessions, a failed-save retry, and duplicate-title handling.
- Six [selector-recovery tests](../qa/cypress/selector-recovery.md) cover fallback lookups and rejected matches.

Tests use the real API except for one intercepted HTTP 503 response in the failed-save scenario. They wait for network or DOM state instead of fixed delays.

Use `npm run test:e2e:open` to select specs interactively. Close Cypress to stop the temporary server. Failed headless tests save screenshots under `qa/reports/cypress/screenshots/`; video is disabled. Recovery events go to `qa/reports/cypress/selector-recovery.jsonl`.

For missing binaries or Electron launch errors, see [troubleshooting](configuration.md#troubleshooting).

## Selenium

`npm run test:selenium` runs the same smoke workflow in headless Chrome and Firefox: login, create a task, complete it, delete it, and log out, with reload checks for persistence. Each browser gets a fresh session and user.

To run one browser:

```sh
SELENIUM_BROWSERS=firefox npm run test:selenium
```

Selenium Manager resolves browsers and drivers, downloading uncached binaries when needed. Every selected browser is attempted; launch, test, cleanup, and shutdown failures fail the run. Browser versions, durations, and errors are recorded in `qa/reports/selenium/results.json`.

## Visual tests

`npm run test:visual` captures four states: login, empty tasks, populated tasks, and a validation error. It compares them against the current platform's baseline using the Chrome version recorded in its manifest.

The checked-in baseline targets macOS 15 ARM64. Missing baselines, metadata mismatches, and pixel differences fail the check. Read the [visual guide](../qa/visual/README.md) before updating images or requesting an optional semantic review.

## Reports and CI

Suite records are saved under `qa/reports/runs/`; failed suites also get drafts under `qa/reports/bugs/`. Passing reruns remove that suite's old draft. Reports are overwritten, so save evidence before rerunning and check run IDs when comparing files. See [failure reporting](../qa/bugs/README.md) for draft contents and optional AI triage.

The `QA` workflow in `.github/workflows/qa.yml` runs on pushes, pull requests, and manual dispatch. It uses Node.js 24 on macOS 15 ARM64, installs locked dependencies, and runs each suite through the reporting wrapper. Later test stages still run after a test failure, and the job remains failed.

The workflow uploads `qa-evidence-<run-id>-<attempt>` with logs, reports, failure screenshots, baselines, current images, and diffs for 14 days. It has read-only repository permissions, pinned action SHAs, a 30-minute timeout, and cancels older runs for the same ref. AI review stays offline.

Inspect hosted visual failures using the uploaded images. OS updates can change fonts and native controls even with a pinned browser version; local pixel equality does not guarantee the same result on a hosted runner.
