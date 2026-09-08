// AI-authored test cases. See edge-cases.prompt.md for scope and provenance.
// Rebuild the importable collection with: node qa/postman/generate-edge-cases.js
const { writeFileSync } = require('node:fs');
const path = require('node:path');

const item = [];
const event = (listen, source) => ({
  listen,
  script: { type: 'text/javascript', exec: source.trim().split('\n') }
});
const bearer = token => ({ type: 'bearer', bearer: [{ key: 'token', value: token, type: 'string' }] });
const noauth = { type: 'noauth' };
const test = (name, source) => `pm.test(${JSON.stringify(name)}, () => {\n${source}\n});`;
const equalBody = expected => test('Response body matches', `pm.expect(pm.response.json()).to.deep.equal(${expected});`);

function add(name, method, url, status, { body, raw, auth, checks = '', pre } = {}) {
  const request = { method, header: [], url: '{{baseUrl}}' + url };
  if (auth) request.auth = auth;
  if (body !== undefined || raw !== undefined) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: raw ?? JSON.stringify(body), options: { raw: { language: 'json' } } };
  }
  const assertions = [test(`Status is ${status}`, `pm.response.to.have.status(${status});`)];
  if (status === 204) assertions.push(test('Body is empty', 'pm.expect(pm.response.text()).to.equal("");'));
  else assertions.push(test('Response is JSON', 'pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");'));
  if (status >= 400) assertions.push(test('Error has a nonempty message', 'pm.expect(pm.response.json().error).to.be.a("string").and.not.empty;'));
  if (checks) assertions.push(checks);
  item.push({
    name: `${String(item.length + 1).padStart(2, '0')} - ${name}`,
    request,
    event: [...(pre ? [event('prerequest', pre)] : []), event('test', assertions.join('\n'))]
  });
}

add('Initialize run and reject invalid token', 'GET', '/tasks', 401, {
  auth: bearer('invalid-edge-case-token'),
  pre: `const runId = pm.variables.replaceIn("{{$guid}}");
pm.variables.set("owner", "edge-owner-" + runId);
pm.variables.set("otherUser", "edge-other-" + runId);
pm.variables.set("token", "");
pm.variables.set("otherToken", "");
pm.variables.set("taskId", "");
pm.variables.set("createdIds", []);`
});

for (const [name, username] of [
  ['empty username', ''], ['whitespace username', ' \t '],
  ['non-string username', 123], ['81-character username', 'u'.repeat(81)]
]) {
  add(`Reject ${name}`, 'POST', '/auth/login', 401, {
    auth: noauth, body: { username, password: 'demo-password' }
  });
}

function login(name, username, tokenKey) {
  add(name, 'POST', '/auth/login', 200, {
    auth: noauth, body: { username, password: 'demo-password' },
    checks: test('Capture session token', `const token = pm.response.json().token;
pm.expect(token).to.be.a("string").and.not.empty;
pm.variables.set(${JSON.stringify(tokenKey)}, token);`)
  });
}

login('Accept 80-character username', '{{boundaryUser}}', 'boundaryToken');
item.at(-1).event.unshift(event('prerequest', 'pm.variables.set("boundaryUser", pm.variables.get("owner").padEnd(80, "u"));'));
login('Log in owner with surrounding whitespace', '  {{owner}}  ', 'token');
login('Log in another user', '{{otherUser}}', 'otherToken');

function create(name, body, title, completed, idKey) {
  add(name, 'POST', '/tasks', 201, {
    body,
    checks: test('Capture unique ID and verify stored task', `const task = pm.response.json();
const ids = pm.variables.get("createdIds");
pm.expect(Number.isSafeInteger(task.id) && task.id > 0).to.equal(true);
pm.expect(ids).not.to.include(task.id);
ids.push(task.id);
pm.variables.set("createdIds", ids);
pm.variables.set(${JSON.stringify(idKey)}, task.id);
pm.expect(task).to.deep.equal({ id: task.id, title: ${JSON.stringify(title)}, completed: ${completed} });`)
  });
}

create('Accept one-character title', { title: 'x' }, 'x', false, 'minId');
create('Accept 200-character title', { title: 'x'.repeat(200) }, 'x'.repeat(200), false, 'maxId');
create('Accept 200 UTF-16 code units', { title: '😀'.repeat(100) }, '😀'.repeat(100), false, 'unicodeId');
create('Trim title and accept explicit completion', { title: '  Duplicate title  ', completed: true }, 'Duplicate title', true, 'taskId');
create('Allow duplicate titles with different IDs', { title: 'Duplicate title' }, 'Duplicate title', false, 'duplicateId');

const expectedTask = '{ id: Number(pm.variables.get("taskId")), title: "Duplicate title", completed: true }';
const invalidBodies = [
  ['missing title', {}], ['empty title', { title: '' }],
  ['whitespace title', { title: ' \t\n ' }], ['null title', { title: null }],
  ['numeric title', { title: 123 }], ['201-character title', { title: 'x'.repeat(201) }],
  ['length before trimming', { title: ' ' + 'x'.repeat(200) }],
  ['202 UTF-16 code units', { title: '😀'.repeat(101) }],
  ['string completion', { title: 'Invalid', completed: 'false' }],
  ['numeric completion', { title: 'Invalid', completed: 0 }],
  ['null completion', { title: 'Invalid', completed: null }],
  ['unknown field', { title: 'Invalid', owner: 'someone-else' }],
  ['array body', []]
];
for (const [name, body] of invalidBodies) {
  add(`Create rejects ${name}`, 'POST', '/tasks', 400, { body });
  add(`Update rejects ${name}`, 'PUT', '/tasks/{{taskId}}', 400, { body });
}
add('Rejected updates leave task unchanged', 'GET', '/tasks/{{taskId}}', 200, { checks: equalBody(expectedTask) });
add('Rejected creates leave task count unchanged', 'GET', '/tasks', 200, {
  checks: test('Only successful creates exist', 'pm.expect(pm.response.json().map(task => task.id).sort((a, b) => a - b)).to.deep.equal([...pm.variables.get("createdIds")].sort((a, b) => a - b));')
});

for (const [method, url] of [['POST', '/tasks'], ['PUT', '/tasks/{{taskId}}']]) {
  add(`${method} rejects malformed JSON`, method, url, 400, { raw: '{"title":' });
  add(`${method} rejects oversized JSON`, method, url, 413, {
    raw: '{{oversizedBody}}',
    pre: 'pm.variables.set("oversizedBody", JSON.stringify({ title: "x".repeat(17 * 1024) }));'
  });
}
add('Parsing precedes authentication', 'POST', '/tasks', 400, { auth: noauth, raw: '{"title":' });
add('Rejected JSON leaves task unchanged', 'GET', '/tasks/{{taskId}}', 200, { checks: equalBody(expectedTask) });

for (const id of ['0', '-1', '01', '1.5', 'abc', '9007199254740992']) {
  add(`Reject invalid ID ${id}`, 'GET', `/tasks/${id}`, 400);
}

add('Other user cannot list owner tasks', 'GET', '/tasks', 200, {
  auth: bearer('{{otherToken}}'), checks: equalBody('[]')
});
for (const method of ['GET', 'PUT', 'DELETE']) {
  add(`Other user cannot ${method} owner task`, method, '/tasks/{{taskId}}', 404, {
    auth: bearer('{{otherToken}}'), ...(method === 'PUT' ? { body: { title: 'Stolen' } } : {})
  });
}
add('Cross-user attempts leave owner task unchanged', 'GET', '/tasks/{{taskId}}', 200, { checks: equalBody(expectedTask) });
login('Trimmed username retains same identity', '{{owner}}', 'token');
add('New session can read the same owner task', 'GET', '/tasks/{{taskId}}', 200, { checks: equalBody(expectedTask) });
add('Omitted completion preserves true', 'PUT', '/tasks/{{taskId}}', 200, {
  body: { title: 'Renamed' },
  checks: equalBody('{ id: Number(pm.variables.get("taskId")), title: "Renamed", completed: true }')
});
add('Explicit false clears completion', 'PUT', '/tasks/{{taskId}}', 200, {
  body: { title: 'Renamed', completed: false },
  checks: equalBody('{ id: Number(pm.variables.get("taskId")), title: "Renamed", completed: false }')
});
add('Completion change is persisted', 'GET', '/tasks/{{taskId}}', 200, {
  checks: equalBody('{ id: Number(pm.variables.get("taskId")), title: "Renamed", completed: false }')
});
for (const idKey of ['minId', 'maxId', 'unicodeId', 'taskId', 'duplicateId']) {
  add(`Clean up ${idKey}`, 'DELETE', `/tasks/{{${idKey}}}`, 204);
}
for (const method of ['GET', 'PUT', 'DELETE']) {
  add(`${method} deleted task returns 404`, method, '/tasks/{{taskId}}', 404, {
    ...(method === 'PUT' ? { body: { title: 'Missing' } } : {})
  });
}
add('Verify owner cleanup', 'GET', '/tasks', 200, { checks: equalBody('[]') });
add('Verify other user remains empty', 'GET', '/tasks', 200, {
  auth: bearer('{{otherToken}}'), checks: equalBody('[]')
});

const collection = {
  info: {
    name: 'TaskTracker - AI Edge Cases',
    description: 'AI-authored edge cases derived from app/openapi.yaml and checked against app/server.js. Rebuilt offline by generate-edge-cases.js; no live model call. Run all requests in order. Each iteration uses unique users and cleans up its tasks. See edge-cases.prompt.md.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  auth: bearer('{{token}}'),
  variable: [{ key: 'baseUrl', value: 'http://127.0.0.1:3000', type: 'string' }],
  item
};
writeFileSync(path.join(__dirname, 'ai-edge-cases.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${item.length} edge-case requests.`);
