# AI-generated Cypress suggestions

Codex authored these suggestions and their implementations for step 9 using the baseline Cypress spec, `app/public/app.js`, `app/public/index.html`, `app/server.js`, and `app/openapi.yaml`. This is a checked-in AI-authored artifact; no external model API was called and no runtime AI service is required.

## Generation brief

Suggest browser scenarios that add coverage beyond the four baseline workflows. Prioritize user data isolation, safe rendering, authentication recovery, and failures that may lose or duplicate user work. Use the existing application contract to define expected behavior. Rank suggestions by impact and coverage gap, select the top five, and implement them against the real UI and API. Use a narrowly scoped intercept only when a failure cannot be triggered through the demo's public interface. Keep test users isolated, clean up their tasks, use request-based synchronization, and verify persistence after reload where relevant. Do not implement selector self-healing or visual regression in this step.

## Ranked suggestions

| ID | Priority | Scenario and expected result | Status |
| --- | --- | --- | --- |
| AI-01 | High | Create tasks under two accounts, switch between them, and reload. Each account sees only its own tasks; logout clears the prior list. | Implemented |
| AI-02 | High | Save an HTML-like title with an event handler. It remains literal text before and after reload, creates no image element, and executes no handler. | Implemented |
| AI-03 | High | Replace browser session storage with an invalid token and reload. A real 401 clears the token and task list; logging in again restores access to the user's saved task. | Implemented |
| AI-04 | High | Fail one create request with HTTP 503. The UI displays the error and preserves input; a real retry creates exactly one persisted task and clears the error. | Implemented |
| AI-05 | Medium | Create two identical titles and act on specific rows. Completing one and deleting the other changes only the selected task IDs, including after reload. | Implemented |
| AI-06 | Medium | Exercise the browser's 200-character input limit with ASCII and emoji, then compare the submitted/stored title. | Deferred: API length coverage already exists; browser limit coverage is a useful follow-up. |
| AI-07 | Medium | Submit a task rapidly while a save is delayed. Define whether the UI should block repeat submissions, then verify that policy. | Deferred: duplicate titles are allowed and the UI has no defined in-flight submission policy. |
| AI-08 | Medium | Complete a workflow with keyboard-only navigation and at a narrow viewport; check focus and control reachability. | Deferred: broader accessibility/responsive coverage beyond the selected five. |

## Implementation and validation

The five cases live in `e2e/ai-suggestions.cy.js`, with IDs in their test names for traceability. Run them along with the baseline using `npm run test:e2e`, or select the spec in `npm run test:e2e:open`.

All cases use unique users and real sessions. Cleanup keeps the tokens for every account used, including after logout or session-storage replacement. AI-04 stubs exactly one response with `cy.intercept`; the retry, persistence checks, and cleanup use the real API. Its result demonstrates recovery from a rejected save, not the ambiguous case where a server accepts a write and the response is lost. AI-02 checks this specific DOM-injection regression and is not a complete security assessment.

Revisit the rankings and assertions when the product behavior changes. The brief supports future AI-assisted review; these files do not automatically generate new tests.
