# Contributing

Use Node.js 24 (`nvm use` if available), install with `npm ci`, and follow the [quick start](README.md). All commands run from the repository root. Read the [configuration guide](docs/configuration.md) before changing browser or AI settings.

## Make and verify a change

1. Keep the API implementation, [OpenAPI contract](app/openapi.yaml), and affected tests consistent. The demo intentionally allows duplicate titles and keeps task owners isolated.
2. Run the relevant suite while developing. Use `npm run test:suite -- <suite>` for failure drafts, choosing `unit`, `postman`, `cypress`, `selenium`, or `visual`.
3. Run `npm run test:all` before handing off the change on a supported baseline environment. It attempts every suite and preserves failure status. If a platform or provider limitation prevents verification, report exactly what was and was not tested.
4. Inspect `git diff --check`, the changed files, and generated reports. Include relevant validation in the commit/PR description. Commit only when you choose to do so.

Use isolated test users and clean up their tasks. Prefer explicit waits for observable state over fixed delays. Add tests for meaningful behavior and failure handling rather than duplicating the implementation.

## Generated and reviewed assets

- Edit `qa/postman/generate-edge-cases.js`, then run `node qa/postman/generate-edge-cases.js` and check in the resulting collection with the source change. Update its generation brief if the scope changes.
- Keep Cypress suggestion IDs and their documentation aligned. Selector recovery must remain scoped and unambiguous; new rules need rejection checks as well as successful recovery checks.
- Update visual baselines only for an intentional, inspected change. Use a downloadable Chrome for Testing version, review all images and the manifest, and rerun comparison. Never regenerate baselines in CI.
- Keep generated logs, reports, current images, diffs, credentials, and installed dependencies out of commits. Baseline PNGs and manifests belong in version control.
- AI assessments must remain advisory. Do not turn a model response into a passing test verdict, automated baseline approval, or published issue.

## CI maintenance

The workflow is [.github/workflows/qa.yml](.github/workflows/qa.yml). It uses Node.js 24 and macOS 15 ARM64, runs each suite through the evidence wrapper, and uploads reports even on failure. Keep action versions pinned to reviewed commit SHAs. Validate workflow edits with `actionlint` when available and inspect the next hosted run; local validation cannot prove hosted image equivalence.

The default checks require no OpenAI secrets. Online integrations are covered with mocked responses; manually requesting a live review requires appropriate credentials and model access. Do not describe mock-only validation as a successful live provider test.
