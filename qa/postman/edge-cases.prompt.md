# AI edge-case generation brief

The edge-case collection was authored with AI assistance using `app/openapi.yaml`, `app/server.js`, and the baseline collection. This brief records the coverage requested. The build script runs offline and serializes the cases defined in its source.

## Prompt

Extend the TaskTracker baseline coverage with a separate Postman v2.1 edge-case collection. Use the OpenAPI contract for expected behavior and inspect the implementation to resolve details such as UTF-16 length counting and JSON parsing before authentication. Report any contract disagreements rather than silently changing the API.

Cover username and title boundaries, whitespace normalization, invalid field types, unknown fields, duplicate titles, omitted versus explicit completion values, invalid IDs, malformed and oversized JSON, and ownership isolation for listing, reading, updating, and deleting. Check that rejected writes preserve stored data. Verify missing-task behavior after deletion.

Use `baseUrl`, unique users per iteration, run-local session tokens and captured task IDs. Assert status codes and meaningful response contents, clean up created tasks, and avoid dependence on global ID values or existing user data. Produce a readable JavaScript source script that builds the importable collection deterministically without network access.

## Review and maintenance

The generated cases encode expected results explicitly; rebuilding does not discover new cases or automatically adapt to contract changes. Review this script against the contract when the API changes, run `node qa/postman/generate-edge-cases.js`, and validate the resulting collection against the running application. Run the entire collection in order, including cleanup. Failed or interrupted runs can leave in-memory data; restarting the demo server clears tasks and sessions.
