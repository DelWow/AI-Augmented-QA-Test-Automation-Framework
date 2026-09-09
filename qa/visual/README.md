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

The baselines target macOS on ARM64 (`darwin-arm64`). The manifest records the exact Chrome for Testing version, platform/architecture, viewport, and state list. Comparison requests that browser version through Selenium Manager and rejects mismatched metadata. System fonts and native controls can vary by OS release as well; use a consistent OS/browser environment for reliable results. CI uses macOS 15 ARM64 and never regenerates baselines.

Pixelmatch uses a per-pixel color threshold of 0.1 and ignores detected anti-aliasing differences. Any remaining changed pixel fails the check; there is no allowed percentage of changed pixels. Dimension mismatches and missing baselines also fail. Same-size image differences produce a PNG diff; dimension and environment mismatches are explained in the JSON report. Comparison never writes baseline files.

## Intentionally update baselines

1. Inspect the current images, diffs, and intended UI or environment change.
2. Run `npm run visual:update` to capture all four states and replace the baseline set for the current platform/architecture. A missing platform baseline must also be created explicitly with this command. For a reproducible CI browser update, select a downloadable [Chrome for Testing version](https://googlechromelabs.github.io/chrome-for-testing/) explicitly: `VISUAL_CHROME_VERSION=153.0.8010.36 npm run visual:update`. This variable affects update mode only; comparison always uses the manifest version. Avoid recording an installed Chrome build that cannot be provisioned on a clean runner.
3. Inspect all four baseline PNGs and their manifest, then run `npm run test:visual` again to check reproducibility.
4. Include the reviewed PNGs and manifest with the intended change when you choose to commit.

Update mode waits for all captures to succeed before copying images into the baseline directory. Do not use it to bypass an unexplained failure. No command automatically commits changes. Routine visual runs clear previous current images/diffs for their platform and overwrite the result report; preserve any evidence you want to keep before another run.

## Semantic diff review

Every `test:visual` run also writes an offline advisory summary to `../reports/visual/semantic-review.json` and `semantic-review.md`. Matching states need no review. Changed states remain **pending** in offline mode: pixel counts cannot establish semantic impact, and no model is called. Pixel failures remain failures.

To request an actual image-based assessment, configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and `AI_MODE=online` in your local `.env`, then run `npm run visual:review`. Unlike the capture command, this review command loads `.env`; exported variables take precedence. The chosen model must support image input and structured outputs and be available to your account. The existing `.env.example` model value is configurable; the reviewer does not replace it automatically. Use `AI_MODE=offline npm run visual:review` to explicitly avoid an API call.

Online mode sends the baseline, current screenshot, and pixel diff for each changed state to the OpenAI Responses API, along with the state name and the review instructions in `review-diffs.js`. Requests use `store: false`, a 60-second timeout, and no automatic retries. Screenshots may contain whatever is visible on the target page; inspect them before using online review, especially against an external `BASE_URL`. Credentials are used for authentication and excluded from generated reports. There is no API call for unchanged states.

The model returns a summary, visible observations, a severity (`cosmetic`, `functional`, or `uncertain`), and a suggested next action. These are advisory judgments that require human review, not proof of runtime behavior or authorization to update baselines. Screenshot text is treated as page content, not model instructions. Model output is validated and escaped in the Markdown report.

SHA-256 hashes bind every changed state's three images to the original comparison. Review rejects missing or modified evidence and reports without hashes; rerun `test:visual` to obtain fresh evidence. Missing baselines, dimension changes, environment mismatches, and incomplete captures need repair before semantic review. The summary records the source-report hash so it can be matched to a specific run.

API failures, refusals, incomplete responses, and invalid output are recorded as review errors, with a nonzero exit code from `visual:review`; they are never substituted with fabricated assessments. A successful advisory review or an offline pending summary exits zero, regardless of the source pixel verdict. Use the exit code from `test:visual` as the visual gate. Neither review mode changes that verdict, the original report, or baseline PNGs. Capture runs always use offline review, even when `.env` is configured for online use; external calls require the separate review command.

Implementation references: [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Provider integration is verified with deterministic mocked responses, including failure handling; live model assessments depend on your credentials and model access.
