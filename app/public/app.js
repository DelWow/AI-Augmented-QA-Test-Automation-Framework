const $ = selector => document.querySelector(selector);
let token = sessionStorage.getItem('token');
async function api(path, method = 'GET', body) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: body && JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') logout();
    throw new Error(data.error);
  }
  return data;
}
function logout() {
  token = null; sessionStorage.removeItem('token');
  $('#tasks-page').hidden = true; $('#login-page').hidden = false; $('#task-list').replaceChildren();
}
async function render() {
  const tasks = await api('/tasks');
  $('#login-page').hidden = true; $('#tasks-page').hidden = false;
  $('#task-list').replaceChildren(); $('#empty-state').hidden = tasks.length > 0;
  for (const task of tasks) {
    const row = document.createElement('li'); row.dataset.taskId = task.id;
    const label = document.createElement('span'); label.textContent = task.title;
    label.className = task.completed ? 'complete' : '';
    const toggle = document.createElement('button'); toggle.textContent = task.completed ? 'Reopen' : 'Complete';
    toggle.dataset.action = 'toggle';
    toggle.onclick = () => run(async () => { await api(`/tasks/${task.id}`, 'PUT', { title: task.title, completed: !task.completed }); await render(); });
    const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.dataset.action = 'delete';
    remove.onclick = () => run(async () => { await api(`/tasks/${task.id}`, 'DELETE'); await render(); });
    row.append(label, toggle, remove); $('#task-list').append(row);
  }
}
async function run(action) { $('#error').textContent = ''; try { await action(); } catch (error) { $('#error').textContent = error.message; } }
$('#login-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const data = await api('/auth/login', 'POST', { username: $('#username').value, password: $('#password').value });
  token = data.token; sessionStorage.setItem('token', token); $('#password').value = ''; await render();
}); };
$('#task-form').onsubmit = event => { event.preventDefault(); run(async () => {
  await api('/tasks', 'POST', { title: $('#task-title').value }); $('#task-title').value = ''; await render();
}); };
$('#logout-button').onclick = logout;
if (token) run(render);
