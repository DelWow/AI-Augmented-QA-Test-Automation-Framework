# AI-assisted selector recovery

Codex authored the intent rules in `support/selector-intents.js` for step 10 using the frontend markup, event handlers, and existing Cypress workflows. AI assistance happens when proposing and reviewing these rules. Runtime recovery is deterministic and offline: it does not call a model, send DOM data to a service, or rewrite selectors in source files.

## Generation brief

Propose narrowly scoped selector alternatives for the login, add-task, and logout buttons. Preserve their user-visible meaning using their enclosing form/section, button type, and exact normalized text. Prefer existing stable selectors. Recover only when the primary selector is absent and one visible alternative matches all constraints. Reject ambiguity and conflicting primary matches. Keep Cypress retry and actionability checks intact, and record recovery so passing tests still expose selector drift. Do not recover task-row actions by title because duplicate titles are allowed.

## Rules and use

| Intent | Scope | Primary | Alternative with exact text |
| --- | --- | --- | --- |
| `login` | `#login-form` | `#login-button` | `button[type="submit"]`, `Log in` |
| `createTask` | `#task-form` | `[data-testid="create-task"]` | `button[type="submit"]`, `Add task` |
| `logout` | `#tasks-page` | `#logout-button` | `button`, `Log out` |

Use `cy.byIntent('createTask').click()` for application controls. `cy.get(root).findByIntent('createTask')` restricts lookup to a supplied root. The existing baseline and AI-suggested specs now use the three registered intents. Other selectors and all behavioral assertions remain explicit.

Queries retry against the current DOM using Cypress's custom-query mechanism. A unique primary must still have the expected tag, type, text, and visibility. If the primary exists but violates those conditions, recovery is rejected. Missing or ambiguous scopes, missing/ambiguous alternatives, and unknown intent names also fail. Lookup preserves disabled state; normal Cypress actions enforce actionability without forced clicks. Text comparisons normalize whitespace but do not use fuzzy matching.

Pass `{ strict: true }` to require the primary selector, for example `cy.byIntent('login', { strict: true })`. The current scope and button text are part of the test contract: changes to either require review of the rules. Recovery is not intended to infer a new product workflow.

## Evidence and review

Recoveries appear in Cypress's Command Log and are recorded after each test in `qa/reports/cypress/selector-recovery.jsonl`. Entries identify the spec, test, intent, scope, and selectors, without input values or session tokens. Repeated query retries produce one record per lookup. Headless runs reset the report at startup; interactive runs append records until the file is removed. A run without recovery produces no report. An interrupted test process may not flush its records.

Review recovery records when maintaining selectors, even when a suite passes. The rules are AI-authored proposals checked into the repository; adding a new intent requires reviewing its scope and ambiguity risks and adding appropriate verification.

`e2e/selector-recovery.cy.js` changes selectors in the test browser and verifies real login, creation, and logout through recovered controls. It also checks primary precedence, delayed rendering, strict mode, disabled controls, and rejection of missing, hidden, ambiguous, wrong-scope, and incorrect candidates. DOM changes are test-local; the application source is not modified. Run all checks with `npm run test:all` or browser checks with `npm run test:e2e`.
