// AI-authored from the brief and ranked cases in ../test-suggestions.md.
describe('TaskTracker AI-suggested browser cases', () => {
  let sessions;
  let runId;

  function login(user = 'owner') {
    cy.get('#username').clear().type(`ai-${user}-${runId}`);
    cy.get('#password').clear().type('demo-password', { log: false });
    cy.get('#login-button').click();
    cy.wait('@login').then(({ response }) => {
      expect(response.statusCode).to.equal(200);
      sessions.push(response.body.token);
    });
    cy.wait('@list');
    cy.get('#tasks-page').should('be.visible');
  }

  function createTask(title) {
    cy.get('#task-title').clear().type(title, { parseSpecialCharSequences: false });
    cy.get('[data-testid="create-task"]').click();
    return cy.wait('@create').then(({ response }) => {
      expect(response.statusCode).to.equal(201);
      const id = response.body.id;
      return cy.wait('@list').then(() => id);
    });
  }

  const row = id => `#task-list [data-task-id="${id}"]`;

  beforeEach(() => {
    sessions = [];
    runId = crypto.randomUUID();
    cy.intercept('POST', '/auth/login').as('login');
    cy.intercept('GET', '/tasks').as('list');
    cy.intercept('POST', '/tasks').as('create');
    cy.intercept('PUT', '/tasks/*').as('update');
    cy.intercept('DELETE', '/tasks/*').as('delete');
    cy.visit('/');
  });

  afterEach(() => {
    // Preserve every real session across logout or browser-storage changes.
    // These users belong only to this test; cy.request bypasses intercepts.
    sessions.forEach(token => {
      const headers = { Authorization: `Bearer ${token}` };
      cy.request({ url: '/tasks', headers, log: false }).then(({ body }) => {
        body.forEach(task => cy.request({ method: 'DELETE', url: `/tasks/${task.id}`, headers, log: false }));
      });
    });
  });

  it('AI-01: keeps task lists isolated when switching accounts', () => {
    login();
    createTask('Owner private task');
    cy.get('#logout-button').click();
    cy.get('#task-list').children().should('have.length', 0);
    login('other');
    cy.get('#empty-state').should('be.visible');
    cy.get('#task-list').should('not.contain.text', 'Owner private task');
    createTask('Other private task');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Other private task');
    cy.get('#logout-button').click();
    login();
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Owner private task');
    cy.get('#task-list').should('not.contain.text', 'Other private task');
    cy.reload();
    cy.wait('@list');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Owner private task');
  });

  it('AI-02: renders an HTML-like title as literal text after reload', () => {
    const title = '<img src=x onerror="window.__titleExecuted=true">';
    login();
    createTask(title);
    cy.get('#task-list li span').should('have.text', title);
    cy.get('#task-list').find('img').should('not.exist');
    cy.window().should(win => expect(win.__titleExecuted).to.equal(undefined));
    cy.reload();
    cy.wait('@list');
    cy.get('#task-list li span').should('have.text', title);
    cy.get('#task-list').find('img').should('not.exist');
    cy.window().should(win => expect(win.__titleExecuted).to.equal(undefined));
  });

  it('AI-03: clears an invalid stored session and permits a fresh login', () => {
    login();
    createTask('Survives session recovery');
    cy.window().then(win => win.sessionStorage.setItem('token', 'invalid-session-token'));
    cy.reload();
    cy.wait('@list').its('response.statusCode').should('eq', 401);
    cy.get('#login-page').should('be.visible');
    cy.get('#tasks-page').should('not.be.visible');
    cy.get('#task-list').children().should('have.length', 0);
    cy.get('[role="alert"]').should('have.text', 'Unauthorized');
    cy.window().should(win => expect(win.sessionStorage.getItem('token')).to.equal(null));
    login();
    cy.get('[role="alert"]').should('be.empty');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Survives session recovery');
  });

  it('AI-04: preserves input after a failed save and retries without duplication', () => {
    login();
    // Inject one HTTP failure; the retry reaches the real server.
    cy.intercept({ method: 'POST', pathname: '/tasks', times: 1 }, {
      statusCode: 503, body: { error: 'Temporarily unavailable' }
    }).as('failedCreate');
    cy.get('#task-title').type('Retry this task');
    cy.get('[data-testid="create-task"]').click();
    cy.wait('@failedCreate').its('response.statusCode').should('eq', 503);
    cy.get('[role="alert"]').should('have.text', 'Temporarily unavailable');
    cy.get('#task-title').should('have.value', 'Retry this task');
    cy.get('#task-list').children().should('have.length', 0);
    cy.get('#empty-state').should('be.visible');
    cy.get('[data-testid="create-task"]').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.wait('@list');
    cy.get('[role="alert"]').should('be.empty');
    cy.get('#task-title').should('have.value', '');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Retry this task');
    cy.reload();
    cy.wait('@list');
    cy.get('#task-list li').should('have.length', 1).and('contain.text', 'Retry this task');
  });

  it('AI-05: completes and deletes only the selected duplicate-title task', () => {
    login();
    createTask('Same title').then(firstId => {
      createTask('Same title').then(secondId => {
        expect(secondId).not.to.equal(firstId);
        cy.get('#task-list li').should('have.length', 2);
        cy.get(`${row(secondId)} [data-action="toggle"]`).click();
        cy.wait('@update').then(({ request, response }) => {
          expect(request.url).to.match(new RegExp(`/tasks/${secondId}$`));
          expect(response.body.completed).to.equal(true);
        });
        cy.wait('@list');
        cy.get(`${row(firstId)} span`).should('not.have.class', 'complete');
        cy.get(`${row(secondId)} span`).should('have.class', 'complete');
        cy.get(`${row(firstId)} [data-action="delete"]`).click();
        cy.wait('@delete').its('response.statusCode').should('eq', 204);
        cy.wait('@list');
        cy.get(row(firstId)).should('not.exist');
        cy.get('#task-list li').should('have.length', 1);
        cy.get(`${row(secondId)} span`).should('have.text', 'Same title').and('have.class', 'complete');
        cy.reload();
        cy.wait('@list');
        cy.get('#task-list li').should('have.length', 1);
        cy.get(row(firstId)).should('not.exist');
        cy.get(`${row(secondId)} span`).should('have.text', 'Same title').and('have.class', 'complete');
      });
    });
  });
});
