'use strict';

// The product page: the options of a variable product (and the variation
// they choose), the quantity, adding the product to the cart (and the
// store's refusal when an option is missing), the price the page shows, the
// sale badge, and the tabs under the product.
//
// The options are the add-to-cart form's selects, found by the label a person
// reads ("Color", "Size", "Logo"; letter case aside). Choosing them makes the
// store's own script look up the variation: the step waits for the variation
// it found (its id in the form, its price on the page), or for the store's
// "no variation" answer. Adding the product posts the form: the step waits for
// the page that comes back and its message, and reads a refusal (an alert, an
// error message) as the store's answer.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  clean,
  listed,
  same,
  samePrice,
  eventually,
  addToCartForm,
  productOptions,
  productPagePrice,
  storeMessages,
} = require('./woocommerce-helpers');

/** The product page's add-to-cart form, or fail plainly. */
async function requireForm(world) {
  const form = addToCartForm(world);
  if (!(await form.count())) {
    throw friendly({
      message: `The page has no add-to-cart form (${world.page.url()}).`,
      hint: 'Open a product\'s page first: When I open the product "Beanie" from the product list. An external product links to another site, and a grouped one adds each of its products.',
    });
  }
  return form;
}

/** The option of the form a label names, or fail with the options there are. */
async function optionByLabel(world, label) {
  await requireForm(world);
  const options = await productOptions(world);
  const option = options.find((o) => same(o.label, label) || same(o.name.replace(/^attribute_(pa_)?/, ''), label));
  if (!option) {
    throw friendly({
      message: `The product has no option "${label}". ${options.length ? `Its options: ${listed(options.map((o) => o.label))}.` : 'It has no options: it is not a variable product.'}`,
      hint: 'An option is named by the label of its menu on the product page.',
    });
  }
  return option;
}

/**
 * Click the add-to-cart button of the product page and tell what the store
 * answered: `{ added, message }`. An alert of the store (an option not
 * chosen) and an error message are refusals; the page that comes back with
 * the store's success message is an add.
 */
async function pressAddToCart(world) {
  const form = await requireForm(world);
  const button = form.locator('button[name="add-to-cart"], button.single_add_to_cart_button, button[type="submit"]').first();
  let alertText = null;
  let onDialog;
  const dialogSeen = new Promise((resolve) => {
    onDialog = async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss().catch(() => {});
      resolve('dialog');
    };
    world.page.once('dialog', onDialog);
  });
  try {
    const navigation = world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(world) * 4 })
      .then(() => 'navigated').catch(() => 'stayed');
    await button.click();
    await Promise.race([dialogSeen, navigation]);
  } finally {
    world.page.off('dialog', onDialog);
  }
  if (alertText) return { added: false, message: alertText };
  await settle(world);
  const messages = await storeMessages(world);
  const error = messages.find((m) => m.kind === 'error');
  if (error) return { added: false, message: error.text };
  const success = messages.find((m) => m.kind === 'success' && /cart/i.test(m.text));
  return { added: Boolean(success), message: success ? success.text : `no message came back (${world.page.url()})` };
}

/**
 * Choose a value of an option of a variable product, by the labels a person
 * reads; once every option has a value the step waits for the variation the
 * store finds for them (or its answer that none matches).
 *
 * Example #1: When I choose "Blue" for the product option "Color"
 * Example #2: And I choose "Yes" for the product option "Logo"
 * Example #3: When we choose "Large" for the product option "Size"
 * Example #4: And I choose "Red" for the product option "color"
 * Example #5: When we choose "No" for the product option "Logo"
 */
When(/^(I |we )*choose "([^"]*)" for the product option "([^"]*)"$/, async function (pronounCase, value, label) {
  const option = await optionByLabel(this, label);
  if (!option.options.some((o) => same(o, value))) {
    throw friendly({ message: `The option "${option.label}" has no value "${value}". It offers: ${listed(option.options)}.`, hint: 'Name the value as the menu shows it.' });
  }
  const select = this.page.locator(`form select[name="${option.name}"]`).first();
  const exact = option.options.find((o) => same(o, value));
  await select.selectOption({ label: exact });
  await settle(this);
  const all = await productOptions(this);
  if (all.every((o) => o.value)) {
    await eventually(this, () => this.page.evaluate(() => {
      const form = document.querySelector('form.variations_form');
      if (!form) return 'none';
      const id = form.querySelector('input[name="variation_id"]');
      if (id && id.value && id.value !== '0') return 'found';
      const none = form.querySelector('.wc-no-matching-variations, .woocommerce-variation-availability');
      return none && none.offsetParent !== null && /no products matched|unavailable/i.test(none.textContent) ? 'unavailable' : 'pending';
    }), (state) => state !== 'pending', () => ({
      message: `Every option of the product has a value, but the store found no variation for them in time (${all.map((o) => `${o.label}: ${o.selected}`).join(', ')}).`,
      hint: 'The store\'s variation script fills the form\'s variation id when the options match one of the product\'s variations.',
    }));
  }
});

/**
 * Assert the value an option of a variable product has, by the label the menu
 * shows.
 *
 * Example #1: Then the product option "Color" should be "Blue"
 * Example #2: And the product option "Logo" should be "Yes"
 * Example #3: Then the product option "Size" should be "Large"
 * Example #4: Then the product option "color" should be "Red"
 * Example #5: And the product option "Logo" should be "Choose an option"
 */
Then(/^the product option "([^"]*)" should be "([^"]*)"$/, async function (label, value) {
  await eventually(this, () => optionByLabel(this, label), (o) => same(o.selected, value), (o) => ({
    message: `Expected the option "${label}" to be "${value}", but it is "${o ? o.selected : 'not there'}".`,
    hint: 'The value of an option is the one its menu shows.',
  }));
});

/**
 * Set how many of the product to add to the cart, in the quantity field of
 * the product page.
 *
 * Example #1: When I set the product quantity to 2
 * Example #2: When we set the product quantity to 3
 * Example #3: And I set the product quantity to 1
 * Example #4: When I set the product quantity to 5
 * Example #5: And we set the product quantity to 2
 */
When(/^(I |we )*set the product quantity to (\d+)$/, async function (pronounCase, quantity) {
  const form = await requireForm(this);
  const field = form.locator('input.qty, input[name="quantity"]').first();
  if (!(await field.count())) {
    throw friendly({ message: 'The product page has no quantity field.', hint: 'A product sold one at a time ("sold individually") has none.' });
  }
  await field.fill(String(quantity));
  await field.dispatchEvent('change');
});

/**
 * Add the product of the page to the cart, with its add-to-cart button; the
 * step waits for the page that comes back with the store's message, and fails
 * with the store's answer when it refuses (an option not chosen).
 *
 * Example #1: When I add the product to the cart
 * Example #2: When we add the product to the cart
 * Example #3: And I add the product to the cart
 * Example #4: Then I add the product to the cart
 * Example #5: And we add the product to the cart
 */
When(/^(I |we )*add the product to the cart$/, async function (pronounCase) {
  const outcome = await pressAddToCart(this);
  if (!outcome.added) {
    throw friendly({
      message: `The store did not add the product to the cart: ${outcome.message}`,
      hint: 'Choose every option of a variable product first (When I choose "Blue" for the product option "Color").',
    });
  }
});

/**
 * Assert that the store refuses to add the product of the page to the cart,
 * and says why (its alert, or its error message), a part of the text being
 * enough. The step presses the add-to-cart button itself.
 *
 * Example #1: Then adding the product to the cart should be refused with "Please select some product options"
 * Example #2: Then adding the product to the cart should be refused with "select some product options"
 * Example #3: And adding the product to the cart should be refused with "Please select some product options before adding this product to your cart."
 * Example #4: Then adding the product to the cart should be refused with "product options"
 * Example #5: And adding the product to the cart should be refused with "Please select"
 */
Then(/^adding the product to the cart should be refused with "([^"]*)"$/, async function (text) {
  const outcome = await pressAddToCart(this);
  if (outcome.added) {
    throw friendly({ message: `Expected the store to refuse the product with "${text}", but it added it: "${outcome.message}".`, hint: 'The store refuses a variable product until every option has a value.' });
  }
  if (!clean(outcome.message).toLowerCase().includes(clean(text).toLowerCase())) {
    throw friendly({ message: `The store refused the product, but with "${outcome.message}", not "${text}".`, hint: 'A part of the store\'s message is enough.' });
  }
});

/**
 * Assert the price the product page shows: the chosen variation's price once
 * the options choose one, else the product's (its sale price when it is on
 * sale; a range as "$15.00 – $20.00").
 *
 * Example #1: Then the product price should be "$45.00"
 * Example #2: And the product price should be "$18.00"
 * Example #3: Then the product price should be "$42.00 – $45.00"
 * Example #4: Then the product price should be "$15.00 - $20.00"
 * Example #5: And the product price should be "$20.00"
 */
Then(/^the product price should be "([^"]*)"$/, async function (price) {
  await eventually(this, () => productPagePrice(this), (shown) => samePrice(shown, price), (shown) => ({
    message: `Expected the product price "${price}", but the page shows "${clean(shown) || 'no price'}" (${this.page.url()}).`,
    hint: 'A variable product shows the price of the chosen variation once every option has a value, and its range before.',
  }));
});

/**
 * Assert whether the product of the page is on sale: the store's sale badge
 * ("Sale!") next to the product.
 *
 * Example #1: Then the product should be on sale
 * Example #2: And the product should be on sale
 * Example #3: Then the product should not be on sale
 * Example #4: But the product should not be on sale
 * Example #5: Then the product should be on sale
 */
Then(/^the product should( not)* be on sale$/, async function (notCase) {
  await settle(this);
  const onSale = await this.page.evaluate(() => [...document.querySelectorAll('main .onsale, main .wc-block-components-product-sale-badge, main .wp-block-woocommerce-product-sale-badge')]
    .some((b) => !b.closest('.wc-block-mini-cart, .wc-block-mini-cart__drawer, .related, .wp-block-woocommerce-related-products, li.wc-block-product') && b.textContent.trim()));
  if (onSale === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the product not on sale, but the page shows its sale badge (${this.page.url()}).` : `Expected the product on sale, but the page shows no sale badge (${this.page.url()}).`,
      hint: 'The store shows "Sale!" next to a product whose sale price is set.',
    });
  }
});

/**
 * Open a tab under the product, by its name ("Description", "Additional
 * information", "Reviews (0)"; the count of the reviews may be left out).
 *
 * Example #1: When I open the "Additional information" product tab
 * Example #2: When we open the "Description" product tab
 * Example #3: And I open the "Reviews" product tab
 * Example #4: When I open the "Reviews (0)" product tab
 * Example #5: And we open the "Additional information" product tab
 */
When(/^(I |we )*open the "([^"]*)" product tab$/, async function (pronounCase, name) {
  const tabs = this.page.locator('main .wc-tabs a, main [role="tablist"] [role="tab"]');
  const names = (await tabs.allTextContents()).map(clean);
  const index = names.findIndex((n) => same(n, name) || same(n.replace(/\s*\(\d+\)$/, ''), name));
  if (index < 0) {
    throw friendly({ message: `The product has no tab "${name}". Its tabs: ${listed(names)}.`, hint: 'Name the tab as it reads; the count of the reviews may be left out.' });
  }
  const tab = tabs.nth(index);
  const panelId = String(await tab.getAttribute('href') || '').replace(/^#/, '') || await tab.getAttribute('aria-controls');
  await tab.click();
  if (panelId) {
    try {
      await this.page.locator(`#${panelId}`).waitFor({ state: 'visible', timeout: budget(this) * 2 });
    } catch (err) {
      throw friendly({ message: `Clicked the tab "${names[index]}", but its panel did not show.`, hint: 'A tab shows its panel when it is clicked.' });
    }
  }
});
