'use strict';

// The customer's account in the store: the login form of the account page
// (the store's own, next to the site's login screen that the WordPress pack
// drives), the pages of the account by the name of their menu link, the
// order history and an order's page, and the billing and shipping addresses.
//
// The account pages are server-rendered forms: a step waits for the page the
// form leads to and for the store's message ("Address changed
// successfully.", an error), never on a fixed time.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  resolveUser,
  clean,
  listed,
  same,
  eventually,
  storePagePath,
  storeMessages,
  lastOrder,
} = require('./woocommerce-helpers');

/** The account's menu ("Account pages"), or fail: the account page shows it only to an account. */
async function accountMenu(world) {
  const menu = world.page.locator('nav.woocommerce-MyAccount-navigation, nav[aria-label="Account pages"]').first();
  if (!(await menu.count())) {
    throw friendly({
      message: `The account page shows no account menu (${world.page.url()}): the browser is not logged in to the store.`,
      hint: 'Log in first: Given I am a logged in user with the "customer" user, or When I log in to the store as "customer".',
    });
  }
  return menu;
}

/** The rows of the order history the page shows: `[{ number, status, total, view }]`. */
async function orderHistory(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('table.woocommerce-orders-table tbody tr, table.my_account_orders tbody tr')].map((tr) => {
    const cell = (name) => tr.querySelector(`.woocommerce-orders-table__cell-order-${name}`);
    const number = cell('number');
    const view = tr.querySelector('a.view');
    return {
      number: number ? number.textContent.replace(/[#\s]/g, '') : '',
      status: cell('status') ? cell('status').textContent.replace(/\s+/g, ' ').trim() : '',
      total: cell('total') ? cell('total').textContent.replace(/\s+/g, ' ').trim() : '',
      view: view ? view.href : (number && number.querySelector('a') ? number.querySelector('a').href : ''),
    };
  }));
}

/**
 * Log in with the login form of the store's account page ("My account"), as
 * an account of the users registry; the step waits for the account's
 * dashboard. With "with the password", the password is the one given (a
 * refused login, whose message the next step reads).
 *
 * Example #1: When I log in to the store as "customer"
 * Example #2: When we log in to the store as "customer"
 * Example #3: And I log in to the store as "shop_manager"
 * Example #4: When I log in to the store as "customer" with the password "wrong-password"
 * Example #5: When we log in to the store as "customer" with the password "not-the-password"
 */
When(/^(I |we )*log in to the store as "([^"]*)"(?: with the password "([^"]*)")?$/, async function (pronounCase, handle, password) {
  const account = resolveUser(this, handle);
  await navigate(this, storePagePath(this, 'my account'));
  const form = this.page.locator('form.woocommerce-form-login, form.login').first();
  if (!(await form.count())) {
    throw friendly({ message: `The account page shows no login form (${this.page.url()}): the browser is already logged in.`, hint: 'Start from a visitor: Given I am an anonymous user.' });
  }
  await form.locator('#username, input[name="username"]').first().fill(account.username);
  await form.locator('#password, input[name="password"]').first().fill(password === undefined || password === null ? account.password : password);
  await Promise.all([
    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(this) * 4 }).catch(() => {}),
    form.locator('button[name="login"], button[type="submit"]').first().click(),
  ]);
  await settle(this);
  if (password === undefined || password === null) {
    const refused = (await storeMessages(this)).find((m) => m.kind === 'error');
    if (refused || !(await this.page.locator('nav.woocommerce-MyAccount-navigation, nav[aria-label="Account pages"]').count())) {
      throw friendly({
        message: `Could not log in to the store as "${handle}" (account "${account.username}").`,
        cause: refused ? refused.text : `the browser is on ${this.page.url()}`,
        hint: 'Check worldParameters.users in cucumber.js against the shop\'s accounts.',
      });
    }
  }
});

/**
 * Open a page of the customer's account by the name of its link in the
 * account's menu ("Dashboard", "Orders", "Downloads", "Addresses", "Account
 * details"), as a person clicks it.
 *
 * Example #1: Given I am on my "Orders" account page
 * Example #2: When I go to my "Addresses" account page
 * Example #3: Given we are on our "Dashboard" account page
 * Example #4: When we go to our "Account details" account page
 * Example #5: And I go to my "Orders" account page
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) (?:my|our) "([^"]*)" account page$/, async function (name) {
  await navigate(this, storePagePath(this, 'my account'));
  const menu = await accountMenu(this);
  const links = menu.locator('a');
  const names = (await links.allTextContents()).map(clean);
  const index = names.findIndex((n) => same(n, name));
  if (index < 0) {
    throw friendly({ message: `The account menu has no "${name}". It has: ${listed(names)}.`, hint: 'Name the page as its link in the account menu reads.' });
  }
  await navigate(this, await links.nth(index).getAttribute('href'));
});

/**
 * Assert the customer's order history (the account's "Orders" page) lists, or
 * does not list, the order the scenario placed last, and with "as" its status
 * as the history shows it.
 *
 * Example #1: Then my order history should list the last placed order
 * Example #2: And my order history should list the last placed order as "Processing"
 * Example #3: Then our order history should list the last placed order as "On hold"
 * Example #4: Then my order history should not list the last placed order
 * Example #5: And my order history should list the last placed order as "Completed"
 */
Then(/^(?:my|our) order history should( not)* list the last placed order(?: as "([^"]*)")?$/, async function (notCase, status) {
  const order = lastOrder(this);
  if (!/\/orders\/?$/.test(new URL(this.page.url()).pathname)) {
    await navigate(this, storePagePath(this, 'my account'));
    const menu = await accountMenu(this);
    const link = menu.locator('a[href*="/orders"]').first();
    if (await link.count()) await navigate(this, await link.getAttribute('href'));
  }
  const rows = await orderHistory(this);
  const row = rows.find((r) => r.number === String(order.number));
  if (notCase) {
    if (row) throw friendly({ message: `Expected order #${order.number} not in the order history, but it is there (${row.status}).`, hint: 'A guest\'s order belongs to no account.' });
    return;
  }
  if (!row) {
    throw friendly({ message: `Order #${order.number} is not in the order history. It lists: ${listed(rows.map((r) => `#${r.number} ${r.status}`))}.`, hint: 'The order history of an account lists the orders placed while it was logged in.' });
  }
  if (status && !same(row.status, status)) {
    throw friendly({ message: `Order #${order.number} is "${row.status}" in the order history, not "${status}".`, hint: 'The status is the one the order has now; the administration changes it.' });
  }
});

/**
 * Open the order the scenario placed last from the customer's order history,
 * with its "View" button.
 *
 * Example #1: When I open the last placed order in my order history
 * Example #2: When we open the last placed order in our order history
 * Example #3: And I open the last placed order in my order history
 * Example #4: When I open the last placed order in my order history
 * Example #5: And we open the last placed order in our order history
 */
When(/^(I |we )*open the last placed order in (?:my|our) order history$/, async function (pronounCase) {
  const order = lastOrder(this);
  if (!/\/orders\/?$/.test(new URL(this.page.url()).pathname)) {
    await navigate(this, storePagePath(this, 'my account'));
    const menu = await accountMenu(this);
    const link = menu.locator('a[href*="/orders"]').first();
    if (await link.count()) await navigate(this, await link.getAttribute('href'));
  }
  const rows = await orderHistory(this);
  const row = rows.find((r) => r.number === String(order.number));
  if (!row || !row.view) {
    throw friendly({ message: `Order #${order.number} is not in the order history. It lists: ${listed(rows.map((r) => `#${r.number}`))}.`, hint: 'The order history lists the orders of the account that is logged in.' });
  }
  await navigate(this, row.view);
  await eventually(this, () => this.page.locator('h1').first().textContent(), (h1) => clean(h1).includes(String(order.number)), (h1) => ({
    message: `Opened order #${order.number}, but the page is "${clean(h1)}".`,
    hint: 'The page of an order is titled with its number.',
  }));
});

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The text of the billing or the shipping address the account's "Addresses" page shows. */
async function savedAddress(world, kind) {
  return world.page.evaluate((k) => {
    const box = document.querySelector(`.woocommerce-Address .woocommerce-Address-title a[href*="/edit-address/${k}"]`)
      ? document.querySelector(`.woocommerce-Address .woocommerce-Address-title a[href*="/edit-address/${k}"]`).closest('.woocommerce-Address')
      : document.querySelector(`.u-column${k === 'billing' ? '1' : '2'}.woocommerce-Address, .woocommerce-Address.${k}`);
    if (!box) return null;
    const address = box.querySelector('address');
    return address ? address.innerText.replace(/\s+/g, ' ').trim() : '';
  }, kind);
}

/**
 * Assert the billing or shipping address the account's "Addresses" page
 * shows contains a text (a name, a street, a city).
 *
 * Example #1: Then my billing address should contain "Los Angeles"
 * Example #2: And my shipping address should contain "2 Test Avenue"
 * Example #3: Then our billing address should contain "Casey Customer"
 * Example #4: Then my billing address should not contain "San Diego"
 * Example #5: And my shipping address should not contain "1 Suite Road"
 */
Then(/^(?:my|our) (billing|shipping) address should( not)* contain "([^"]*)"$/, async function (kind, notCase, text) {
  if (!/\/edit-address\/?$/.test(new URL(this.page.url()).pathname)) {
    await navigate(this, storePagePath(this, 'my account'));
    const menu = await accountMenu(this);
    await navigate(this, await menu.locator('a[href*="/edit-address"]').first().getAttribute('href'));
  }
  await eventually(this, () => savedAddress(this, kind), (shown) => shown !== null && clean(shown).toLowerCase().includes(clean(text).toLowerCase()) !== Boolean(notCase), (shown) => ({
    message: shown === null || shown === undefined
      ? `The account's addresses page shows no ${kind} address (${this.page.url()}).`
      : (notCase ? `Expected the ${kind} address without "${text}", but it reads "${shown}".` : `Expected "${text}" in the ${kind} address, but it reads "${shown || 'nothing: it is not set up'}".`),
    hint: 'The addresses are on the account\'s "Addresses" page.',
  }));
});

/**
 * Change the billing or shipping address of the account from a table of
 * fields (the labels its form shows: First name, Last name, Country / Region,
 * Street address, Town / City, State, ZIP Code, Phone, Email address) and
 * values; the step saves the form and waits for the store's answer.
 *
 * Example #1: When I change my billing address:
 * Example #2: When we change our shipping address:
 * Example #3: And I change my shipping address:
 * Example #4: When I change my billing address:
 * Example #5: And we change our billing address:
 */
When(/^(I |we )*change (?:my|our) (billing|shipping) address:$/, async function (pronounCase, kind, table) {
  await navigate(this, storePagePath(this, 'my account'));
  const menu = await accountMenu(this);
  await navigate(this, await menu.locator('a[href*="/edit-address"]').first().getAttribute('href'));
  const link = this.page.locator(`a[href*="/edit-address/${kind}"]`).first();
  if (!(await link.count())) {
    throw friendly({ message: `The addresses page has no link to the ${kind} address.`, hint: 'The account page lists a billing and a shipping address.' });
  }
  await navigate(this, await link.getAttribute('href'));
  const form = this.page.locator('form').filter({ has: this.page.locator('button[name="save_address"]') }).first();
  const rows = table.raw().filter((r) => r.length >= 2 && clean(r[0]));
  rows.sort((a, b) => (/country/i.test(a[0]) ? -1 : 0) - (/country/i.test(b[0]) ? -1 : 0));
  const fields = await form.locator('input:not([type="hidden"]), select, textarea').evaluateAll((els) => els.map((el) => {
    const lab = el.id && document.querySelector(`label[for="${el.id}"]`);
    // The label of a required field ends with "*" and a "Required" for screen readers; an optional one with "(optional)".
    const copy = lab ? lab.cloneNode(true) : null;
    if (copy) copy.querySelectorAll('.required, .screen-reader-text, .optional').forEach((n) => n.remove());
    return { id: el.id, tag: el.tagName, label: copy ? copy.textContent.replace(/\s+/g, ' ').trim() : '' };
  }));
  const plain = (s) => clean(s).toLowerCase().replace(/\(optional\)|\*/g, '').replace(/\s+/g, ' ').trim();
  for (const [label, value] of rows) {
    const field = fields.find((f) => plain(f.label) === plain(label));
    if (!field) {
      throw friendly({ message: `The ${kind} address form has no field "${label}". Its fields: ${listed(fields.map((f) => f.label).filter(Boolean))}.`, hint: 'Name a field by the label the form shows.' });
    }
    const control = form.locator(`[id="${field.id}"]`);
    if (field.tag === 'SELECT') {
      const options = await control.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
      const option = options.find((o) => same(o, value));
      if (!option) throw friendly({ message: `The field "${label}" has no option "${value}". It offers: ${listed(options.filter(Boolean))}.`, hint: 'Name the option as the menu shows it.' });
      await control.selectOption({ label: option });
    } else {
      await control.fill(value);
    }
  }
  await Promise.all([
    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(this) * 4 }).catch(() => {}),
    form.locator('button[name="save_address"]').click(),
  ]);
  await settle(this);
});
