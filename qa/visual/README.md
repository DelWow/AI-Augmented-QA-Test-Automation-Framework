# Visual regression baselines

Run `npm run test:visual` to capture and compare four viewport screenshots against checked-in PNGs:

| State | What is captured |
| --- | --- |
| `login` | Login form before entering credentials |
| `empty-tasks` | Authenticated task page with an empty list |
| `populated-tasks` | One active task and one completed task, with fixed titles |
| `validation-error` | The populated page after submitting a whitespace-only title |

The runner uses headless Chrome through Selenium, a 1280×800 viewport at device scale 1, sRGB colors, and light/reduced-motion media preferences. It waits for the expected DOM state, loaded fonts, and two animation frames, and removes input focus before capture. It starts an isolated local API by default and uses a unique user. Export `BASE_URL` to use an existing server; `.env` is not read. Cleanup deletes the test user's tasks and closes the browser and any server started by the runner.

## Review results

- `baseline/<platform>-<architecture>/`: tracked expected images and capture manifest.
- `current/<platform>-<architecture>/`: newly captured images, ignored by Git.
- `diffs/<platform>-<architecture>/`: pixel diffs for same-size mismatches, ignored by Git.
- `../reports/visual/results.json`: capture metadata, per-state results, and errors, ignored by Git.

The initial baselines target macOS on ARM64 (`darwin-arm64`). The manifest records the exact Chrome version, platform/architecture, viewport, and state list. Comparison rejects mismatched metadata to distinguish an environment change from a UI regression. System fonts and native controls can vary by OS release as well; use a consistent OS/browser environment for reliable results.

Pixelmatch uses a per-pixel color threshold of 0.1 and ignores detected anti-aliasing differences. Any remaining changed pixel fails the check; there is no allowed percentage of changed pixels. Dimension mismatches and missing baselines also fail. Same-size image differences produce a PNG diff; dimension and environment mismatches are explained in the JSON report. Comparison never writes baseline files.

## Intentionally update baselines

1. Inspect the current images, diffs, and intended UI or environment change.
2. Run `npm run visual:update` to capture all four states and replace the baseline set for the current platform/architecture. A missing platform baseline must also be created explicitly with this command.
3. Inspect all four baseline PNGs and their manifest, then run `npm run test:visual` again to check reproducibility.
4. Include the reviewed PNGs and manifest with the intended change when you choose to commit.

Update mode waits for all captures to succeed before copying images into the baseline directory. Do not use it to bypass an unexplained failure. No command automatically commits changes. Routine visual runs clear previous current images/diffs for their platform and overwrite the result report; preserve any evidence you want to keep before another run.

The screenshot and pixel-diff workflow is step 12. AI semantic review of visual differences is reserved for step 13.
