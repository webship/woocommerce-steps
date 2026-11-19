'use strict';

// The store front: its pages, the product list (the products it shows, their
// count, sorting, the pages of the list), a category, the store's search, the
// breadcrumbs, the store's messages, and whether the store is open to
// visitors.
//
// On a block theme the product list is a product collection that the store's
// router loads in place: sorting it or going to another page of it changes the
// address without loading a new document. The steps wait for the router's own
// end of a navigation (the address, the loading bar), and then for the page
// to be quiet. A classic theme reloads the page, which the same waits cover.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  clean,
  listed,
  same,
  priceValue,
  eventually,
  waitForRouter,
  storePagePath,
  listedProducts,
  productInList,
  currentListPage,
  storeMessages,
} = require('./woocommerce-helpers');

// ---------------------------------------------------------------------------
// The store's pages
// ---------------------------------------------------------------------------

/**
 * Open a page of the store: the shop (the product list), the cart or the
 * checkout. The addresses are the ones the store makes on its install
 * (/shop/, /cart/, /checkout/); `worldParameters.storePages` names others.
 *
 * Example #1: Given I am on the shop
 * Example #2: When I go to the cart
 * Example #3: Given we are on the checkout
 * Example #4: And I go to the shop
 * Example #5: When we go to the checkout
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the (shop|cart|checkout)$/, async function (page) {
  await navigate(this, storePagePath(this, page));
});

// ---------------------------------------------------------------------------
// The product list
// ---------------------------------------------------------------------------

/**
 * Assert how many products the product list of the page shows (on this page
 * of the list).
 *
 * Example #1: Then the product list should have 16 products
 * Example #2: And the product list should have 1 product
 * Example #3: Then the product list should have 5 products
 * Example #4: Then the product list should have 0 products
 * Example #5: And the product list should have 3 products
 */
Then(/^the product list should have (\d+) products?$/, async function (count) {
  await eventually(this, () => listedProducts(this), (all) => all.length === Number(count), (all) => ({
    message: `Expected the product list to show ${count} product(s), but it shows ${(all || []).length}: ${listed((all || []).map((p) => p.name))}.`,
    hint: 'The list counts the products of the page\'s main product list (related products and other lists aside), on the page of the list the browser shows.',
  }));
});

/**
 * Assert the result count the store prints above the product list ("Showing
 * 1–16 of 17 results"). A hyphen and the dash the store prints are the same.
 *
 * Example #1: Then the result count should be "Showing 1–16 of 17 results"
 * Example #2: And the result count should be "Showing all 3 results"
 * Example #3: Then the result count should be "Showing 17–17 of 17 results"
 * Example #4: Then the result count should be "Showing the single result"
 * Example #5: And the result count should be "Showing 1-16 of 17 results"
 */
Then(/^the result count should be "([^"]*)"$/, async function (expected) {
  const read = () => this.page.evaluate(() => {
    const el = document.querySelector('.woocommerce-result-count, .wc-block-product-results-count');
    if (!el) return null;
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.screen-reader-text').forEach((s) => s.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  });
  await eventually(this, read, (text) => typeof text === 'string' && same(text, expected), (text) => ({
    message: text === null || text === undefined
      ? `Expected the result count "${expected}", but the page has no result count (${this.page.url()}).`
      : `Expected the result count "${expected}", but it reads "${text}".`,
    hint: 'The result count is the line above the product list of the shop, a category or the search results.',
  }));
});

/**
 * Assert a product is (or is not) in the product list of the page, by the
 * name its title shows.
 *
 * Example #1: Then I should see the product "Beanie" in the product list
 * Example #2: And we should see the product "Hoodie" in the product list
 * Example #3: Then I should not see the product "Hoodie with Pocket" in the product list
 * Example #4: And I should see the product "Cap" in the product list
 * Example #5: But we should not see the product "Album" in the product list
 */
Then(/^(I |we )*should( not)* see the product "([^"]*)" in the product list$/, async function (pronounCase, notCase, name) {
  if (!notCase) {
    await productInList(this, name);
    return;
  }
  await settle(this);
  const all = await listedProducts(this);
  if (all.some((p) => same(p.name, name))) {
    throw friendly({
      message: `Expected no product "${name}" in the product list of ${this.page.url()}, but it is there.`,
      hint: 'A product hidden from the catalog (its catalog visibility) is not listed; one in another category is not either.',
    });
  }
});

/**
 * Open a product from the product list, by the name its title link shows, as
 * a person clicks it; the step waits for the product's own page.
 *
 * Example #1: When I open the product "Hoodie" from the product list
 * Example #2: When we open the product "Beanie" from the product list
 * Example #3: And I open the product "V-Neck T-Shirt" from the product list
 * Example #4: When I open the product "Album" from the product list
 * Example #5: And we open the product "Cap" from the product list
 */
When(/^(I |we )*open the product "([^"]*)" from the product list$/, async function (pronounCase, name) {
  const product = await productInList(this, name);
  if (!product.href) {
    throw friendly({ message: `The product "${name}" of the list has no link to its page.`, hint: 'The title of a product in the list links to its page.' });
  }
  await navigate(this, product.href);
  await eventually(this, () => this.page.locator('main h1, h1').first().textContent(), (h1) => same(h1, name), (h1) => ({
    message: `Opened "${name}" from the product list, but the page's title is "${clean(h1)}" (${this.page.url()}).`,
    hint: 'The link of the product\'s title leads to the product\'s page.',
  }));
});

/**
 * Sort the product list by an option of its sorting menu, by the label the
 * menu shows ("Sort by price: low to high", "Sort by latest", "Default
 * sorting"); the step waits until the list is loaded in that order.
 *
 * Example #1: When I sort the product list by "Sort by price: low to high"
 * Example #2: When we sort the product list by "Sort by price: high to low"
 * Example #3: And I sort the product list by "Sort by latest"
 * Example #4: When I sort the product list by "Default sorting"
 * Example #5: And we sort the product list by "Sort by popularity"
 */
When(/^(I |we )*sort the product list by "([^"]*)"$/, async function (pronounCase, label) {
  const select = this.page.locator('form.woocommerce-ordering select.orderby, select.orderby').first();
  if (!(await select.count())) {
    throw friendly({ message: `The page has no sorting menu for its product list (${this.page.url()}).`, hint: 'The shop, a category and the search results show one ("Shop order").' });
  }
  const options = await select.evaluate((s) => [...s.options].map((o) => ({ value: o.value, label: o.textContent.replace(/\s+/g, ' ').trim() })));
  const option = options.find((o) => same(o.label, label));
  if (!option) {
    throw friendly({ message: `The sorting menu has no "${label}". It offers: ${listed(options.map((o) => o.label))}.`, hint: 'Name the option by the label the menu shows.' });
  }
  await select.selectOption(option.value);
  await waitForRouter(this, (url) => (url.searchParams.get('orderby') || 'menu_order') === option.value, `sort by "${label}"`);
});

/**
 * Assert the order of the product list: by the price each product shows (the
 * sale price of a product on sale), or by name. A range of prices counts as
 * the store sorts it: by its lowest price going up, by its highest going
 * down; a product that shows no price (a group) is left out.
 *
 * Example #1: Then the product list should be ordered by price ascending
 * Example #2: Then the product list should be ordered by price descending
 * Example #3: And the product list should be ordered by name ascending
 * Example #4: Then the product list should be ordered by name descending
 * Example #5: And the product list should be ordered by price ascending
 */
Then(/^the product list should be ordered by (price|name) (ascending|descending)$/, async function (key, direction) {
  const value = (p) => {
    if (key === 'name') return p.name.toLowerCase();
    const all = (p.prices || []).map(priceValue).filter((v) => !Number.isNaN(v));
    if (!all.length) return NaN;
    return direction === 'ascending' ? Math.min(...all) : Math.max(...all);
  };
  const inOrder = (all) => {
    const values = all.map(value).filter((v) => key === 'name' || !Number.isNaN(v));
    if (values.length < 2) return false;
    for (let i = 1; i < values.length; i += 1) {
      const a = values[i - 1];
      const b = values[i];
      if (direction === 'ascending' ? a > b : a < b) return false;
    }
    return true;
  };
  await eventually(this, () => listedProducts(this), inOrder, (all) => ({
    message: `Expected the product list ordered by ${key} ${direction}, but it reads: ${(all || []).map((p) => `${p.name} (${(p.prices || []).join(' – ') || 'no price'})`).join(', ') || '(no product)'}.`,
    hint: 'The price of a product is the price it shows (the sale price when it is on sale, the lowest of a range). Sorting by price reads the store\'s product lookup table: a shop whose products were imported needs it rebuilt (Status > Tools > Product lookup tables).',
  }));
});

/**
 * Go to another page of the product list with its pagination, as a person
 * clicks it.
 *
 * Example #1: When I go to the next page of the product list
 * Example #2: When we go to the previous page of the product list
 * Example #3: And I go to page 2 of the product list
 * Example #4: When I go to page 1 of the product list
 * Example #5: And we go to the next page of the product list
 */
When(/^(I |we )*go to (?:the (next|previous) page|page (\d+)) of the product list$/, async function (pronounCase, relative, number) {
  const before = await currentListPage(this);
  const target = relative ? before + (relative === 'next' ? 1 : -1) : Number(number);
  const nav = this.page.locator('main nav[aria-label="Pagination"], main .wp-block-query-pagination, main nav.woocommerce-pagination').first();
  if (!(await nav.count())) {
    throw friendly({ message: `The product list has one page only: there is no pagination on ${this.page.url()}.`, hint: 'The shop shows 16 products per page; a list with fewer has no other page.' });
  }
  const link = relative
    ? nav.locator(relative === 'next' ? 'a.wp-block-query-pagination-next, a.next, a[aria-label="Next Page"]' : 'a.wp-block-query-pagination-previous, a.prev, a[aria-label="Previous Page"]').first()
    : nav.locator('a').filter({ hasText: new RegExp(`^\\s*${target}\\s*$`) }).first();
  if (!(await link.count())) {
    const pages = await nav.locator('a, [aria-current="page"], .current').allTextContents();
    throw friendly({ message: `The product list has no ${relative ? `${relative} page` : `page ${target}`} to go to from page ${before}. Its pagination: ${listed(pages)}.`, hint: 'The pagination links of the list are the pages there are.' });
  }
  await link.click();
  await waitForRouter(this, (url) => {
    const m = url.pathname.match(/\/page\/(\d+)\/?$/) || url.search.match(/[?&](?:paged|product-page|query-\d+-page)=(\d+)/);
    return (m ? Number(m[1]) : 1) === target;
  }, `go to page ${target}`);
});

/**
 * Assert the page of the product list the browser shows.
 *
 * Example #1: Then the product list should be on page 2
 * Example #2: And the product list should be on page 1
 * Example #3: Then the product list should be on page 1
 * Example #4: Then the product list should be on page 2
 * Example #5: And the product list should be on page 3
 */
Then(/^the product list should be on page (\d+)$/, async function (number) {
  await eventually(this, () => currentListPage(this), (page) => page === Number(number), (page) => ({
    message: `Expected the product list on page ${number}, but it is on page ${page}.`,
    hint: 'The current page is the one the pagination marks, else the page of the address.',
  }));
});

/**
 * Add a product to the cart with the "Add to cart" button it has in the
 * product list (a simple product), without leaving the list; the step waits
 * until the store counted it ("1 in cart").
 *
 * Example #1: When I add "Beanie" to the cart from the product list
 * Example #2: When we add "Cap" to the cart from the product list
 * Example #3: And I add "Album" to the cart from the product list
 * Example #4: When I add "Polo" to the cart from the product list
 * Example #5: And we add "Belt" to the cart from the product list
 */
When(/^(I |we )*add "([^"]*)" to the cart from the product list$/, async function (pronounCase, name) {
  await productInList(this, name);
  const button = this.page.locator('main').getByRole('button', { name: new RegExp(`^Add to cart: .${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.$`) }).first();
  if (!(await button.count())) {
    // The buttons of this product's own item: "Hoodie" is also a part of "Hoodie with Logo".
    const links = await this.page.evaluate((wanted) => {
      const norm = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const item = [...document.querySelectorAll('main li')].find((li) => {
        const title = li.querySelector('h2, h3, .wp-block-post-title, .woocommerce-loop-product__title');
        return title && norm(title.textContent) === norm(wanted);
      });
      return item ? [...item.querySelectorAll('a.button, a.wp-block-button__link, button.wp-block-button__link, .add_to_cart_button')].map((el) => norm(el.textContent)).filter(Boolean) : [];
    }, name);
    throw friendly({
      message: `The product "${name}" has no "Add to cart" button in the product list${links.length ? `; it offers: ${listed(links)}` : ''}.`,
      hint: 'A variable product has "Select options" and a grouped one "View products" instead: open its page and add it from there.',
    });
  }
  const countOf = async () => {
    const text = clean(await button.textContent());
    const m = text.match(/(\d+) in cart/);
    return m ? Number(m[1]) : 0;
  };
  const before = await countOf();
  await button.click();
  await eventually(this, countOf, (n) => n > before, (n) => ({
    message: `Clicked "Add to cart" for "${name}", but the store did not count it: the button still reads "${n ? `${n} in cart` : 'Add to cart'}".`,
    hint: 'The button adds the product through the store\'s cart API and then reads "1 in cart"; a store message may say why it refused.',
  }), budget(this) * 4);
  await settle(this);
});

// ---------------------------------------------------------------------------
// Categories, search and the breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Open a product category, by its name, as a person does: the category link
 * the page shows (the breadcrumbs, a product's categories, a list of
 * categories); without one, the category's address from the store's API.
 *
 * Example #1: When I open the category "Hoodies"
 * Example #2: When we open the category "Accessories"
 * Example #3: And I open the category "Tshirts"
 * Example #4: When I open the category "Clothing"
 * Example #5: And we open the category "Music"
 */
When(/^(I |we )*open the category "([^"]*)"$/, async function (pronounCase, name) {
  const link = this.page.locator('main a[href*="/product-category/"], main a[href*="product_cat="], a[rel~="tag"][href*="product-category"]')
    .filter({ hasText: new RegExp(`^\\s*${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  let href = (await link.count()) ? await link.getAttribute('href') : null;
  if (!href) {
    const response = await this.context.request.get(`${this.launchUrl.replace(/\/+$/, '')}/wp-json/wc/store/v1/products/categories?per_page=100`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
    const categories = response.ok() ? await response.json() : [];
    const category = (categories || []).find((c) => same(c.name, name));
    if (!category) {
      throw friendly({ message: `The store has no product category "${name}". Its categories: ${listed((categories || []).map((c) => c.name))}.`, hint: 'Name the category as the store shows it.' });
    }
    href = category.permalink;
  }
  await navigate(this, href);
});

/**
 * Assert that every product of the product list is in a category (by the
 * category's name, as the store shows it).
 *
 * Example #1: Then every product of the product list should be in the category "Hoodies"
 * Example #2: And every product of the product list should be in the category "Accessories"
 * Example #3: Then every product of the product list should be in the category "Tshirts"
 * Example #4: Then every product of the product list should be in the category "Music"
 * Example #5: And every product of the product list should be in the category "Clothing"
 */
Then(/^every product of the product list should be in the category "([^"]*)"$/, async function (name) {
  const response = await this.context.request.get(`${this.launchUrl.replace(/\/+$/, '')}/wp-json/wc/store/v1/products/categories?per_page=100`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  const categories = response.ok() ? await response.json() : [];
  const category = (categories || []).find((c) => same(c.name, name));
  if (!category) {
    throw friendly({ message: `The store has no product category "${name}". Its categories: ${listed((categories || []).map((c) => c.name))}.`, hint: 'Name the category as the store shows it.' });
  }
  const all = await eventually(this, () => listedProducts(this), (list) => list.length > 0, () => ({
    message: `The page lists no product (${this.page.url()}).`,
    hint: 'Open the shop, a category or the search results first.',
  }));
  const outside = all.filter((p) => !p.categories.includes(category.slug));
  if (outside.length) {
    throw friendly({
      message: `Expected every product of the list in the category "${name}", but these are not: ${listed(outside.map((p) => p.name))}.`,
      hint: `A product's categories are the "product_cat-<slug>" classes of its item in the list (here "${category.slug}").`,
    });
  }
});

/**
 * Search the store's products for a text, the way the store's product search
 * sends it (the search of the products only, not of the posts and pages), so
 * it works whether or not the theme shows a search box; the results are the
 * product list of the page. A search with one match takes the visitor to that
 * product's page, as the store does.
 *
 * Example #1: When I search the store for "hoodie"
 * Example #2: When we search the store for "beanie"
 * Example #3: And I search the store for "no such product of the suite"
 * Example #4: When I search the store for "logo"
 * Example #5: And we search the store for "pocket"
 */
When(/^(I |we )*search the store for "([^"]*)"$/, async function (pronounCase, text) {
  await navigate(this, `/?s=${encodeURIComponent(text)}&post_type=product`);
});

/**
 * Assert the breadcrumbs of the page: their parts, separated by " / " (or
 * " > "), as the page shows them.
 *
 * Example #1: Then the breadcrumbs should be "Home / Shop"
 * Example #2: And the breadcrumbs should be "Home / Hoodies / Hoodie"
 * Example #3: Then the breadcrumbs should be "Home / Hoodies"
 * Example #4: Then the breadcrumbs should be "Home > Accessories > Beanie"
 * Example #5: And the breadcrumbs should be "Home / Accessories"
 */
Then(/^the breadcrumbs should be "([^"]*)"$/, async function (expected) {
  const wanted = String(expected).split(/\s*[/>›»]\s*/).map(clean).filter(Boolean);
  const read = () => this.page.evaluate(() => {
    const nav = document.querySelector('nav.woocommerce-breadcrumb, .wc-block-breadcrumbs, nav[aria-label="Breadcrumb"], nav[aria-label="Breadcrumbs"]');
    if (!nav) return null;
    // The links and the last part (a text of its own) with the separators between them.
    return nav.textContent.replace(/\s+/g, ' ').trim().split(/\s*[/>›»]\s*/).filter(Boolean);
  });
  await eventually(this, read, (parts) => Array.isArray(parts) && parts.join('|').toLowerCase() === wanted.join('|').toLowerCase(), (parts) => ({
    message: parts ? `Expected the breadcrumbs "${wanted.join(' / ')}", but they read "${parts.join(' / ')}".` : `Expected the breadcrumbs "${wanted.join(' / ')}", but the page has none (${this.page.url()}).`,
    hint: 'The breadcrumbs are the store\'s ("Home / Category / Product").',
  }));
});

// ---------------------------------------------------------------------------
// The store's messages
// ---------------------------------------------------------------------------

/**
 * Assert a message of the store, by its kind and its text: the notice of an
 * added product, a refused coupon, a saved address, a store error. The text
 * is matched as a part of the message, and the link a message carries ("View
 * cart") is left out.
 *
 * Example #1: Then I should see the success message "“Hoodie” has been added to your cart."
 * Example #2: And I should see the error message "Please select some product options"
 * Example #3: Then we should see the info message "has been applied to your cart."
 * Example #4: Then I should not see the error message "cannot be applied"
 * Example #5: And I should see the success message "Address changed successfully."
 */
Then(/^(I |we )*should( not)* see the (success|error|warning|info) message "([^"]*)"$/, async function (pronounCase, notCase, kind, text) {
  const has = (all) => (all || []).some((m) => m.kind === kind && clean(m.text).toLowerCase().includes(clean(text).toLowerCase()));
  if (notCase) {
    await settle(this);
    const all = await storeMessages(this);
    if (has(all)) {
      throw friendly({ message: `Expected no ${kind} message "${text}", but the page shows it.`, hint: 'The store\'s messages are its notice banners and notices.' });
    }
    return;
  }
  await eventually(this, () => storeMessages(this), has, (all) => ({
    message: `Expected the ${kind} message "${text}". The page shows: ${listed((all || []).map((m) => `${m.kind}: ${m.text}`))}.`,
    hint: 'The store\'s messages are its notice banners (and the snackbars of the cart); a part of the text is enough.',
  }));
});

// ---------------------------------------------------------------------------
// The store open to visitors
// ---------------------------------------------------------------------------

/**
 * Assert whether the page is the store's "coming soon" page, which a new
 * store shows its visitors until it is launched (the "Site visibility"
 * setting of the store).
 *
 * Example #1: Then I should not see the coming soon page
 * Example #2: And we should not see the coming soon page
 * Example #3: Then I should see the coming soon page
 * Example #4: Then we should see the coming soon page
 * Example #5: But I should not see the coming soon page
 */
Then(/^(I |we )*should( not)* see the coming soon page$/, async function (pronounCase, notCase) {
  await settle(this);
  // The page is the store's "coming soon" block (".wp-block-woocommerce-coming-soon", for the store pages
  // only or for the entire site) instead of the store.
  const comingSoon = await this.page.evaluate(() => Boolean(document.querySelector('.wp-block-woocommerce-coming-soon')));
  if (comingSoon !== !notCase) {
    throw friendly({
      message: notCase
        ? `Expected the store open to visitors, but ${this.page.url()} is its "coming soon" page.`
        : `Expected the store's "coming soon" page, but ${this.page.url()} is the store itself.`,
      hint: 'A new store shows visitors a "coming soon" page until it is launched: the store\'s settings, "Site visibility". Its own accounts see the store either way.',
    });
  }
});
