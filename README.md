# AI-Augmented QA Test Automation Framework

TaskTracker is a small application used to demonstrate API, browser, cross-browser, and visual testing with optional Claude-assisted test generation, selector recovery, and failure analysis.

## Baseline API checks with Postman

1. Install Node.js 22 or newer, then run `npm ci` and `npm start`.
2. Import `qa/postman/baseline.postman_collection.json` into Postman.
3. The collection's `baseUrl` defaults to `http://127.0.0.1:3000`. Change it if the server uses a different port; omit the trailing slash. No Postman environment is required.
4. Run the entire collection in order using Collection Runner. Keep all requests selected so login, task creation, and cleanup run together.

The 13 requests check missing authentication, invalid credentials, login, an empty initial list, missing-title validation, and task creation, reading, listing, updating, and deletion. Assertions check status codes and response bodies, including persisted updates and a 404 after deletion.

Each iteration creates a unique demo username and uses `demo-password`. The token and task ID are captured automatically in run-local variables. Successful runs delete their task; an interrupted run may leave a task in memory. Restarting the server clears all tasks and sessions. Avoid environment or data-file variables named `baseUrl` unless intentionally overriding the collection URL.
