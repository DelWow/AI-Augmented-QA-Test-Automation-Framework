# AI-assisted failure drafts

`npm run test:all` runs every suite through `qa/run-suite.js`, even after a suite fails. It retains an overall nonzero exit code if any suite fails. CI uses the same wrapper for each test step, preserving separate step results and uploading the generated drafts with the existing QA artifact.

For an individual suite with reporting, use:

```sh
npm run test:suite -- unit
npm run test:suite -- postman
npm run test:suite -- cypress
npm run test:suite -- selenium
npm run test:suite -- visual
```

The existing direct commands such as `npm test` and `npm run test:e2e` still run their tests without this wrapper. Failures are determined by the subprocess exit code, not words such as “error” in output. Expected negative tests in a passing suite therefore produce no bug draft. These are suite-level drafts; the captured output identifies individual assertions where available.

## Evidence and reports

Each wrapper invocation writes `qa/reports/runs/<suite>.json` with a run ID, command outcome, signal, timings, environment, and a bounded redacted output tail. A failure also writes `qa/reports/bugs/<suite>.json` and `.md`: reproduction command, expected/actual result, captured evidence, and its SHA-256 hash. Reproduce with the recorded `BASE_URL` and browser settings when relevant. The report describes observed test failure; a product defect or root cause is not assumed.

A passing rerun removes that suite's old draft and replaces its run evidence. Other suites' files are untouched; match run IDs when examining reports. `test:all` shares one run ID across its suites, and CI uses the workflow run ID plus attempt. All generated files are ignored by Git. Interrupted processes may leave an earlier report; check the run ID and timestamp. Installation failures before a suite launches remain CI setup failures, not test-derived bug reports.

Output capture retains at most the last 64,000 characters, and drafts include the last 12,000 after redaction. Configured key/token/secret/password values, bearer credentials, common credential fields, API-key patterns, URL credentials, and UUID session IDs are redacted. This is best-effort filtering: inspect reports before sharing or requesting online triage. The wrapper streams the original console output as before; existing CI console logs are not rewritten by this redaction.

## Optional online assistance

Automatic generation is always offline and uses no API key. Its draft has `ai.status: pending`, with no invented severity or diagnosis. For a specific failed suite, set `AI_MODE=online`, `OPENAI_API_KEY`, and `OPENAI_MODEL` in your local `.env`, then run:

```sh
npm run bugs:review -- postman
```

This command loads `.env` (exported variables take precedence) and reads the selected suite's latest run evidence. It sends the redacted text evidence—not screenshots, raw report directories, or environment secrets—to OpenAI's Responses API. Use a model available to your account that supports structured outputs. Requests use `store: false`, a 60-second timeout, and no automatic retry.

The model supplies an advisory summary, category (`product`, `test`, `environment`, or `uncertain`), explicitly unconfirmed hypothesis, and suggested checks. Evidence and the test exit code remain authoritative. Invalid output, refusals, and API failures preserve the evidence draft with `ai.status: error`; `bugs:review` then exits nonzero. No fallback response is presented as a model assessment. Online integration is tested with mocked responses; live results depend on credentials and model access.

The prompt in `report.js` treats logs as untrusted data and forbids invented evidence or automatic fixes. Markdown escapes model text. Neither mode publishes an issue, posts a comment, changes test results, approves visual baselines, or commits files. Review drafts before manually filing bugs. The independent `bugs:review` exit code indicates report generation, not whether the source test passed.
