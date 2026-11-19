'use strict';

// The cart: emptying it, the mini cart in the header (its count, opening it,
// what it holds), and the cart page (the products it holds, their quantities,
// removing one, a coupon, the totals, the empty cart).
//
// The cart and checkout pages are blocks that keep the cart in a data store
// of the page ("wc/store/cart") and change it through the store's cart API. A
// change starts a moment after the click or the typing (the quantity field
// waits for the person to stop typing), so the steps never wait on "nothing
// is pending" alone: they wait for the cart to hold what the action asked for
// (the new quantity, the product gone, the coupon applied or refused), with
// nothing pending.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  siteRoot,
  clean,
  listed,
  same,
  samePrice,
  eventually,
  waitForCart,
  cartState,
  cartRow,
} = require('./woocommerce-helpers');

/** The cart or checkout block of the page (never the mini cart's drawer), or fail plainly. */
async function cartBlock(world) {
  const block = world.page.locator('.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout').first();
  if (!(await block.count())) {
    throw friendly({
      message: `The page shows no cart (${world.page.url()}).`,
      hint: 'Go to the cart first: When I go to the cart. The mini cart has steps of its own ("the mini cart should contain").',
    });
  }
  return block;
}

/** The mini cart's button in the header. */
function miniCartButton(world) {
  return world.page.locator('.wc-block-mini-cart__button, .wc-block-mini-cart button').first();
}

/** The mini cart's drawer, once it is open. */
function miniCartDrawer(world) {
  return world.page.locator('.wc-block-mini-cart__drawer[role="dialog"], .wc-block-mini-cart__drawer').first();
}

// ---------------------------------------------------------------------------
// Emptying the cart
// ---------------------------------------------------------------------------

/**
 * Empty the cart of the browser's session (its products and its coupons)
 * through the store's cart API, the one the cart page uses itself: a scenario
 * that starts from an empty cart says so. A cart page on the screen is loaded
 * again.
 *
 * Example #1: Given my cart is empty
 * Example #2: Given our cart is empty
 * Example #3: And my cart is empty
 * Example #4: Given my cart is empty
 * Example #5: And our cart is empty
 */
Given(/^(?:my|our) cart is empty$/, async function () {
  const base = `${siteRoot(this.launchUrl)}/wp-json/wc/store/v1`;
  const request = this.context.request;
  const read = async () => {
    const response = await request.get(`${base}/cart`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
    if (!response.ok()) {
      throw friendly({ message: `The store's cart API answered HTTP ${response.status()} at ${base}/cart.`, hint: 'The cart API is the one the cart and checkout blocks use; launchUrl must point at the shop.' });
    }
    return { cart: await response.json(), nonce: response.headers().nonce };
  };
  let { cart, nonce } = await read();
  for (const coupon of cart.coupons || []) {
    await request.post(`${base}/cart/remove-coupon`, { data: { code: coupon.code }, headers: { Nonce: nonce }, failOnStatusCode: false, ignoreHTTPSErrors: true });
  }
  for (const item of cart.items || []) {
    await request.post(`${base}/cart/remove-item`, { data: { key: item.key }, headers: { Nonce: nonce }, failOnStatusCode: false, ignoreHTTPSErrors: true });
  }
  ({ cart } = await read());
  if ((cart.items || []).length) {
    throw friendly({ message: `The cart still holds ${listed(cart.items.map((i) => i.name))} after it was emptied.`, hint: 'The cart API refused the removal; a store message on the cart page may say why.' });
  }
  if (await this.page.locator('.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout, .wc-block-mini-cart').count()) {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await settle(this);
  }
});

// ---------------------------------------------------------------------------
// The mini cart
// ---------------------------------------------------------------------------

/**
 * Assert the number of items the mini cart in the header counts (its badge,
 * and the name of its button: "Number of items in the cart: 2").
 *
 * Example #1: Then the mini cart should show 1 item
 * Example #2: And the mini cart should show 2 items
 * Example #3: Then the mini cart should show 0 items
 * Example #4: Then the mini cart should show 3 items
 * Example #5: And the mini cart should show 1 item
 */
Then(/^the mini cart should show (\d+) items?$/, async function (count) {
  const button = miniCartButton(this);
  if (!(await button.count())) {
    throw friendly({ message: `The page has no mini cart (${this.page.url()}).`, hint: 'The mini cart is the cart button a theme puts in its header (the Mini-Cart block).' });
  }
  await eventually(this, async () => {
    const label = clean(await button.getAttribute('aria-label'));
    const m = label.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }, (n) => n === Number(count), (n) => ({
    message: `Expected the mini cart to count ${count} item(s), but it counts ${n}.`,
    hint: 'The mini cart counts the items of the cart (a product twice is two items).',
  }));
});

/**
 * Open the mini cart: its drawer with the products of the cart, the subtotal,
 * and the links to the cart and the checkout.
 *
 * Example #1: When I open the mini cart
 * Example #2: When we open the mini cart
 * Example #3: And I open the mini cart
 * Example #4: When I open the mini cart
 * Example #5: And we open the mini cart
 */
When(/^(I |we )*open the mini cart$/, async function (pronounCase) {
  const button = miniCartButton(this);
  if (!(await button.count())) {
    throw friendly({ message: `The page has no mini cart (${this.page.url()}).`, hint: 'The mini cart is the cart button a theme puts in its header (the Mini-Cart block).' });
  }
  await button.click();
  const drawer = miniCartDrawer(this);
  try {
    await drawer.waitFor({ state: 'visible', timeout: budget(this) * 2 });
    await this.page.waitForFunction(() => {
      const d = document.querySelector('.wc-block-mini-cart__drawer');
      return d && !d.querySelector('.wc-block-components-skeleton__element:not(.wc-block-components-skeleton__element--static), .wc-block-components-loading-mask, [aria-busy="true"]');
    }, null, { timeout: budget(this) * 2 });
  } catch (err) {
    throw friendly({ message: 'Clicked the mini cart, but its drawer did not open.', hint: 'The mini cart opens a dialog with the products of the cart.' });
  }
  await settle(this);
});

/**
 * Assert a product is (or is not) in the mini cart's drawer, by the name it
 * shows. Open the mini cart first.
 *
 * Example #1: Then the mini cart should contain "Beanie"
 * Example #2: And the mini cart should contain "Hoodie"
 * Example #3: Then the mini cart should not contain "Cap"
 * Example #4: Then the mini cart should contain "Album"
 * Example #5: But the mini cart should not contain "Beanie"
 */
Then(/^the mini cart should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  const drawer = miniCartDrawer(this);
  if (!(await drawer.count()) || !(await drawer.isVisible())) {
    throw friendly({ message: 'The mini cart is not open.', hint: 'Open it first: When I open the mini cart.' });
  }
  const names = () => drawer.locator('.wc-block-components-product-name').allTextContents();
  await eventually(this, names, (all) => all.some((n) => same(n, name)) !== Boolean(notCase), (all) => ({
    message: notCase
      ? `Expected no "${name}" in the mini cart, but it holds it.`
      : `Expected "${name}" in the mini cart. It holds: ${listed(all)}.`,
    hint: 'The mini cart shows the products of the cart by their names.',
  }));
});

// ---------------------------------------------------------------------------
// The cart page
// ---------------------------------------------------------------------------

/**
 * Assert a product is (or is not) in the cart, on the cart page or in the
 * checkout's order summary, by the name the cart shows.
 *
 * Example #1: Then the cart should contain "Hoodie"
 * Example #2: And the cart should contain "Beanie"
 * Example #3: Then the cart should not contain "Cap"
 * Example #4: Then the cart should contain "V-Neck T-Shirt"
 * Example #5: But the cart should not contain "Beanie"
 */
Then(/^the cart should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  await cartBlock(this);
  await waitForCart(this, null, 'load');
  await eventually(this, () => cartState(this), (cart) => cart.items.some((i) => same(i.name, name)) !== Boolean(notCase), (cart) => ({
    message: notCase
      ? `Expected no "${name}" in the cart, but it holds it.`
      : `Expected "${name}" in the cart. It holds: ${listed((cart ? cart.items : []).map((i) => i.name))}.`,
    hint: 'The cart is read on the cart page or the checkout.',
  }));
});

/**
 * Change the quantity of a product in the cart, in its quantity field, as a
 * person types it; the step waits until the cart holds that quantity.
 *
 * Example #1: When I change the cart quantity of "Beanie" to 2
 * Example #2: When we change the cart quantity of "Hoodie" to 3
 * Example #3: And I change the cart quantity of "Cap" to 1
 * Example #4: When I change the cart quantity of "Beanie" to 5
 * Example #5: And we change the cart quantity of "Polo" to 2
 */
When(/^(I |we )*change the cart quantity of "([^"]*)" to (\d+)$/, async function (pronounCase, name, quantity) {
  const block = await cartBlock(this);
  await waitForCart(this, null, 'load');
  const row = await cartRow(block, name);
  if (!row) {
    const cart = await cartState(this);
    throw friendly({ message: `The cart holds no "${name}". It holds: ${listed(cart.items.map((i) => i.name))}.`, hint: 'Name the product as the cart shows it.' });
  }
  const field = row.locator('input.wc-block-components-quantity-selector__input, input[type="number"]').first();
  await field.fill(String(quantity));
  await field.blur();
  const wanted = Number(quantity);
  await eventually(this, async () => {
    await waitForCart(this, null, `take the quantity ${wanted} of "${name}"`);
    return cartState(this);
  }, (cart) => cart.items.some((i) => same(i.name, name) && i.quantity === wanted), (cart) => ({
    message: `Changed the quantity of "${name}" to ${wanted}, but the cart holds ${listed((cart ? cart.items : []).map((i) => `${i.name} × ${i.quantity}`))}.`,
    hint: `The store may limit the quantity (stock, "sold individually"); its message says why.${cart && cart.errors && cart.errors.length ? ` The cart says: ${listed(cart.errors)}.` : ''}`,
  }), budget(this) * 4);
});

/**
 * Assert the quantity of a product in the cart.
 *
 * Example #1: Then the cart quantity of "Beanie" should be 2
 * Example #2: And the cart quantity of "Hoodie" should be 1
 * Example #3: Then the cart quantity of "Cap" should be 3
 * Example #4: Then the cart quantity of "Beanie" should be 1
 * Example #5: And the cart quantity of "Polo" should be 2
 */
Then(/^the cart quantity of "([^"]*)" should be (\d+)$/, async function (name, quantity) {
  await cartBlock(this);
  await waitForCart(this, null, 'load');
  await eventually(this, () => cartState(this), (cart) => cart.items.some((i) => same(i.name, name) && i.quantity === Number(quantity)), (cart) => {
    const item = (cart ? cart.items : []).find((i) => same(i.name, name));
    return {
      message: item ? `Expected ${quantity} of "${name}" in the cart, but it holds ${item.quantity}.` : `Expected ${quantity} of "${name}" in the cart, but it holds none. It holds: ${listed((cart ? cart.items : []).map((i) => i.name))}.`,
      hint: 'The quantity is the one of the product\'s line in the cart.',
    };
  });
});

/**
 * Remove a product from the cart with its "Remove" link; the step waits until
 * the cart no longer holds it.
 *
 * Example #1: When I remove "Beanie" from the cart
 * Example #2: When we remove "Hoodie" from the cart
 * Example #3: And I remove "Cap" from the cart
 * Example #4: When I remove "V-Neck T-Shirt" from the cart
 * Example #5: And we remove "Beanie" from the cart
 */
When(/^(I |we )*remove "([^"]*)" from the cart$/, async function (pronounCase, name) {
  const block = await cartBlock(this);
  await waitForCart(this, null, 'load');
  const remove = block.getByRole('button', { name: `Remove ${String(name).trim()} from cart`, exact: true }).first();
  if (!(await remove.count())) {
    const cart = await cartState(this);
    throw friendly({ message: `The cart has no "Remove" for "${name}". It holds: ${listed(cart.items.map((i) => i.name))}.`, hint: 'Each product of the cart has a link "Remove <product> from cart".' });
  }
  await remove.click();
  await eventually(this, async () => {
    await waitForCart(this, null, `drop "${name}"`);
    return cartState(this);
  }, (cart) => !cart.items.some((i) => same(i.name, name)), (cart) => ({
    message: `Removed "${name}", but the cart still holds it (${listed((cart ? cart.items : []).map((i) => i.name))}).`,
    hint: 'The cart page removes a product through the store\'s cart API.',
  }), budget(this) * 4);
});

/**
 * Assert the cart is empty: no product, and the cart page shows its empty
 * state ("Your cart is empty", "Return to shop").
 *
 * Example #1: Then the cart should be empty
 * Example #2: And the cart should be empty
 * Example #3: Then the cart should be empty
 * Example #4: Then the cart should be empty
 * Example #5: And the cart should be empty
 */
Then(/^the cart should be empty$/, async function () {
  await cartBlock(this);
  await eventually(this, async () => {
    await waitForCart(this, null, 'load');
    const cart = await cartState(this);
    const shown = await this.page.locator('.wp-block-woocommerce-empty-cart-block').isVisible().catch(() => false);
    return { cart, shown };
  }, ({ cart, shown }) => cart.items.length === 0 && shown, (state) => ({
    message: state && state.cart.items.length
      ? `Expected an empty cart, but it holds ${listed(state.cart.items.map((i) => `${i.name} × ${i.quantity}`))}.`
      : 'The cart holds no product, but the page does not show the empty cart.',
    hint: 'An empty cart page shows "Your cart is empty" and a link back to the shop.',
  }));
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

/**
 * Apply a coupon in the cart or the checkout: open "Add coupons", type the
 * code, press "Apply". The step waits for the store's answer, which is either
 * the coupon on the cart or the reason under the field ("the field error").
 *
 * Example #1: When I apply the coupon "suite10"
 * Example #2: When we apply the coupon "SUITE10"
 * Example #3: And I apply the coupon "no-such-coupon"
 * Example #4: When I apply the coupon "suite5"
 * Example #5: And we apply the coupon "suite10"
 */
When(/^(I |we )*apply the coupon "([^"]*)"$/, async function (pronounCase, code) {
  const block = await cartBlock(this);
  await waitForCart(this, null, 'load');
  const field = block.locator('#wc-block-components-totals-coupon__input-coupon, .wc-block-components-totals-coupon input[type="text"]').first();
  if (!(await field.isVisible().catch(() => false))) {
    const toggle = block.locator('.wc-block-components-totals-coupon [role="button"][aria-expanded="false"], .wc-block-components-totals-coupon button[aria-expanded="false"]').first();
    if (await toggle.count()) await toggle.click();
  }
  try {
    await field.waitFor({ state: 'visible', timeout: budget(this) });
  } catch (err) {
    throw friendly({ message: 'The cart has no coupon field ("Add coupons").', hint: 'The store hides coupons when they are turned off in its settings ("Enable the use of coupon codes").' });
  }
  await field.fill(code);
  await block.locator('.wc-block-components-totals-coupon').getByRole('button', { name: 'Apply', exact: true }).click();
  await eventually(this, async () => {
    await waitForCart(this, null, `answer for the coupon "${code}"`);
    const cart = await cartState(this);
    const refused = await block.locator('.wc-block-components-totals-coupon .wc-block-components-validation-error').count();
    return { cart, refused };
  }, ({ cart, refused }) => refused > 0 || cart.coupons.some((c) => same(c, code)), () => ({
    message: `Applied the coupon "${code}", but the store gave no answer: the coupon is not on the cart and no reason is under the field.`,
    hint: 'The store answers a coupon with the coupon on the cart, or with the reason under the field.',
  }), budget(this) * 4);
});

/**
 * Assert the cart has (or has not) a coupon, by its code (letter case aside:
 * the store keeps codes in lower case).
 *
 * Example #1: Then the cart should have the coupon "suite10"
 * Example #2: And the cart should have the coupon "SUITE10"
 * Example #3: Then the cart should not have the coupon "suite10"
 * Example #4: Then the cart should have the coupon "suite5"
 * Example #5: But the cart should not have the coupon "no-such-coupon"
 */
Then(/^the cart should( not)* have the coupon "([^"]*)"$/, async function (notCase, code) {
  await cartBlock(this);
  await waitForCart(this, null, 'load');
  await eventually(this, () => cartState(this), (cart) => cart.coupons.some((c) => same(c, code)) !== Boolean(notCase), (cart) => ({
    message: notCase
      ? `Expected no coupon "${code}" on the cart, but it is there.`
      : `Expected the coupon "${code}" on the cart. Its coupons: ${listed(cart ? cart.coupons : [])}.`,
    hint: 'A coupon the store accepted shows in the totals, under "Discount".',
  }));
});

/**
 * Remove a coupon from the cart, with the remove button of its chip under
 * "Discount".
 *
 * Example #1: When I remove the coupon "suite10"
 * Example #2: When we remove the coupon "SUITE10"
 * Example #3: And I remove the coupon "suite5"
 * Example #4: When I remove the coupon "suite10"
 * Example #5: And we remove the coupon "suite5"
 */
When(/^(I |we )*remove the coupon "([^"]*)"$/, async function (pronounCase, code) {
  const block = await cartBlock(this);
  await waitForCart(this, null, 'load');
  const cart = await cartState(this);
  const applied = cart.coupons.find((c) => same(c, code));
  if (!applied) {
    throw friendly({ message: `The cart has no coupon "${code}". Its coupons: ${listed(cart.coupons)}.`, hint: 'Apply it first: When I apply the coupon "..."' });
  }
  await block.getByRole('button', { name: `Remove coupon "${applied}"`, exact: true }).first().click();
  await eventually(this, async () => {
    await waitForCart(this, null, `drop the coupon "${code}"`);
    return cartState(this);
  }, (state) => !state.coupons.some((c) => same(c, code)), () => ({
    message: `Removed the coupon "${code}", but it is still on the cart.`,
    hint: 'The cart removes a coupon through the store\'s cart API.',
  }), budget(this) * 4);
});

// ---------------------------------------------------------------------------
// The totals
// ---------------------------------------------------------------------------

// The lines of the totals of the cart and checkout blocks, by the name a step
// gives them.
const TOTALS = {
  subtotal: '[class*="order-summary-subtotal-block"] .wc-block-components-totals-item__value',
  discount: '.wc-block-components-totals-discount .wc-block-components-totals-item__value',
  shipping: '.wc-block-components-totals-shipping .wc-block-components-totals-item__value',
  tax: '.wc-block-components-totals-taxes .wc-block-components-totals-item__value',
  'order total': '.wc-block-components-totals-footer-item .wc-block-components-totals-item__value',
};

/**
 * Assert a line of the totals of the cart or the checkout, as the page shows
 * it: the subtotal, the discount (with its minus sign), the shipping, the tax,
 * or the order total ("Estimated total" in the cart, "Total" at the checkout).
 *
 * Example #1: Then the cart subtotal should be "$45.00"
 * Example #2: And the cart discount should be "-$4.50"
 * Example #3: Then the cart shipping should be "$5.00"
 * Example #4: Then the cart order total should be "$45.50"
 * Example #5: And the cart tax should be "$0.00"
 */
Then(/^the cart (subtotal|shipping|discount|tax|order total) should be "([^"]*)"$/, async function (line, amount) {
  const block = await cartBlock(this);
  await waitForCart(this, null, 'load');
  const value = block.locator(TOTALS[line]).first();
  await eventually(this, async () => ((await value.count()) ? clean(await value.textContent()) : null), (shown) => shown !== null && samePrice(shown, amount), (shown) => ({
    message: shown === null || shown === undefined
      ? `Expected the cart ${line} "${amount}", but the totals have no ${line} line.`
      : `Expected the cart ${line} "${amount}", but it reads "${shown}".`,
    hint: 'The totals are the ones under the cart (or the checkout\'s order summary); a discount reads with its minus sign.',
  }));
});
