# Configuration and troubleshooting

Start with the [quick start](../README.md#quick-start). Node.js 24 matches CI; `.nvmrc` records that major for version managers. `npm ci` installs the locked dependencies. The first browser run may need network access for uncached binaries; restricted environments must provision the required browsers and drivers.

## Environment variables

| Variable | Used by | Default and behavior |
| --- | --- | --- |
| `PORT` | `npm start` | `3000`; server binds to `127.0.0.1` |
| `BASE_URL` | Newman, Cypress, Selenium, visual runners | Unset: start an isolated local server. Exported: use the given HTTP(S) URL and leave its server running. Queries/fragments are rejected. |
| `SELENIUM_BROWSERS` | Selenium runner | `chrome,firefox`; accepts either or both |
| `VISUAL_CHROME_VERSION` | `visual:update` | Unset: detected Chrome. Set: request that browser version. Comparison always uses the baseline manifest. |
| `AI_MODE` | `visual:review`, `bugs:review` | `offline`; `online` explicitly enables the configured provider request |
| `OPENAI_API_KEY` | Online review commands | Required only for a model call |
| `OPENAI_MODEL` | Online review commands | Required for a model call; must be available to the account and support structured outputs, plus image input for visual review |
| `QA_RUN_ID` | Single-suite wrapper / CI | Generated if absent; CI supplies run ID and attempt. The full local runner creates its own shared ID. |

`npm start`, `visual:review`, and `bugs:review` load `.env` if present. The test runners read **exported process variables**, not `.env`. Exported values take precedence in commands that load the file. Setting `BASE_URL` in `.env` alone does not redirect tests. The `baseUrl` collection variable in Postman is configured separately.

To create a local configuration, copy the example (keep your existing `.env` if you have one):

```sh
cp .env.example .env
```

Edit the file locally; `.env` is ignored by Git. Keep `AI_MODE=offline` for local evidence-only reports. Choose a model available to your account. Automatic test reports remain offline even when online review is configured.

The examples below use a POSIX shell. In PowerShell, set a variable with `$env:BASE_URL = 'http://127.0.0.1:3000'`, run the command, then remove it with `Remove-Item Env:BASE_URL`.

```sh
PORT=3001 npm start
BASE_URL=http://127.0.0.1:3001 npm run test:suite -- postman
SELENIUM_BROWSERS=firefox npm run test:selenium
```

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| `EADDRINUSE` from `npm start` | Stop the process already using the port or choose a different `PORT`. Automated runners use available temporary ports by default. |
| Connection failure with `BASE_URL` | Confirm the target server is running and the URL/port is correct. Unset `BASE_URL` to return to an isolated local server. |
| Cypress binary missing | Run `npx --no-install cypress install`; ensure dependency install scripts were not blocked. |
| Cypress `bad option: --smoke-test` | Remove an inherited `ELECTRON_RUN_AS_NODE` setting: `env -u ELECTRON_RUN_AS_NODE npm run test:e2e` or `npm run test:all`. |
| Browser or driver download fails | Check network access and Selenium Manager's cache. Use a downloadable Chrome for Testing build for visual baselines. Browser launch failures are test failures, not skipped coverage. |
| Missing visual baseline / metadata mismatch | Check OS, architecture, viewport, and the manifest. Follow the [baseline review workflow](../qa/visual/README.md) when the change is intentional. |
| Pixel mismatch on a hosted runner | Download the QA artifact and inspect baseline/current/diff images. Native fonts and controls can differ across OS updates even with the same browser. |
| Semantic review reports stale evidence | Rerun `test:visual`, then review before overwriting any of its images or reports. |
| Bug review has no recorded result | Use `npm run test:suite -- <suite>` first. Direct test commands do not create wrapper run records. |
| Online review is pending or errors | Check `AI_MODE`, credentials, model access, and the generated review error. Offline reports leave AI review pending. |
| A test log contains errors but the suite passed | Negative tests intentionally exercise failures. Use the process exit code and final suite status, not keyword searches in the output. |

Reports and current/diff images are replaced during runs. Save evidence you need before rerunning. Passing suite reruns clear only that suite's stale bug draft. Match run IDs and timestamps when inspecting results left by interrupted runs.

## Platform and product limits

The browser workflows use Chrome/Firefox via Selenium and Electron via Cypress; Safari is not included. The checked-in visual baseline targets macOS 15 ARM64. Do not assume pixel equality across platforms, fonts, or browser versions. Linux browser dependencies and download access must be supplied by the host environment.

TaskTracker stores data and sessions in memory, uses a shared demo password, and has no production identity verification. Test usernames are isolated, but anyone using the same username and demo password accesses that identity's tasks. Use this project as a testing demonstration.

AI triage is advisory and may be incorrect. Review redacted evidence before external submission; filtering does not guarantee removal of every sensitive value, and ordinary console logs are not rewritten by bug-report redaction. See the [failure-report limits](../qa/bugs/README.md) and [visual-review limits](../qa/visual/README.md#semantic-diff-review).
