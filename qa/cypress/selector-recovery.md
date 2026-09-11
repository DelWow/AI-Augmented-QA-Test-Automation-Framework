# AI-assisted selector recovery

The rules in `support/selector-intents.js` were authored with AI assistance. At runtime, Cypress uses those fixed rules to find login, add-task, and logout buttons when a primary selector is missing.

A fallback must match the enclosing scope, button type, and exact normalized text, with exactly one visible candidate. Task-row actions use explicit selectors because duplicate titles are allowed. Recovery leaves source files unchanged.

## Rules and use

| Intent | Scope | Primary | Alternative with exact text |
| --- | --- | --- | --- |
| `login` | `#login-form` | `#login-button` | `button[type="submit"]`, `Log in` |
| `createTask` | `#task-form` | `[data-testid="create-task"]` | `button[type="submit"]`, `Add task` |
| `logout` | `#tasks-page` | `#logout-button` | `button`, `Log out` |

Use `cy.byIntent('createTask').click()` for application controls. `cy.get(root).findByIntent('createTask')` restricts lookup to a supplied root. The baseline and additional specs use the three registered intents. Other selectors and all behavioral assertions remain explicit.

Queries retry against the current DOM using Cypress's custom-query mechanism. A unique primary must still have the expected tag, type, text, and visibility. If the primary exists but violates those conditions, recovery is rejected. Missing or ambiguous scopes, missing/ambiguous alternatives, and unknown intent names also fail. Lookup preserves disabled state; normal Cypress actions enforce actionability without forced clicks. Text comparisons normalize whitespace but do not use fuzzy matching.

Pass `{ strict: true }` to require the primary selector, for example `cy.byIntent('login', { strict: true })`. The current scope and button text are part of the test contract: changes to either require review of the rules. Recovery is not intended to infer a new product workflow.

## Evidence and review

Recoveries appear in Cypress's Command Log and are recorded after each test in `qa/reports/cypress/selector-recovery.jsonl`. Entries identify the spec, test, intent, scope, and selectors, without input values or session tokens. Repeated query retries produce one record per lookup. Headless runs reset the report at startup; interactive runs append records until the file is removed. A run without recovery produces no report. An interrupted test process may not flush its records.

Review recovery records when maintaining selectors, even when a suite passes. When adding an intent, test ambiguous and incorrect matches as well as successful recovery.

`e2e/selector-recovery.cy.js` changes selectors in the test browser and verifies real login, creation, and logout through recovered controls. It also checks primary precedence, delayed rendering, strict mode, disabled controls, and rejection of missing, hidden, ambiguous, wrong-scope, and incorrect candidates. DOM changes are test-local; the application source is not modified. Run all checks with `npm run test:all` or browser checks with `npm run test:e2e`.
