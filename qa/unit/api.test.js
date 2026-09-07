const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../app/server');
test('CRUD, validation, duplicate titles, and ownership isolation', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (url, method = 'GET', body, token = '') => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body && JSON.stringify(body) });
  try {
    assert.equal((await call('/tasks')).status, 401);
    const login = async username => (await (await call('/auth/login', 'POST', { username, password: 'demo-password' })).json()).token;
    const a = await login('alice'); const b = await login('bob');
    for (const title of ['', '   ', 'x'.repeat(201)]) assert.equal((await call('/tasks', 'POST', { title }, a)).status, 400);
    const one = await (await call('/tasks', 'POST', { title: 'same' }, a)).json();
    assert.equal((await call('/tasks', 'POST', { title: 'same' }, a)).status, 201);
    assert.equal((await call('/tasks/abc', 'GET', undefined, a)).status, 400);
    for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await call(`/tasks/${one.id}`, method, method === 'PUT' ? { title: 'stolen' } : undefined, b)).status, 404);
    assert.deepEqual(await (await call('/tasks', 'GET', undefined, b)).json(), []);
    assert.equal((await (await call(`/tasks/${one.id}`, 'PUT', { title: 'done', completed: true }, a)).json()).completed, true);
    assert.equal((await call(`/tasks/${one.id}`, 'DELETE', undefined, a)).status, 204);
    assert.equal((await call(`/tasks/${one.id}`, 'GET', undefined, a)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
