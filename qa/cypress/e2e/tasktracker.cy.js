describe('TaskTracker baseline browser workflows', () => {
  let username;
  let token;

  function login(password = 'demo-password') {
    cy.get('#username').clear().type(username);
    cy.get('#password').clear().type(password, { log: false });
    cy.byIntent('login').click();
    cy.wait('@login').then(({ response }) => {
      if (response.statusCode === 200) token = response.body.token;
    });
  }

  beforeEach(() => {
    username = `cypress-${crypto.randomUUID()}`;
    token = undefined;
    cy.intercept('POST', '/auth/login').as('login');
    cy.intercept('GET', '/tasks').as('list');
    cy.intercept('POST', '/tasks').as('create');
    cy.intercept('PUT', '/tasks/*').as('update');
    cy.intercept('DELETE', '/tasks/*').as('delete');
    cy.visit('/');
  });

  afterEach(() => {
    // Each test owns a unique user. Retain its token even after UI logout so
    // failed tests can remove their tasks without touching other users' data.
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    cy.request({ url: '/tasks', headers, log: false }).then(({ body }) => {
      body.forEach(task => cy.request({ method: 'DELETE', url: `/tasks/${task.id}`, headers, log: false }));
    });
  });

  it('shows a login error, then accepts valid credentials and shows an empty list', () => {
    cy.get('#login-page').should('be.visible');
    cy.get('#tasks-page').should('not.be.visible');
    login('wrong-password');
    cy.get('[role="alert"]').should('contain.text', 'demo-password');
    cy.get('#login-page').should('be.visible');
    login();
    cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.get('#tasks-page').should('be.visible');
    cy.get('#login-page').should('not.be.visible');
    cy.get('#empty-state').should('be.visible');
    cy.get('#task-list').children().should('have.length', 0);
    cy.get('[role="alert"]').should('be.empty');
    cy.get('#password').should('have.value', '');
  });

  it('creates, completes, reloads, reopens, and deletes a task', () => {
    login();
    cy.wait('@list');
    cy.get('#task-title').type('Baseline browser task');
    cy.byIntent('createTask').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.wait('@list');
    cy.get('#task-title').should('have.value', '');
    cy.get('#empty-state').should('not.be.visible');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Baseline browser task');
    cy.get('#task-list li span').should('not.have.class', 'complete');
    cy.get('[data-action="toggle"]').should('have.text', 'Complete').click();
    cy.wait('@update').its('response.body.completed').should('eq', true);
    cy.wait('@list');
    cy.get('#task-list li span').should('have.class', 'complete');
    cy.reload();
    cy.wait('@list');
    cy.get('#tasks-page').should('be.visible');
    cy.get('#task-list li span').should('have.text', 'Baseline browser task').and('have.class', 'complete');
    cy.get('[data-action="toggle"]').should('have.text', 'Reopen').click();
    cy.wait('@update').its('response.body.completed').should('eq', false);
    cy.wait('@list');
    cy.get('#task-list li span').should('not.have.class', 'complete');
    cy.get('[data-action="delete"]').click();
    cy.wait('@delete').its('response.statusCode').should('eq', 204);
    cy.wait('@list');
    cy.get('#task-list').children().should('have.length', 0);
    cy.get('#empty-state').should('be.visible');
    cy.reload();
    cy.wait('@list');
    cy.get('#empty-state').should('be.visible');
  });

  it('logs out and stays logged out after reload', () => {
    login();
    cy.wait('@list');
    cy.byIntent('logout').click();
    cy.get('#login-page').should('be.visible');
    cy.get('#tasks-page').should('not.be.visible');
    cy.window().should(win => expect(win.sessionStorage.getItem('token')).to.equal(null));
    cy.reload();
    cy.get('#login-page').should('be.visible');
    cy.get('#tasks-page').should('not.be.visible');
  });

  it('shows task validation errors and allows a corrected title', () => {
    login();
    cy.wait('@list');
    cy.get('#task-title').type('   ');
    cy.byIntent('createTask').click();
    cy.wait('@create').its('response.statusCode').should('eq', 400);
    cy.get('[role="alert"]').should('contain.text', 'Title must contain');
    cy.get('#task-list').children().should('have.length', 0);
    cy.get('#task-title').clear().type('Corrected title');
    cy.byIntent('createTask').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.wait('@list');
    cy.get('[role="alert"]').should('be.empty');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Corrected title');
  });
});
