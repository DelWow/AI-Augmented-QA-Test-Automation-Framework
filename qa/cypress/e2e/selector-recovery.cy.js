const { resolveIntent } = require('../support/selector-intents');

describe('AI-assisted selector recovery', () => {
  let token;
  function rejectionMessage(action) {
    try { action(); } catch (error) { return error.message; }
    throw new Error('Expected selector lookup to reject');
  }
  const resolve = (root, options) => resolveIntent(root, 'createTask', {
    ...options, isVisible: element => Cypress.dom.isVisible(element)
  });
  function fixture(html) {
    return cy.document().then(doc => {
      const root = doc.createElement('div');
      root.id = 'selector-fixture';
      root.innerHTML = html;
      doc.body.append(root);
      return { root };
    });
  }

  beforeEach(() => { token = undefined; cy.visit('/'); });
  afterEach(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    cy.request({ url: '/tasks', headers, log: false }).then(({ body }) => {
      body.forEach(task => cy.request({ method: 'DELETE', url: `/tasks/${task.id}`, headers, log: false }));
    });
  });

  it('recovers changed selectors while preserving real login, create, and logout behavior', () => {
    cy.intercept('POST', '/auth/login').as('login');
    cy.intercept('GET', '/tasks').as('list');
    cy.intercept('POST', '/tasks').as('create');
    cy.get('#login-button').invoke('attr', 'id', 'renamed-login');
    cy.get('#username').type(`healing-${crypto.randomUUID()}`);
    cy.get('#password').type('demo-password', { log: false });
    cy.byIntent('login').click();
    cy.wait('@login').then(({ response }) => {
      expect(response.statusCode).to.equal(200);
      token = response.body.token;
    });
    cy.wait('@list');
    cy.get('[data-testid="create-task"]').invoke('attr', 'data-testid', 'renamed-create');
    cy.get('#task-title').type('Recovered selector task');
    cy.byIntent('createTask').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.wait('@list');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Recovered selector task');
    cy.get('#logout-button').invoke('attr', 'id', 'renamed-logout');
    cy.byIntent('logout').click();
    cy.get('#login-page').should('be.visible');
    cy.window().should(win => expect(win.sessionStorage.getItem('token')).to.equal(null));
  });

  it('prefers the primary selector and supports strict lookup', () => {
    fixture('<form id="task-form"><button type="submit" data-testid="create-task">Add task</button><button type="submit">Add task</button></form>')
      .then(({ root }) => expect(resolve(root).recovered).to.equal(false));
    cy.get('#selector-fixture').findByIntent('createTask', { strict: true }).should('have.attr', 'data-testid', 'create-task');
  });

  it('retries until an eligible fallback appears', () => {
    fixture('<form id="task-form"></form>').then(({ root }) => {
      root.ownerDocument.defaultView.setTimeout(() => {
        const button = root.ownerDocument.createElement('button');
        button.type = 'submit';
        button.textContent = 'Add task';
        root.firstElementChild.append(button);
      }, 100);
    });
    cy.get('#selector-fixture').findByIntent('createTask').should('have.text', 'Add task');
  });

  it('rejects missing, ambiguous, hidden, wrong-scope, and incorrect controls', () => {
    const cases = [
      ['<form id="task-form"></form>', /found 0/],
      ['<form id="task-form"><button type="submit">Add task</button><button type="submit">Add task</button></form>', /found 2/],
      ['<form id="task-form"><button type="submit" hidden>Add task</button></form>', /found 0/],
      ['<form id="task-form"></form><button type="submit">Add task</button>', /found 0/],
      ['<form id="task-form"><button type="submit">Delete</button></form>', /found 0/],
      ['<form id="task-form"><button type="button">Add task</button></form>', /found 0/],
      ['<form id="task-form"><button type="submit" data-testid="create-task">Delete</button><button type="submit">Add task</button></form>', /primary selector/],
      ['<form id="task-form"><button type="submit" data-testid="create-task" hidden>Add task</button><button type="submit">Add task</button></form>', /primary selector/],
      ['<form id="task-form"><button type="submit" data-testid="create-task">Add task</button><button type="submit" data-testid="create-task">Add task</button></form>', /primary selector/],
      ['<form id="task-form"></form><form id="task-form"></form>', /exactly one scope/]
    ];
    fixture('').then(({ root }) => {
      cases.forEach(([html, error]) => {
        root.innerHTML = html;
        expect(rejectionMessage(() => resolve(root)), html).to.match(error);
      });
    });
  });

  it('rejects unknown intents and forbids fallback in strict mode', () => {
    fixture('<form id="task-form"><button type="submit">Add task</button></form>').then(({ root }) => {
      expect(rejectionMessage(() => resolve(root, { strict: true }))).to.match(/strict mode/);
      expect(rejectionMessage(() => resolveIntent(root, 'deleteEverything'))).to.match(/Unknown selector intent/);
    });
  });

  it('preserves disabled state instead of bypassing actionability', () => {
    fixture('<form id="task-form"><button type="submit" disabled>Add task</button></form>');
    cy.get('#selector-fixture').findByIntent('createTask').should('be.disabled');
  });
});
