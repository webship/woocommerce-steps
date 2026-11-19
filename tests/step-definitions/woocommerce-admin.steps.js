'use strict';

// The store's administration: the orders (the one the scenario placed, in the
// list and on its screen, its status, its notes, its customer, deleting it),
// and the products and coupons lists (an entry listed, moved to the trash,
// deleted for good, opened).
//
// The screens are the classic administration screens: a step waits for the
// page an action leads to and for the notice the screen shows ("Order
// updated.", "1 order moved to the Trash."), never on a fixed time. The
// editors of a product and a coupon are plain forms: fill them with the
// webship-js steps (I fill in "Product name" with "...", I press "Publish").

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  clean,
  listed,
  same,
  eventually,
  lastOrder,
  cutRequest,
  CUT_REQUEST_HINT,
} = require('./woocommerce-helpers');

const ORDERS_SCREEN = '/wp-admin/admin.php?page=wc-orders';

/** The notices of an administration screen (`#message`, `.notice`), as text. */
async function adminNotices(world) {
  return world.page.locator('#wpbody-content .notice, #wpbody-content .updated, #wpbody-content #message').allTextContents()
    .then((all) => all.map(clean).filter(Boolean)).catch(() => []);
}

/** Wait for a notice of the screen holding a text, or fail with the notices there are. */
async function expectNotice(world, text, what) {
  await eventually(world, () => adminNotices(world), (all) => all.some((n) => n.toLowerCase().includes(text.toLowerCase())), (all) => {
    const cut = cutRequest(world);
    return {
      message: `The screen did not confirm that ${what}: no notice "${text}". ${cut ? `${cut.charAt(0).toUpperCase()}${cut.slice(1)}.` : `Its notices: ${listed(all || [])}.`}`,
      hint: cut ? CUT_REQUEST_HINT : 'The administration confirms a change with a notice at the top of the screen.',
    };
  }, budget(world) * 3);
}

/**
 * Open an administration screen, and fail plainly when the site sends the
 * browser to its login page instead (the session is not, or no longer, an
 * account's).
 */
async function openAdmin(world, url) {
  await navigate(world, url);
  if (/\/wp-login\.php/.test(new URL(world.page.url()).pathname)) {
    throw friendly({
      message: `The site sent the browser to its login page instead of ${url}: the session is not logged in.`,
      hint: 'Log in first, as an account allowed to manage the shop: Given I am a logged in user with the "shop_manager" user.',
    });
  }
}

/** Submit a form by its button and wait for the page that comes back. */
async function submitAndWait(world, locator) {
  await Promise.all([
    world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(world) * 6 }).catch(() => {}),
    locator.click(),
  ]);
  await settle(world);
}

/**
 * The row of the orders list for an order number, on the screen the browser
 * shows: its order cell reads "#59 Gina Guest" (a link to the order's screen,
 * except in the trash).
 */
async function orderRowIn(world, number) {
  return world.page.evaluate((n) => {
    for (const tr of document.querySelectorAll('table.wp-list-table tbody tr')) {
      const cell = tr.querySelector('.column-order_number');
      if (!cell) continue;
      const m = cell.textContent.match(/#\s*([A-Za-z0-9-]+)/);
      if (m && m[1] === String(n)) {
        const link = cell.querySelector('a.order-view');
        const status = tr.querySelector('.column-order_status');
        return { id: tr.id, href: link ? link.href : null, label: cell.textContent.replace(/\s+/g, ' ').trim(), status: status ? status.textContent.replace(/\s+/g, ' ').trim() : '' };
      }
    }
    return null;
  }, number);
}

/** The orders the orders list of the screen shows, as their order cells read ("#59 Gina Guest"). */
async function listedOrders(world) {
  return world.page.locator('table.wp-list-table tbody tr .column-order_number').allTextContents()
    .then((all) => all.map((t) => clean(t).replace(/\s*(Preview|Edit)\s*/g, ' ').trim()).filter((t) => /^#/.test(t))).catch(() => []);
}

/** Open the orders list searched for an order number, as a person types it in "Search orders". */
async function searchOrders(world, number, status) {
  const query = new URLSearchParams({ page: 'wc-orders', s: String(number) });
  if (status) query.set('status', status);
  await openAdmin(world, `/wp-admin/admin.php?${query.toString()}`);
}

/** The order screen of the browser, or fail: an order step needs one open. */
async function requireOrderScreen(world) {
  if (!(await world.page.locator('#order_status').count())) {
    throw friendly({ message: `The page is not the screen of an order (${world.page.url()}).`, hint: 'Open it first: When I open the last placed order in the admin.' });
  }
}

/**
 * Open the order the scenario placed last in the store's administration, as
 * a person finds it: its number searched for in the orders list, its link
 * opened.
 *
 * Example #1: When I open the last placed order in the admin
 * Example #2: When we open the last placed order in the admin
 * Example #3: And I open the last placed order in the admin
 * Example #4: When I open the last placed order in the admin
 * Example #5: And we open the last placed order in the admin
 */
When(/^(I |we )*open the last placed order in the admin$/, async function (pronounCase) {
  const order = lastOrder(this);
  await searchOrders(this, order.number);
  const row = await eventually(this, () => orderRowIn(this, order.number), (r) => Boolean(r), () => ({
    message: `Order #${order.number} is not in the orders list (${this.page.url()}).`,
    hint: 'The account must be allowed to manage orders (an administrator, a shop manager).',
  }));
  await navigate(this, row.href);
  await eventually(this, () => this.page.locator('.woocommerce-order-data__heading').textContent().catch(() => ''), (h) => clean(h).includes(`#${order.number}`), (h) => ({
    message: `Opened order #${order.number}, but the screen shows "${clean(h) || 'no order'}".`,
    hint: 'The screen of an order is titled "Order #<number>".',
  }));
});

/**
 * Assert the orders list of the administration lists, or does not list, the
 * order the scenario placed last, and with "as" its status as the list shows
 * it.
 *
 * Example #1: Then the orders list should include the last placed order
 * Example #2: And the orders list should include the last placed order as "On hold"
 * Example #3: Then the orders list should include the last placed order as "Processing"
 * Example #4: Then the orders list should not include the last placed order
 * Example #5: And the orders list should include the last placed order as "Completed"
 */
Then(/^the orders list should( not)* include the last placed order(?: as "([^"]*)")?$/, async function (notCase, status) {
  const order = lastOrder(this);
  await searchOrders(this, order.number);
  const row = await orderRowIn(this, order.number);
  if (notCase) {
    if (row) throw friendly({ message: `Expected order #${order.number} not in the orders list, but it is there (${row.status}).`, hint: 'An order moved to the trash is in the list\'s "Trash" view only.' });
    return;
  }
  if (!row) {
    throw friendly({ message: `Order #${order.number} is not in the orders list. It lists: ${listed(await listedOrders(this))}.`, hint: 'The account must be allowed to manage orders.' });
  }
  if (status && !same(row.status, status)) {
    throw friendly({ message: `Order #${order.number} is "${row.status}" in the orders list, not "${status}".`, hint: 'The list shows each order\'s status as a label ("On hold", "Processing", "Completed").' });
  }
});

/**
 * Assert the status of an order, as the page shows it: the "Status" menu of
 * the order's screen in the administration, or the line "… is currently
 * Processing." of the order's page in the customer's account.
 *
 * Example #1: Then the order status should be "On hold"
 * Example #2: And the order status should be "Processing"
 * Example #3: Then the order status should be "Completed"
 * Example #4: Then the order status should not be "Pending payment"
 * Example #5: And the order status should not be "Cancelled"
 */
Then(/^the order status should( not)* be "([^"]*)"$/, async function (notCase, status) {
  const read = () => this.page.evaluate(() => {
    const select = document.querySelector('#order_status');
    if (select) return select.selectedOptions[0] ? select.selectedOptions[0].textContent.replace(/\s+/g, ' ').trim() : '';
    const mark = document.querySelector('mark.order-status, .woocommerce-order-status, .order-status');
    return mark ? mark.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  await eventually(this, read, (shown) => shown !== null && same(shown, status) !== Boolean(notCase), (shown) => ({
    message: shown === null || shown === undefined
      ? `The page shows no order status (${this.page.url()}).`
      : (notCase ? `Expected the order not "${status}", but it is.` : `Expected the order status "${status}", but it is "${shown}".`),
    hint: 'The status is read on the screen of an order in the administration, or on the order\'s page in the customer\'s account.',
  }));
});

/**
 * Change the status of the order on its screen in the administration, by the
 * label of the status ("Completed", "Processing", "On hold", "Cancelled"),
 * and save it with "Update"; the step waits for the screen's "Order updated."
 *
 * Example #1: When I change the order status to "Completed"
 * Example #2: When we change the order status to "Processing"
 * Example #3: And I change the order status to "Cancelled"
 * Example #4: When I change the order status to "On hold"
 * Example #5: And we change the order status to "Completed"
 */
When(/^(I |we )*change the order status to "([^"]*)"$/, async function (pronounCase, status) {
  await requireOrderScreen(this);
  const select = this.page.locator('#order_status');
  const options = await select.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
  const option = options.find((o) => same(o, status));
  if (!option) {
    throw friendly({ message: `An order has no status "${status}". The statuses: ${listed(options)}.`, hint: 'Name the status as the "Status" menu of the order shows it.' });
  }
  await select.selectOption({ label: option });
  await submitAndWait(this, this.page.locator('button[name="save"].save_order, button.save_order').first());
  await expectNotice(this, 'Order updated', `the order was saved as "${option}"`);
});

/**
 * Assert the notes of the order on its screen in the administration (the
 * store's own notes, "Order status changed from On hold to Completed.",
 * "Email “Completed order” sent.", and the shop's private notes) include, or
 * do not include, a text.
 *
 * Example #1: Then the order notes should include "Order status changed from On hold to Completed."
 * Example #2: And the order notes should include "Completed order"
 * Example #3: Then the order notes should include "A note of the webship-js suite"
 * Example #4: Then the order notes should not include "Order status changed to Cancelled"
 * Example #5: And the order notes should include "New order"
 */
Then(/^the order notes should( not)* include "([^"]*)"$/, async function (notCase, text) {
  await requireOrderScreen(this);
  const read = () => this.page.locator('ul.order_notes li .note_content').allTextContents().then((all) => all.map(clean));
  await eventually(this, read, (notes) => notes.some((n) => n.toLowerCase().includes(clean(text).toLowerCase())) !== Boolean(notCase), (notes) => ({
    message: notCase ? `Expected no order note "${text}", but the order has it.` : `Expected the order note "${text}". The notes: ${listed(notes || [])}.`,
    hint: 'The notes are in the "Order notes" box of the order\'s screen; quotes are matched as plain quotes.',
  }));
});

/**
 * Add a private note to the order on its screen in the administration (the
 * "Add note" box); the step waits until the note is in the order's notes.
 *
 * Example #1: When I add the order note "A note of the webship-js suite"
 * Example #2: When we add the order note "Packed and ready to ship"
 * Example #3: And I add the order note "Called the customer"
 * Example #4: When I add the order note "A note of the webship-js suite"
 * Example #5: And we add the order note "Gift wrapped"
 */
When(/^(I |we )*add the order note "([^"]*)"$/, async function (pronounCase, text) {
  await requireOrderScreen(this);
  const field = this.page.locator('#add_order_note');
  if (!(await field.count())) {
    throw friendly({ message: 'The order\'s screen has no "Add note" box.', hint: 'The box is under the order notes, on the side of the order\'s screen.' });
  }
  await field.fill(text);
  await this.page.locator('button.add_note').click();
  await eventually(this, () => this.page.locator('ul.order_notes li .note_content').allTextContents().then((all) => all.map(clean)), (notes) => notes.some((n) => n.includes(clean(text))), () => ({
    message: `Added the order note "${text}", but it did not show in the order's notes.`,
    hint: 'The box adds a note without reloading the screen.',
  }), budget(this) * 3);
});

/**
 * Assert who the order on its screen in the administration belongs to: a
 * guest (no account: the "Customer" field is empty), or an account of the
 * users registry.
 *
 * Example #1: Then the order should belong to a guest
 * Example #2: Then the order should belong to "customer"
 * Example #3: And the order should belong to a guest
 * Example #4: And the order should belong to "customer"
 * Example #5: Then the order should belong to "shop_manager"
 */
Then(/^the order should belong to (?:a guest|"([^"]*)")$/, async function (handle) {
  await requireOrderScreen(this);
  const shown = clean(await this.page.evaluate(() => {
    const select = document.querySelector('#customer_user');
    const option = select && select.selectedOptions[0];
    return option && option.value ? option.textContent : '';
  }));
  if (!handle) {
    if (shown) throw friendly({ message: `Expected the order to belong to a guest, but it belongs to "${shown}".`, hint: 'An order placed without logging in belongs to no account: its "Customer" field is empty ("Guest").' });
    return;
  }
  const users = (this.parameters && this.parameters.users) || {};
  const entry = users[handle];
  const account = entry && typeof entry === 'object' ? entry : {};
  const marks = [account.email, account.username, handle].filter(Boolean).map((m) => m.toLowerCase());
  if (!shown || !marks.some((m) => shown.toLowerCase().includes(m))) {
    throw friendly({
      message: `Expected the order to belong to "${handle}", but it belongs to ${shown ? `"${shown}"` : 'a guest'}.`,
      hint: 'The "Customer" field of the order names the account (its name, id and email address).',
    });
  }
});

/**
 * Delete the order the scenario placed last, as a person does in the
 * administration: "Move to trash" on its screen, then "Delete permanently" in
 * the trash. The scenario leaves the shop as it found it.
 *
 * Example #1: When I delete the last placed order
 * Example #2: When we delete the last placed order
 * Example #3: And I delete the last placed order
 * Example #4: When I delete the last placed order
 * Example #5: And we delete the last placed order
 */
When(/^(I |we )*delete the last placed order$/, async function (pronounCase) {
  const order = lastOrder(this);
  await searchOrders(this, order.number);
  const row = await orderRowIn(this, order.number);
  if (row) {
    await navigate(this, row.href);
    const trash = this.page.locator('#delete-action a.submitdelete, a.submitdelete').first();
    if (!(await trash.count())) {
      throw friendly({ message: `The screen of order #${order.number} has no "Move to trash".`, hint: 'The account must be allowed to delete orders.' });
    }
    await submitAndWait(this, trash);
    await expectNotice(this, 'moved to the Trash', `order #${order.number} went to the trash`);
  }
  await searchOrders(this, order.number, 'trash');
  const trashed = await orderRowIn(this, order.number);
  if (!trashed) {
    throw friendly({ message: `Order #${order.number} is neither in the orders list nor in its trash.`, hint: 'It may have been deleted already.' });
  }
  await this.page.locator(`tr#${trashed.id} input[type="checkbox"], tr#${trashed.id} th.check-column input`).first().check();
  await this.page.locator('#bulk-action-selector-top').selectOption('delete');
  await submitAndWait(this, this.page.locator('#doaction'));
  await expectNotice(this, 'permanently deleted', `order #${order.number} was deleted`);
});

// ---------------------------------------------------------------------------
// The products and coupons lists
// ---------------------------------------------------------------------------

const LISTS = {
  product: { screen: '/wp-admin/edit.php?post_type=product', plural: 'products' },
  coupon: { screen: '/wp-admin/edit.php?post_type=shop_coupon', plural: 'coupons' },
};

/** The titles of the list rows the screen shows, with their row ids and edit links. */
async function listRows(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('table.wp-list-table tbody tr')].map((tr) => {
    const title = tr.querySelector('a.row-title');
    return title ? { id: tr.id, title: title.textContent.replace(/\s+/g, ' ').trim(), href: title.href } : null;
  }).filter(Boolean));
}

/** Open the list of products or coupons, searched for a name, in one of its views (all, trash). */
async function openList(world, kind, name, status) {
  const query = new URLSearchParams({ s: name, post_status: status || 'all' });
  await openAdmin(world, `${LISTS[kind].screen}&${query.toString()}`);
}

/**
 * Assert the products list or the coupons list of the administration
 * includes, or does not include, an entry by its name (a coupon by its code);
 * the list is searched for it, as a person does with a long list.
 *
 * Example #1: Then the products list should include "Suite Mug"
 * Example #2: And the coupons list should include "suite10"
 * Example #3: Then the products list should not include "Suite Mug"
 * Example #4: Then the coupons list should not include "suite10"
 * Example #5: And the products list should include "Beanie"
 */
Then(/^the (product|coupon)s list should( not)* include "([^"]*)"$/, async function (kind, notCase, name) {
  await openList(this, kind, name);
  const rows = await listRows(this);
  const found = rows.some((r) => same(r.title, name));
  if (found === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected no ${kind} "${name}" in the ${kind}s list, but it is there.` : `Expected the ${kind} "${name}" in the ${kind}s list. The search finds: ${listed(rows.map((r) => r.title))}.`,
      hint: `The ${kind}s list holds the entries that are not in the trash; an entry is found by its title.`,
    });
  }
});

/**
 * Open a product or a coupon in its editor in the administration, by its
 * name (a coupon by its code), from its list.
 *
 * Example #1: When I open the product "Suite Mug" in the admin
 * Example #2: When we open the coupon "suite10" in the admin
 * Example #3: And I open the product "Beanie" in the admin
 * Example #4: When I open the coupon "suite5" in the admin
 * Example #5: And we open the product "Suite Mug" in the admin
 */
When(/^(I |we )*open the (product|coupon) "([^"]*)" in the admin$/, async function (pronounCase, kind, name) {
  await openList(this, kind, name);
  const row = (await listRows(this)).find((r) => same(r.title, name));
  if (!row) {
    throw friendly({ message: `The ${kind}s list has no "${name}".`, hint: `Name the ${kind} as its list shows it.` });
  }
  await navigate(this, row.href);
  await this.page.locator('#title').waitFor({ state: 'visible', timeout: budget(this) * 2 }).catch(() => {});
});

/**
 * Move a product or a coupon to the trash, with the "Trash" link of its row
 * in its list; the step waits for the list's notice ("1 product moved to the
 * Trash.").
 *
 * Example #1: When I move the product "Suite Mug" to the trash
 * Example #2: When we move the coupon "suite10" to the trash
 * Example #3: And I move the coupon "suite5" to the trash
 * Example #4: When I move the product "Suite Mug" to the trash
 * Example #5: And we move the product "Suite Mug" to the trash
 */
When(/^(I |we )*move the (product|coupon) "([^"]*)" to the trash$/, async function (pronounCase, kind, name) {
  await openList(this, kind, name);
  const row = (await listRows(this)).find((r) => same(r.title, name));
  if (!row) {
    throw friendly({ message: `The ${kind}s list has no "${name}" to move to the trash.`, hint: `Name the ${kind} as its list shows it.` });
  }
  const trash = this.page.locator(`tr#${row.id} .row-actions .trash a, tr#${row.id} a.submitdelete`).first();
  const href = await trash.getAttribute('href');
  await navigate(this, href);
  await expectNotice(this, 'moved to the Trash', `the ${kind} "${name}" went to the trash`);
});

/**
 * Delete a product or a coupon for good: from the trash of its list, with
 * the "Delete Permanently" link of its row (an entry that is not in the trash
 * yet is moved there first).
 *
 * Example #1: When I delete the product "Suite Mug" permanently
 * Example #2: When we delete the coupon "suite10" permanently
 * Example #3: And I delete the coupon "suite5" permanently
 * Example #4: When I delete the product "Suite Mug" permanently
 * Example #5: And we delete the product "Suite Mug" permanently
 */
When(/^(I |we )*delete the (product|coupon) "([^"]*)" permanently$/, async function (pronounCase, kind, name) {
  await openList(this, kind, name);
  const live = (await listRows(this)).find((r) => same(r.title, name));
  if (live) {
    const trash = this.page.locator(`tr#${live.id} .row-actions .trash a`).first();
    await navigate(this, await trash.getAttribute('href'));
    await expectNotice(this, 'moved to the Trash', `the ${kind} "${name}" went to the trash`);
  }
  await openList(this, kind, name, 'trash');
  const trashed = await this.page.evaluate((n) => {
    for (const tr of document.querySelectorAll('table.wp-list-table tbody tr')) {
      const title = tr.querySelector('.row-title, strong');
      if (title && title.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === n.toLowerCase()) {
        const del = tr.querySelector('.row-actions .delete a');
        return del ? del.href : null;
      }
    }
    return null;
  }, clean(name));
  if (!trashed) {
    throw friendly({ message: `The trash of the ${kind}s list has no "${name}" to delete.`, hint: `Move it to the trash first, or check its name.` });
  }
  await navigate(this, trashed);
  await expectNotice(this, 'permanently deleted', `the ${kind} "${name}" was deleted`);
});

/** Every entry of the products or coupons list (one view: all, trash) whose title is a name: `[{ id, trash, del }]`. */
async function rowsNamed(world, name) {
  return world.page.evaluate((n) => [...document.querySelectorAll('table.wp-list-table tbody tr')].filter((tr) => {
    const title = tr.querySelector('.row-title, strong');
    return title && title.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === n.toLowerCase();
  }).map((tr) => ({
    id: tr.id,
    trash: tr.querySelector('.row-actions .trash a') ? tr.querySelector('.row-actions .trash a').href : null,
    del: tr.querySelector('.row-actions .delete a') ? tr.querySelector('.row-actions .delete a').href : null,
  })), clean(name));
}

/**
 * Make sure the store has no product or coupon of a name (a coupon by its
 * code), in its list or in its trash: what an earlier run that stopped half
 * way left is deleted for good. A scenario that creates an entry starts with
 * it. The account logged in must be allowed to delete them.
 *
 * Example #1: Given there is no product "Suite Mug"
 * Example #2: Given there is no coupon "suite10"
 * Example #3: And there is no product "Suite Mug"
 * Example #4: And there is no coupon "suite5"
 * Example #5: Given there is no coupon "suite10"
 */
Given(/^there is no (product|coupon) "([^"]*)"$/, async function (kind, name) {
  for (let round = 0; round < 5; round += 1) {
    await openList(this, kind, name);
    const live = await rowsNamed(this, name);
    for (const row of live) {
      if (row.trash) await navigate(this, row.trash);
    }
    await openList(this, kind, name, 'trash');
    const trashed = await rowsNamed(this, name);
    for (const row of trashed) {
      if (row.del) await navigate(this, row.del);
    }
    if (!live.length && !trashed.length) return;
  }
  throw friendly({ message: `The ${kind} "${name}" is still in the store after it was deleted five times.`, hint: `The account must be allowed to delete ${kind}s (an administrator, a shop manager).` });
});

/**
 * Delete for good every order of an email address (the billing email the
 * checkout took): the orders list searched for it, the rows moved to the
 * trash, then deleted from the trash. A run of the suite cleans up the orders
 * of its test addresses with it.
 *
 * Example #1: When I delete the orders of "must-fail@example.com"
 * Example #2: When we delete the orders of "guest@example.com"
 * Example #3: And I delete the orders of "must-fail@example.com"
 * Example #4: When I delete the orders of "gina.guest@example.com"
 * Example #5: And we delete the orders of "guest@example.com"
 */
When(/^(I |we )*delete the orders of "([^"]*)"$/, async function (pronounCase, email) {
  const bulk = async (status, action) => {
    await openAdmin(this, `/wp-admin/admin.php?${new URLSearchParams(Object.assign({ page: 'wc-orders', s: email }, status ? { status } : {})).toString()}`);
    const rows = await listedOrders(this);
    if (!rows.length) return 0;
    await this.page.locator('#cb-select-all-1').check();
    await this.page.locator('#bulk-action-selector-top').selectOption(action);
    await submitAndWait(this, this.page.locator('#doaction'));
    return rows.length;
  };
  for (let round = 0; round < 5; round += 1) {
    const live = await bulk(null, 'trash');
    const trashed = await bulk('trash', 'delete');
    if (!live && !trashed) return;
  }
  throw friendly({ message: `Orders of ${email} are still in the store after they were deleted five times.`, hint: 'The account must be allowed to delete orders (an administrator, a shop manager).' });
});
