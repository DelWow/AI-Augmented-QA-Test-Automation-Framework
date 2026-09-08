# AI-Augmented QA Test Automation Framework

TaskTracker is a small application used to demonstrate API, browser, cross-browser, and visual testing with optional Claude-assisted test generation, selector recovery, and failure analysis.

## Baseline API checks with Postman

1. Install Node.js 22 or newer, then run `npm ci` and `npm start`.
2. Import `qa/postman/baseline.postman_collection.json` into Postman.
3. The collection's `baseUrl` defaults to `http://127.0.0.1:3000`. Change it if the server uses a different port; omit the trailing slash. No Postman environment is required.
4. Run the entire collection in order using Collection Runner. Keep all requests selected so login, task creation, and cleanup run together.

The 13 requests check missing authentication, invalid credentials, login, an empty initial list, missing-title validation, and task creation, reading, listing, updating, and deletion. Assertions check status codes and response bodies, including persisted updates and a 404 after deletion.

Each iteration creates a unique demo username and uses `demo-password`. The token and task ID are captured automatically in run-local variables. Successful runs delete their task; an interrupted run may leave a task in memory. Restarting the server clears all tasks and sessions. Avoid environment or data-file variables named `baseUrl` unless intentionally overriding the collection URL.

## AI-generated Postman edge cases

Import `qa/postman/ai-edge-cases.postman_collection.json` and run the whole collection in order using the same server and `baseUrl` setup above. It runs independently of the baseline collection and requires no API key or Postman environment.

The cases cover username/title boundaries (including UTF-16 length), whitespace, invalid types and fields, duplicate titles, completion updates, invalid IDs, JSON parsing and body limits, and ownership isolation. They also check that rejected writes preserve data and that successful runs clean up their tasks.

The cases and assertion scripts were AI-authored from the API contract and implementation. The [generation brief](qa/postman/edge-cases.prompt.md) records their scope and provenance. To rebuild the checked-in collection offline after editing the cases, run:

```sh
node qa/postman/generate-edge-cases.js
```

This script serializes the reviewed cases; it does not call a model or generate new suggestions at runtime.

## Run Postman collections with Newman

After `npm ci`, run:

```sh
npm run test:api
```

This starts an isolated TaskTracker server on an available localhost port, runs the baseline and AI edge-case collections sequentially, and closes the server afterward. No separate `npm start` or API key is needed. Both collections run even if one fails; assertion, script, and request failures produce a nonzero exit code. Requests time out after 10 seconds, scripts after 5 seconds, and each collection after 2 minutes.

To test an already running server, export `BASE_URL` for the command:

```sh
BASE_URL=http://127.0.0.1:3000 npm run test:api
```

The runner reads `BASE_URL` from the process environment, not from `.env`. When set, it uses that server without starting or stopping it. Collections create unique demo users and delete their tasks on successful runs; interrupted runs may leave data in the target server.

Console results and JUnit XML reports are produced for each collection at `qa/reports/postman/baseline.xml` and `qa/reports/postman/ai-edge-cases.xml`. Reports are overwritten on subsequent runs and ignored by Git. Use `npm test` for unit checks, or `npm run test:all` to run unit checks followed by both full collections.
