const express = require('express');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

function createApp() {
  const app = express();
  const tasks = new Map();
  const sessions = new Map();
  let nextId = 1;
  app.use(express.json({ limit: '16kb' }));
  app.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || username.length > 80 || password !== 'demo-password') {
      return res.status(401).json({ error: 'Use a nonempty username (max 80 characters) and demo-password' });
    }
    const token = randomUUID();
    sessions.set(token, username.trim());
    res.json({ token });
  });
  app.use('/tasks', (req, res, next) => {
    req.user = sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
  app.param('id', (req, res, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return res.status(400).json({ error: 'Invalid ID' });
    req.task = tasks.get(Number(value));
    if (!req.task || req.task.owner !== req.user) return res.status(404).json({ error: 'Task not found' });
    next();
  });
  function valid(body) {
    return body && typeof body.title === 'string' && body.title.trim().length > 0 && body.title.length <= 200 &&
      (body.completed === undefined || typeof body.completed === 'boolean') && Object.keys(body).every(k => ['title', 'completed'].includes(k));
  }
  const publicTask = ({ id, title, completed }) => ({ id, title, completed });
  app.get('/tasks', (req, res) => res.json([...tasks.values()].filter(t => t.owner === req.user).map(publicTask)));
  app.post('/tasks', (req, res) => {
    if (!valid(req.body)) return res.status(400).json({ error: 'Title must contain 1–200 characters; completed must be boolean; unknown fields are rejected' });
    // Duplicate titles are intentionally allowed; IDs are unique.
    const task = { id: nextId++, title: req.body.title.trim(), completed: req.body.completed ?? false, owner: req.user };
    tasks.set(task.id, task);
    res.status(201).json(publicTask(task));
  });
  app.get('/tasks/:id', (req, res) => res.json(publicTask(req.task)));
  app.put('/tasks/:id', (req, res) => {
    if (!valid(req.body)) return res.status(400).json({ error: 'Invalid task body' });
    Object.assign(req.task, { title: req.body.title.trim(), completed: req.body.completed ?? req.task.completed });
    res.json(publicTask(req.task));
  });
  app.delete('/tasks/:id', (req, res) => { tasks.delete(req.task.id); res.status(204).end(); });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => res.status(err.status === 413 ? 413 : 400).json({ error: 'Invalid JSON request' }));
  return app;
}
if (require.main === module) createApp().listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('TaskTracker listening'));
module.exports = { createApp };
