// AI-authored, offline proposals reviewed against the current UI contract.
// See ../selector-recovery.md before changing these rules.
const intents = {
  login: { scope: '#login-form', primary: '#login-button', fallback: 'button[type="submit"]', text: 'Log in' },
  createTask: { scope: '#task-form', primary: '[data-testid="create-task"]', fallback: 'button[type="submit"]', text: 'Add task' },
  logout: { scope: '#tasks-page', primary: '#logout-button', fallback: 'button', text: 'Log out' }
};

function resolveIntent(root, name, { strict = false, isVisible } = {}) {
  if (!Object.hasOwn(intents, name)) throw new Error(`Unknown selector intent: ${name}`);
  if (typeof isVisible !== 'function') throw new Error('A visibility predicate is required');
  const rule = intents[name];
  const scopes = root.querySelectorAll(rule.scope);
  if (scopes.length !== 1) throw new Error(`${name}: expected exactly one scope ${rule.scope}`);
  const scope = scopes[0];
  const matchesIntent = el => el.tagName === 'BUTTON' && el.matches(rule.fallback) &&
    el.textContent.trim().replace(/\s+/g, ' ') === rule.text && isVisible(el);
  const primary = scope.querySelectorAll(rule.primary);
  if (primary.length) {
    // Never replace an existing but incorrect, hidden, or ambiguous primary.
    if (primary.length !== 1 || !matchesIntent(primary[0])) {
      throw new Error(`${name}: primary selector is ambiguous or violates its intent`);
    }
    return { element: primary[0], recovered: false, rule };
  }
  if (strict) throw new Error(`${name}: primary selector is missing (strict mode)`);
  const candidates = [...scope.querySelectorAll(rule.fallback)].filter(matchesIntent);
  if (candidates.length !== 1) throw new Error(`${name}: expected one fallback, found ${candidates.length}`);
  return { element: candidates[0], recovered: true, rule };
}

module.exports = { intents, resolveIntent };
