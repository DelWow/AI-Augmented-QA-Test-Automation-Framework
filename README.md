# AI-Augmented QA Test Automation Framework

TaskTracker is a small Express API and browser app for demonstrating API, end-to-end, cross-browser, and visual testing. The framework combines baseline tests with AI-authored edge cases, constrained selector recovery, and optional AI review of visual differences and failure evidence.

Routine tests run without an AI key. AI output is advisory: it never changes test verdicts, approves baselines, or publishes issues.

## Quick start

Use Node.js 24 to match CI; the package also accepts Node.js 22 and 26+. From the repository root:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:3000**. Log in with any nonempty username and `demo-password`. You can create, complete, reopen, and delete tasks. Stop the server with Ctrl+C. No `.env` file is required for the demo or ordinary tests.

This is an in-memory demo: restarting clears all tasks and sessions. The shared demo password is not production authentication. A username identifies the same task owner across logins; duplicate task titles are allowed.

![TaskTracker with active and completed tasks](qa/visual/baseline/darwin-arm64/populated-tasks.png)

## Run tests

In another terminal, run:

```sh
npm run test:all
```

Each browser/API suite starts its own temporary localhost server by default. The full runner attempts every suite, records a shared run ID, creates drafts for failures, and exits nonzero if any suite fails. A separately running `npm start` instance is not required.

The first install/run may download Cypress, browser drivers, or browsers. The checked-in visual baseline targets **macOS 15 ARM64** with its recorded Chrome for Testing version. Other platforms can run the other suites, but the full suite requires an explicitly captured and reviewed visual baseline for their platform. See the [visual baseline workflow](qa/visual/README.md).

| Command | Purpose |
| --- | --- |
| `npm test` | Node unit and runner checks |
| `npm run test:api` | Both Postman collections through Newman |
| `npm run test:e2e` | Baseline, AI-suggested, and selector-recovery Cypress specs |
| `npm run test:e2e:open` | Interactive Cypress runner with a temporary server |
| `npm run test:selenium` | Headless Chrome and Firefox smoke workflows |
| `npm run test:visual` | Screenshot comparison and offline semantic summary |
| `npm run test:all` | Every suite, with evidence capture and failure drafts |
| `npm run test:suite -- postman` | One suite with evidence capture; accepts `unit`, `postman`, `cypress`, `selenium`, or `visual` |
| `npm run visual:update` | Explicitly replace the current platform's visual baseline; inspect the images before committing |
| `npm run visual:review` | Review the latest visual evidence; offline unless configured for online mode |
| `npm run bugs:review -- postman` | Review the selected suite's latest recorded failure |

Direct commands such as `test:api` do not create suite-level bug drafts; use `test:suite` or `test:all` for that. See the [testing guide](docs/testing.md) for coverage, Postman import instructions, external servers, and CI behavior.

## Where AI fits

| Feature | What runs |
| --- | --- |
| Postman edge cases | Checked-in AI-authored cases, rebuilt by an offline script |
| Cypress suggestions | Ranked AI-authored proposals with five implemented cases |
| Selector recovery | Offline rules for three button intents; ambiguous or incorrect matches fail |
| Visual semantic review | Optional OpenAI image assessment of hash-verified comparison evidence |
| Bug triage | Optional OpenAI text assessment of redacted failure evidence |

Automatic tests and CI stay offline. To request online review, configure a local `.env` using [.env.example](.env.example), then invoke the relevant review command. Online provider behavior is tested with mocks; live calls require model access and credentials. See [configuration](docs/configuration.md) and the [review limitations](qa/visual/README.md#semantic-diff-review).

## Project map

```text
app/                     Express API, OpenAPI contract, and browser UI
qa/unit/                 API, runner, comparator, and review tests
qa/postman/              Baseline and AI edge-case collections
qa/cypress/              Browser specs, intent rules, and generation briefs
qa/selenium/             Chrome/Firefox smoke runner
qa/visual/               Tracked baselines, capture/comparison, semantic review
qa/bugs/                 Failure drafts and optional AI triage
qa/reports/              Generated evidence; ignored by Git
.github/workflows/qa.yml Full-suite CI workflow
```

The API contract is [app/openapi.yaml](app/openapi.yaml) (JSON syntax, valid YAML). The UI and API are served by the same process. Tests use fresh demo identities to avoid changing other users' data; interrupted external-server runs may leave test tasks behind.

## Results and CI

Reports live under `qa/reports/`: Postman JUnit XML, Selenium JSON, Cypress failure screenshots and recovery logs, visual comparison/semantic-review reports, suite run records, and failure drafts. Current visual images and diffs live under `qa/visual/current/` and `qa/visual/diffs/`. These are generated files; baseline PNGs and manifests are tracked.

The `QA` GitHub Actions workflow runs on pushes, pull requests, and manual dispatch with Node.js 24 on macOS 15 ARM64. Every test stage runs after earlier test failures, and failures still fail the job. Reports and image evidence are uploaded for 14 days. No additional AI secrets are required. Inspect the first hosted run after pushing; local success alone does not establish hosted pixel equivalence.

## Documentation

- [Testing guide](docs/testing.md)
- [Configuration and troubleshooting](docs/configuration.md)
- [Contributing and maintaining baselines](CONTRIBUTING.md)
- [Postman generation brief](qa/postman/edge-cases.prompt.md)
- [Cypress test suggestions](qa/cypress/test-suggestions.md)
- [Selector-recovery rules](qa/cypress/selector-recovery.md)
- [Visual baseline and semantic-review workflow](qa/visual/README.md)
- [Failure-report workflow](qa/bugs/README.md)
- [Completed implementation checklist](TODO.md)
