const { resolveIntent } = require('./selector-intents');
let recoveries = [];

beforeEach(() => { recoveries = []; });
afterEach(() => {
  if (recoveries.length) {
    cy.task('selectorRecovery', {
      spec: Cypress.spec.relative,
      test: Cypress.currentTest.titlePath.join(' > '),
      recoveries
    }, { log: false });
  }
});

Cypress.Commands.addQuery('findByIntent', function (name, options = {}) {
  this.set('timeout', options.timeout ?? Cypress.config('defaultCommandTimeout'));
  const log = Cypress.log({ name: 'byIntent', message: name });
  let recorded = false;
  return subject => {
    if (subject?.length !== 1) throw new Error('findByIntent requires one root element');
    const result = resolveIntent(subject[0], name, {
      strict: options.strict === true,
      isVisible: element => Cypress.dom.isVisible(element)
    });
    if (result.recovered && !recorded) {
      const detail = { intent: name, scope: result.rule.scope, primary: result.rule.primary,
        fallback: result.rule.fallback, text: result.rule.text };
      recoveries.push(detail);
      recorded = true;
      log.set({ message: `${name}: recovered ${detail.primary} using ${detail.fallback} (${detail.text})` });
    }
    const elements = Cypress.$(result.element);
    log.set({ $el: elements });
    return elements;
  };
});

Cypress.Commands.add('byIntent', (name, options = {}) => cy.get('body').findByIntent(name, options));
