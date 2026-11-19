'use strict';

// Shared helpers for the shop's step files.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the step files share, on top of the WordPress pack's helpers (the
// page budget, navigation, the users registry): the store's pages, the
// product list and the navigations of its router, the cart and checkout
// blocks and the data stores they keep, the store's messages, the orders a
// scenario placed, and the mailbox of the test shop.

const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  siteRoot,
  joinUrl,
  navigate,
  resolveUser,
  supplied,
} = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** White space collapsed, typographic dashes and quotes made plain, trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‒-―−]/g, '-')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list for a failure message: "a", "b" and "c", or (none). */
function listed(items) {
  const all = (items || []).map((i) => `"${clean(i)}"`);
  if (!all.length) return '(none)';
  return all.length > 12 ? `${all.slice(0, 12).join(', ')} and ${all.length - 12} more` : all.join(', ');
}

/** The same text for a person: letter case, white space, dashes and quotes aside. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** A price as a number: "$1,234.50" → 1234.5. NaN when it holds no number. */
function priceValue(text) {
  const m = clean(text).replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
}

/** A price as the store prints it, for comparing: "$ 18.00" and "$18.00" are the same. */
function samePrice(a, b) {
  return clean(a).replace(/\s+/g, '') === clean(b).replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/**
 * Read something of the page again and again until `ok` holds for it, or the
 * wait budget (twice the page budget) is spent; then fail with the message
 * `fail` builds from the last reading.
 */
async function eventually(world, read, ok, fail, timeout) {
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let value;
  for (;;) {
    try {
      value = await read();
    } catch (err) {
      value = undefined;
      if (Date.now() > deadline) throw err;
    }
    if (value !== undefined && ok(value)) return value;
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(200);
  }
  throw friendly(fail(value));
}

/**
 * Wait for the store's router to finish a navigation it started: sorting and
 * the pages of the product list load in place (the document stays), the
 * address changes and the router's loading bar ends its animation.
 */
async function waitForRouter(world, urlOk, what) {
  try {
    await world.page.waitForURL((url) => urlOk(new URL(String(url))), { timeout: budget(world) * 3 });
    await world.page.waitForFunction(() => {
      const bar = document.querySelector('.wp-interactivity-router-loading-bar');
      return !bar || !bar.classList.contains('start-animation');
    }, null, { timeout: budget(world) * 3 });
  } catch (err) {
    throw friendly({
      message: `The product list did not ${what}: the address is still ${world.page.url()}.`,
      hint: 'The list loads in place through the store\'s router; a theme that renders it on the server reloads the page instead, which this step waits for too.',
    });
  }
  await settle(world);
}

// ---------------------------------------------------------------------------
// The store's pages
// ---------------------------------------------------------------------------

// The pages WooCommerce makes on its install, by their default address. A
// project whose shop moved them names its own in `worldParameters.storePages`.
const STORE_PAGES = {
  shop: '/shop/',
  cart: '/cart/',
  checkout: '/checkout/',
  'my account': '/my-account/',
};

/** The address of a store page: `worldParameters.storePages`, else the default. */
function storePagePath(world, name) {
  const own = (world.parameters && world.parameters.storePages) || {};
  const key = String(name).trim().toLowerCase();
  const pathOf = own[key] || own[key.replace(/ /g, '')] || STORE_PAGES[key];
  if (!pathOf) {
    throw friendly({
      message: `"${name}" is not a page of the store.`,
      hint: `The store pages: ${Object.keys(STORE_PAGES).join(', ')}. Set others in worldParameters.storePages in cucumber.js.`,
    });
  }
  return pathOf;
}

// ---------------------------------------------------------------------------
// The product list (the product collection block, or the classic loop)
// ---------------------------------------------------------------------------

/**
 * The products the page lists in its main product list, as a person reads
 * them: name, current price (the sale price of a product on sale, the lowest
 * of a range) and every price it shows (both ends of a range), whether it is
 * on sale, its category slugs, its link. The
 * block themes render `li.wc-block-product`, the classic ones
 * `ul.products li.product`; related and cross-sell lists are left out.
 */
async function listedProducts(world) {
  return world.page.evaluate(() => {
    const scope = document.querySelector('main') || document.body;
    const items = [...scope.querySelectorAll('.wp-block-woocommerce-product-collection li.wc-block-product, .wc-block-product-template li, ul.products li.product')]
      .filter((li) => !li.closest('.related, .upsells, .cross-sells, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection[data-collection*="related"], .wp-block-woocommerce-product-collection[data-collection*="upsell"], .wp-block-woocommerce-product-collection[data-collection*="cross"]'));
    const seen = new Set();
    const out = [];
    for (const li of items) {
      if (seen.has(li)) continue;
      seen.add(li);
      const box = li.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const titleLink = li.querySelector('h2 a, h3 a, .wp-block-post-title a, .woocommerce-loop-product__link, a.woocommerce-LoopProduct-link');
      const titleEl = li.querySelector('h2, h3, .wp-block-post-title, .woocommerce-loop-product__title') || titleLink;
      const priceEl = li.querySelector('.wc-block-components-product-price, .price');
      let price = '';
      let prices = [];
      if (priceEl) {
        const ins = priceEl.querySelector('ins .amount, ins');
        const amounts = [...priceEl.querySelectorAll('.woocommerce-Price-amount')]
          .filter((a) => !a.closest('del') && !a.closest('.screen-reader-text'));
        prices = amounts.map((a) => a.textContent.replace(/\s+/g, ' ').trim());
        price = (ins || amounts[0] || priceEl).textContent.replace(/\s+/g, ' ').trim();
      }
      const cats = [...li.classList].filter((c) => c.startsWith('product_cat-')).map((c) => c.slice('product_cat-'.length));
      out.push({
        name: titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '',
        price,
        prices,
        onSale: Boolean(li.querySelector('.onsale, .wc-block-components-product-sale-badge, [class*="sale-badge"]')),
        categories: cats,
        href: titleLink ? titleLink.href : '',
      });
    }
    return out;
  }).catch(() => []);
}

/** The products of the list by name, or fail with the names that are there. */
async function productInList(world, name) {
  const products = await eventually(world, () => listedProducts(world), (all) => all.some((p) => same(p.name, name)), (all) => ({
    message: `No product "${name}" is in the product list of ${world.page.url()}. It lists: ${listed((all || []).map((p) => p.name))}.`,
    hint: 'A product of the list is found by the name its title link shows. A product hidden from the catalog, or on another page of the list, is not there.',
  }));
  return products.find((p) => same(p.name, name));
}

/** The number of the page of the product list the browser shows (1 when the list has one page). */
async function currentListPage(world) {
  return world.page.evaluate(() => {
    const current = document.querySelector('.wp-block-query-pagination-numbers [aria-current="page"], .wp-block-query-pagination-numbers .current, nav.woocommerce-pagination [aria-current="page"], nav.woocommerce-pagination .current');
    if (current) return Number(current.textContent.replace(/\D+/g, '')) || 1;
    const m = location.pathname.match(/\/page\/(\d+)\/?$/) || location.search.match(/[?&](?:paged|product-page|query-\d+-page)=(\d+)/);
    return m ? Number(m[1]) : 1;
  });
}

// ---------------------------------------------------------------------------
// The product page
// ---------------------------------------------------------------------------

/** The add-to-cart form of the product the page shows. */
function addToCartForm(world) {
  return world.page.locator('form.cart, form.variations_form, form.wc-block-add-to-cart-with-options').first();
}

/**
 * The options of a variable product (its attribute selects), with the label a
 * person reads: `[{ id, name, label, value, options: [label] }]`.
 */
async function productOptions(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('form.variations_form select[name^="attribute_"], form.cart select[name^="attribute_"]')].map((s) => {
    const label = (s.id && document.querySelector(`label[for="${s.id}"]`)) || s.closest('tr, .variation, li, p, div')?.querySelector('label, th');
    return {
      id: s.id,
      name: s.name,
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : s.name.replace(/^attribute_(pa_)?/, ''),
      value: s.value,
      selected: s.selectedOptions[0] ? s.selectedOptions[0].textContent.replace(/\s+/g, ' ').trim() : '',
      options: [...s.options].filter((o) => o.value).map((o) => o.textContent.replace(/\s+/g, ' ').trim()),
    };
  }));
}

/** The current price the product page shows: the chosen variation's, else the product's. */
async function productPagePrice(world) {
  return world.page.evaluate(() => {
    const read = (el) => {
      if (!el) return '';
      const ins = el.querySelector('ins .amount, ins');
      if (ins) return ins.textContent.replace(/\s+/g, ' ').trim();
      const amounts = [...el.querySelectorAll('.woocommerce-Price-amount, .amount')].filter((a) => !a.closest('del') && !a.closest('.screen-reader-text'));
      if (amounts.length > 1) return amounts.map((a) => a.textContent.replace(/\s+/g, ' ').trim()).join(' - ');
      return (amounts[0] || el).textContent.replace(/\s+/g, ' ').trim();
    };
    const variation = document.querySelector('.woocommerce-variation-price .price');
    if (variation && variation.offsetParent !== null && variation.textContent.trim()) return read(variation);
    const scope = document.querySelector('main') || document.body;
    const main = scope.querySelector('.wp-block-woocommerce-product-price .wc-block-components-product-price, .summary .price, .wp-block-woocommerce-product-price, .product .price');
    return read(main);
  });
}

// ---------------------------------------------------------------------------
// The cart and checkout blocks, and their data store
// ---------------------------------------------------------------------------

/**
 * Wait until the cart or checkout block of the page is ready and idle: its
 * data store (`wc/store/cart`) resolved the cart, nothing is pending (items,
 * coupons, the customer's address, the shipping rate), and the block dropped
 * its loading class and its placeholders. `check(cart)` adds a condition on the cart data, read in
 * the page (`{ items: [{ key, name, quantity }], totals, coupons, itemsCount }`).
 */
async function waitForCart(world, check, describe) {
  const deadline = budget(world) * 4;
  try {
    await world.page.waitForFunction((checkSrc) => {
      const data = window.wp && window.wp.data;
      if (!data) return false;
      let store;
      try { store = data.select('wc/store/cart'); } catch (e) { return false; }
      if (!store) return false;
      if (!store || !store.hasFinishedResolution('getCartData')) return false;
      if (store.hasPendingItemsOperations() || store.isApplyingCoupon() || store.isRemovingCoupon()
        || store.isCustomerDataUpdating() || store.isShippingRateBeingSelected()) return false;
      if (document.querySelector('.wp-block-woocommerce-cart.is-loading, .wp-block-woocommerce-checkout.is-loading')) return false;
      // The block draws placeholders ("Loading products in cart…", "Loading price…") until it has rendered the cart.
      if (document.querySelector(':is(.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout) .wc-block-components-skeleton__element:not(.wc-block-components-skeleton__element--static)')) return false;
      if (!checkSrc) return true;
      const cart = store.getCartData();
      // eslint-disable-next-line no-new-func
      return Boolean(new Function('cart', `return (${checkSrc})(cart);`)(cart));
    }, check ? check.toString() : null, { timeout: deadline, polling: 100 });
  } catch (err) {
    const state = await cartState(world).catch(() => null);
    throw friendly({
      message: `The cart did not ${describe || 'settle'} in time (${Math.round(deadline / 1000)} s). ${state ? `It holds: ${listed(state.items.map((i) => `${i.name} × ${i.quantity}`))}.` : 'The page has no cart or checkout block.'}`,
      hint: 'The cart steps read the cart and checkout blocks of the store (the "wc/store/cart" data store of the page); open the cart or the checkout first.',
    });
  }
}

/** The cart as the page's data store holds it, with plain prices. */
async function cartState(world) {
  return world.page.evaluate(() => {
    const store = window.wp.data.select('wc/store/cart');
    const cart = store.getCartData();
    const t = cart.totals || {};
    const unit = Math.pow(10, Number(t.currency_minor_unit || 0));
    const money = (v) => `${t.currency_prefix || ''}${(Number(v || 0) / unit).toFixed(Number(t.currency_minor_unit || 0))}${t.currency_suffix || ''}`;
    return {
      items: (cart.items || []).map((i) => ({ key: i.key, name: i.name, quantity: i.quantity, variation: (i.variation || []).map((v) => `${v.attribute}: ${v.value}`) })),
      coupons: (cart.coupons || []).map((c) => c.code),
      itemsCount: cart.itemsCount,
      totals: { subtotal: money(t.total_items), discount: money(t.total_discount), shipping: money(t.total_shipping), tax: money(t.total_tax), total: money(t.total_price) },
      errors: (store.getCartErrors() || []).map((e) => e.message),
    };
  });
}

/**
 * The row of the cart block (or the mini cart) for a product, by the name it
 * shows, or null: the line items are table rows, each with the product's name
 * as a link (".wc-block-components-product-name").
 */
async function cartRow(scope, name) {
  const rows = scope.locator('tr.wc-block-cart-items__row');
  const names = await rows.evaluateAll((trs) => trs.map((tr) => {
    const el = tr.querySelector('.wc-block-components-product-name');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }));
  const index = names.findIndex((n) => same(n, name));
  return index < 0 ? null : rows.nth(index);
}

// ---------------------------------------------------------------------------
// The store's messages
// ---------------------------------------------------------------------------

/**
 * The store's messages on the page, by kind: the notice banners of the blocks
 * (success, error, info, warning; also the snackbars of the cart), and the
 * classic notices (`.woocommerce-message`, `.woocommerce-error`,
 * `.woocommerce-info`).
 */
async function storeMessages(world) {
  return world.page.evaluate(() => {
    const kindOf = (el) => {
      const c = el.className || '';
      if (/is-success|woocommerce-message/.test(c)) return 'success';
      if (/is-error|woocommerce-error/.test(c)) return 'error';
      if (/is-warning/.test(c)) return 'warning';
      if (/is-info|woocommerce-info/.test(c)) return 'info';
      return 'info';
    };
    const out = [];
    for (const el of document.querySelectorAll('.wc-block-components-notice-banner, .woocommerce-message, .woocommerce-error, .woocommerce-info')) {
      if (el.closest('#adminmenu, .wp-admin #wpbody .notice')) continue;
      const box = el.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const content = el.querySelector('.wc-block-components-notice-banner__content') || el;
      const text = [...content.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : (n.matches && n.matches('a.button, a.wc-forward, .wc-forward') ? '' : n.textContent))).join(' ');
      for (const line of (el.tagName === 'UL' ? [...el.querySelectorAll('li')].map((li) => li.textContent) : [text])) {
        out.push({ kind: kindOf(el), text: line.replace(/\s+/g, ' ').trim() });
      }
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// The orders a scenario placed
// ---------------------------------------------------------------------------

/** Remember an order the scenario placed: `{ id, number, key }`. */
function rememberOrder(world, order) {
  if (!world.wooOrders) world.wooOrders = [];
  if (!world.wooOrders.some((o) => o.id === order.id)) world.wooOrders.push(order);
}

/** The order the scenario placed last, or fail. */
function lastOrder(world) {
  const orders = world.wooOrders || [];
  if (!orders.length) {
    throw friendly({
      message: 'No order was placed in this scenario, so there is no "last placed order".',
      hint: 'Place one first: When I place the order, then Then I should see the order confirmation.',
    });
  }
  return orders[orders.length - 1];
}

/**
 * The summary the order received page shows, by the name of each line:
 * `{ number, date, total, email, payment }` (the block template's list, or
 * the classic overview).
 */
async function orderSummary(world) {
  return world.page.evaluate(() => {
    const out = {};
    const keyOf = (text) => {
      const t = text.toLowerCase();
      if (/order( number)?\s*#?:?$/.test(t) || /^order/.test(t)) return 'number';
      if (/date/.test(t)) return 'date';
      if (/total/.test(t)) return 'total';
      if (/e-?mail/.test(t)) return 'email';
      if (/payment/.test(t)) return 'payment';
      return null;
    };
    for (const li of document.querySelectorAll('.wc-block-order-confirmation-summary-list li, ul.woocommerce-order-overview li, ul.order_details li')) {
      const keyEl = li.querySelector('.wc-block-order-confirmation-summary-list-item__key');
      const valueEl = li.querySelector('.wc-block-order-confirmation-summary-list-item__value, strong');
      if (!valueEl) continue;
      const value = valueEl.textContent.replace(/\s+/g, ' ').trim();
      const keyText = (keyEl ? keyEl.textContent : li.textContent.replace(valueEl.textContent, '')).replace(/\s+/g, ' ').trim();
      const key = keyOf(keyText);
      if (key && !(key in out)) out[key] = value;
    }
    return out;
  });
}

/** The order the order received page shows: its id and key from the address, its number from the page. */
async function orderOnConfirmation(world) {
  const url = new URL(world.page.url());
  const m = url.pathname.match(/order-received\/(\d+)/);
  const id = m ? Number(m[1]) : (Number(url.searchParams.get('order-received')) || null);
  const summary = await orderSummary(world);
  return { id, number: summary.number || (id ? String(id) : null), key: url.searchParams.get('key'), email: summary.email || null };
}

// ---------------------------------------------------------------------------
// The users registry: the addresses
// ---------------------------------------------------------------------------

/** Whether a name is a handle of the users registry. */
function isHandle(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return Object.prototype.hasOwnProperty.call(users, who);
}

/** The e-mail address a handle stands for, or the address itself. */
function addressOf(world, who) {
  if (/@/.test(who) || !isHandle(world, who)) return who;
  const entry = world.parameters.users[who];
  const email = entry && typeof entry === 'object' ? entry.email : null;
  if (!email) {
    throw friendly({
      message: `The user "${who}" has no email address in the users registry.`,
      hint: `Set worldParameters.users.${who}.email in cucumber.js.`,
    });
  }
  return email;
}

// ---------------------------------------------------------------------------
// The mailbox of the test shop (Mailpit, port 8026 of a DDEV project)
// ---------------------------------------------------------------------------

/** The address of the mailbox: `worldParameters.mailUrl`, else the shop's address on port 8026. */
function mailUrl(world) {
  const own = world.parameters && world.parameters.mailUrl;
  return String(own || `${siteRoot(world.launchUrl)}:8026`).replace(/\/+$/, '');
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them. */
async function mailList(world, address) {
  const response = await world.context.request.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  if (!response.ok()) throw new Error(`the mailbox answered HTTP ${response.status()}`);
  return (await response.json()).messages || [];
}

/**
 * The newest e-mail to an address that arrived since the scenario began and
 * whose subject holds a text, once it is there. The subject of a shop's mail
 * carries the shop's name and the order number, so a part of it is enough.
 */
async function mailTo(world, address, subject, timeout) {
  const since = (world.wooScenarioStartedAt || 0) - 2000;
  const deadline = Date.now() + (timeout || budget(world) * 3);
  let problem = '';
  let subjects = [];
  for (;;) {
    try {
      const messages = (await mailList(world, address)).filter((m) => Date.parse(m.Created) >= since);
      subjects = messages.map((m) => m.Subject);
      const found = messages.find((m) => !subject || clean(m.Subject).toLowerCase().includes(clean(subject).toLowerCase()));
      if (found) {
        const full = await (await world.context.request.get(`${mailUrl(world)}/api/v1/message/${found.ID}`, { ignoreHTTPSErrors: true })).json();
        return { id: found.ID, subject: full.Subject || '', text: full.Text || '', html: full.HTML || '' };
      }
      problem = messages.length ? `${messages.length} arrived for that address since the scenario began, none with "${subject}" in its subject` : 'none arrived for that address since the scenario began';
    } catch (err) {
      problem = clean(err && err.message).split(' Call log')[0];
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(300);
  }
  throw friendly({
    message: `No e-mail${subject ? ` with "${subject}" in its subject` : ''} to ${address} is in the mailbox at ${mailUrl(world)} (${problem}).${subjects.length ? ` Subjects: ${listed(subjects)}.` : ''}`,
    hint: 'The shop sends its mail through the mail catcher of its container (Mailpit on a DDEV project); check worldParameters.mailUrl in cucumber.js, and the address of the account in the users registry.',
  });
}

/** The text of an e-mail as a person reads it: its text version and its HTML without the markup. */
function mailText(mail) {
  const html = String(mail.html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&');
  return clean(`${mail.text || ''} ${html}`);
}

/**
 * Wait until the shop has sent the mail of an order the scenario placed: the
 * mailbox holds an e-mail, sent since the scenario began, that names the order
 * ("#<number>" in its subject or its first lines), and the mail of the scenario
 * holds still between two readings (the shop sends an order's mail, and an
 * account's when the checkout makes one, in the request that places it). It
 * returns whether it saw that; it never fails, the step that calls it reads the
 * mailbox itself.
 */
async function mailOfOrderSent(world, order) {
  const since = (world.wooScenarioStartedAt || 0) - 2000;
  const names = new RegExp(`#\\s*${String(order.number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const deadline = Date.now() + budget(world) * 3;
  let seen = false;
  let count = -1;
  for (;;) {
    try {
      const response = await world.context.request.get(`${mailUrl(world)}/api/v1/messages?limit=50`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
      if (response.ok()) {
        const messages = ((await response.json()).messages || []).filter((m) => Date.parse(m.Created) >= since);
        if (seen && messages.length === count) return true;
        seen = seen || messages.some((m) => names.test(`${m.Subject || ''} ${m.Snippet || ''}`));
        count = messages.length;
      }
    } catch (err) {
      // The mailbox is read again; the step that called reports a mailbox it cannot read.
    }
    if (Date.now() > deadline) return false;
    await world.page.waitForTimeout(300);
  }
}

module.exports = {
  budget,
  settle,
  siteRoot,
  joinUrl,
  navigate,
  resolveUser,
  supplied,
  clean,
  listed,
  same,
  priceValue,
  samePrice,
  eventually,
  waitForRouter,
  STORE_PAGES,
  storePagePath,
  listedProducts,
  productInList,
  currentListPage,
  addToCartForm,
  productOptions,
  productPagePrice,
  waitForCart,
  cartState,
  cartRow,
  storeMessages,
  rememberOrder,
  lastOrder,
  orderSummary,
  orderOnConfirmation,
  isHandle,
  addressOf,
  mailUrl,
  mailList,
  mailOfOrderSent,
  mailTo,
  mailText,
};
