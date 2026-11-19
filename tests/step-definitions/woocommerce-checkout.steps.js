'use strict';

// The checkout: the contact email, the shipping and billing addresses, the
// shipping method, the payment method, placing the order, the errors under
// the fields, and the order confirmation that follows (its order number,
// total, email and payment method).
//
// The checkout is a block that keeps its state in data stores of the page:
// the cart ("wc/store/cart": the address being saved, the shipping rates
// being fetched), the checkout ("wc/store/checkout": idle, processing,
// complete) and the payment methods ("wc/store/payment"). The steps wait on
// those, and on the page the store sends the browser to once the order is
// placed (the order received page), never on a fixed time. The order placed
// is remembered: the order steps of the account and of the administration
// read it as "the last placed order".

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
  waitForCart,
  rememberOrder,
  orderSummary,
  orderOnConfirmation,
} = require('./woocommerce-helpers');

/** The checkout block of the page, ready (its payment methods loaded), or fail plainly. */
async function checkoutBlock(world) {
  const block = world.page.locator('.wp-block-woocommerce-checkout').first();
  if (!(await block.count())) {
    throw friendly({ message: `The page is not the checkout (${world.page.url()}).`, hint: 'Go to it first: When I go to the checkout.' });
  }
  await waitForCart(world, null, 'load');
  try {
    await world.page.waitForFunction(() => {
      try {
        const payment = window.wp.data.select('wc/store/payment');
        return Boolean(payment && payment.paymentMethodsInitialized());
      } catch (e) {
        return false;
      }
    }, null, { timeout: budget(world) * 3 });
  } catch (err) {
    throw friendly({ message: 'The checkout did not load its payment methods in time.', hint: 'The checkout shows "Loading payment options…" until the store\'s payment methods are ready.' });
  }
  return block;
}

/** Wait until the checkout is idle again after an address or a choice changed. */
async function checkoutIdle(world, what) {
  await waitForCart(world, null, what);
  try {
    await world.page.waitForFunction(() => {
      try {
        const checkout = window.wp.data.select('wc/store/checkout');
        const cart = window.wp.data.select('wc/store/cart');
        return Boolean(checkout && cart && !checkout.isCalculating() && !cart.isAddressFieldsForShippingRatesUpdating());
      } catch (e) {
        return false;
      }
    }, null, { timeout: budget(world) * 3 });
  } catch (err) {
    throw friendly({ message: `The checkout did not ${what} in time.`, hint: 'The checkout recalculates the shipping and the totals after an address changes.' });
  }
}

/** The section of an address ("shipping" or "billing"), with its form shown. */
async function addressSection(world, kind) {
  const block = await checkoutBlock(world);
  const section = block.locator(kind === 'shipping'
    ? '#shipping-fields, .wc-block-checkout__shipping-fields'
    : '#billing-fields, .wc-block-checkout__billing-fields').first();
  if (kind === 'billing' && !(await section.count())) {
    // The billing address is the shipping one until "Use same address for billing" is unticked.
    const sameAddress = block.getByRole('checkbox', { name: 'Use same address for billing' });
    if (await sameAddress.count() && await sameAddress.isChecked()) {
      await sameAddress.uncheck();
      await checkoutIdle(world, 'show the billing address');
    }
  }
  if (!(await section.count())) {
    throw friendly({ message: `The checkout has no ${kind} address.`, hint: kind === 'shipping' ? 'A cart of virtual products only asks for no shipping address.' : 'The billing address shows once "Use same address for billing" is unticked.' });
  }
  // A saved address shows as a card: its "Edit" button shows the form.
  const edit = section.locator('.wc-block-components-address-card__edit, button[aria-label^="Edit"]').first();
  if (await edit.count() && await edit.isVisible()) {
    await edit.click();
    await section.locator('input, select').first().waitFor({ state: 'visible', timeout: budget(world) });
  }
  return section;
}

/** A field of a checkout section, by the label a person reads ("(optional)" aside). */
async function sectionField(world, section, label) {
  const fields = await section.locator('input:not([type="hidden"]):not([type="checkbox"]), select, textarea').evaluateAll((els) => els.map((el) => {
    const lab = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
    return { id: el.id, tag: el.tagName, label: lab ? lab.textContent.replace(/\s+/g, ' ').trim() : (el.getAttribute('aria-label') || '') };
  }));
  const wanted = clean(label).toLowerCase().replace(/\s*\(optional\)$/, '');
  const field = fields.find((f) => clean(f.label).toLowerCase().replace(/\s*\(optional\)$/, '') === wanted);
  if (!field) {
    throw friendly({ message: `The address has no field "${label}". Its fields: ${listed(fields.map((f) => f.label).filter(Boolean))}.`, hint: 'Name a field by the label the checkout shows (First name, Last name, Address, City, State, ZIP Code, Country/Region, Phone).' });
  }
  return { ...field, locator: section.locator(`[id="${field.id}"]`) };
}

/** Fill a field of the checkout: a select by the label of its option, any other by its text. */
async function fillCheckoutField(world, field, value) {
  if (field.tag === 'SELECT') {
    const options = await field.locator.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
    const option = options.find((o) => same(o, value));
    if (!option) {
      throw friendly({ message: `The field "${field.label}" has no option "${value}". It offers: ${listed(options)}.`, hint: 'Name the option as the menu shows it ("United States (US)", "California").' });
    }
    await field.locator.selectOption({ label: option });
  } else {
    // The "apartment" line hides behind a button until it is asked for.
    if (!(await field.locator.isVisible())) {
      const reveal = field.locator.locator('xpath=ancestor::*[contains(@class,"wc-block-components-address-form")]//button[contains(@class,"address-2")]');
      if (await reveal.count()) await reveal.first().click();
    }
    await field.locator.fill(value);
    await field.locator.blur();
  }
}

/** A radio of a group of the checkout (shipping or payment), by the start of its label. */
async function chooseRadio(world, groupSelector, kind, name) {
  const block = await checkoutBlock(world);
  const group = block.locator(groupSelector).first();
  if (!(await group.count())) {
    throw friendly({ message: `The checkout has no ${kind} methods.`, hint: kind === 'shipping' ? 'A cart of virtual products needs no shipping, and an address the store does not ship to has no method.' : 'The store offers its payment methods once the checkout has loaded.' });
  }
  const radios = await group.locator('input[type="radio"]').evaluateAll((els) => els.map((el) => {
    const lab = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
    return { id: el.id, label: lab ? lab.textContent.replace(/\s+/g, ' ').trim() : '' };
  }));
  const radio = radios.find((r) => same(r.label, name)) || radios.find((r) => clean(r.label).toLowerCase().startsWith(clean(name).toLowerCase()));
  if (!radio) {
    throw friendly({ message: `The checkout offers no ${kind} method "${name}". It offers: ${listed(radios.map((r) => r.label))}.`, hint: `Name the ${kind} method as the checkout shows it.` });
  }
  await group.locator(`[id="${radio.id}"]`).check();
  return radio;
}

/**
 * Fill in the contact email of the checkout (the address the order's mail
 * goes to).
 *
 * Example #1: When I fill in the checkout email with "guest@example.com"
 * Example #2: When we fill in the checkout email with "gina.guest@example.com"
 * Example #3: And I fill in the checkout email with "not-an-email"
 * Example #4: When I fill in the checkout email with "customer@example.com"
 * Example #5: And we fill in the checkout email with "guest@example.com"
 */
When(/^(I |we )*fill in the checkout email with "([^"]*)"$/, async function (pronounCase, email) {
  const block = await checkoutBlock(this);
  const field = block.locator('#email, .wc-block-checkout__contact-fields input[type="email"]').first();
  if (!(await field.count())) {
    throw friendly({ message: 'The checkout has no email field.', hint: 'The contact information is the first section of the checkout.' });
  }
  await field.fill(email);
  await field.blur();
  await checkoutIdle(this, 'take the email');
});

/**
 * Fill in the shipping address, or the billing address, of the checkout from
 * a table of fields (the labels the checkout shows) and values. A saved
 * address is opened with its "Edit" button first; for the billing address,
 * "Use same address for billing" is unticked first. Menus (Country/Region,
 * State) take the label of an option.
 *
 * Example #1: When I fill in the shipping address:
 * Example #2: When we fill in the shipping address:
 * Example #3: And I fill in the billing address:
 * Example #4: When I fill in the billing address:
 * Example #5: And we fill in the shipping address:
 */
When(/^(I |we )*fill in the (shipping|billing) address:$/, async function (pronounCase, kind, table) {
  const section = await addressSection(this, kind);
  const rows = table.raw().filter((r) => r.length >= 2 && clean(r[0]));
  // The country decides the other fields (the state menu, the postcode's label): it goes first.
  rows.sort((a, b) => (/country/i.test(a[0]) ? -1 : 0) - (/country/i.test(b[0]) ? -1 : 0));
  for (const [label, value] of rows) {
    const field = await sectionField(this, section, label);
    await fillCheckoutField(this, field, value);
    if (/country/i.test(label)) await checkoutIdle(this, 'take the country');
  }
  await checkoutIdle(this, `take the ${kind} address`);
});

/**
 * Choose a shipping method of the checkout, by the start of its label (the
 * label carries its cost: "Flat rate $5.00").
 *
 * Example #1: When I choose the "Flat rate" shipping method
 * Example #2: When we choose the "Flat rate" shipping method
 * Example #3: And I choose the "Flat rate $5.00" shipping method
 * Example #4: When I choose the "Free shipping" shipping method
 * Example #5: And we choose the "Local pickup" shipping method
 */
When(/^(I |we )*choose the "([^"]*)" shipping method$/, async function (pronounCase, name) {
  await chooseRadio(this, '.wc-block-checkout__shipping-option, .wp-block-woocommerce-checkout-shipping-methods-block', 'shipping', name);
  await checkoutIdle(this, `take the shipping method "${name}"`);
});

/**
 * Choose a payment method of the checkout, by its label ("Direct bank
 * transfer", "Check payments", "Cash on delivery").
 *
 * Example #1: When I choose the "Check payments" payment method
 * Example #2: When we choose the "Cash on delivery" payment method
 * Example #3: And I choose the "Direct bank transfer" payment method
 * Example #4: When I choose the "Cash on delivery" payment method
 * Example #5: And we choose the "Check payments" payment method
 */
When(/^(I |we )*choose the "([^"]*)" payment method$/, async function (pronounCase, name) {
  const radio = await chooseRadio(this, '.wc-block-checkout__payment-method, .wp-block-woocommerce-checkout-payment-block', 'payment', name);
  await eventually(this, () => this.page.evaluate((id) => {
    const el = document.getElementById(id);
    return Boolean(el && el.checked);
  }, radio.id), (checked) => checked, () => ({
    message: `Chose the payment method "${radio.label}", but the checkout did not select it.`,
    hint: 'The checkout selects a payment method when its radio is checked.',
  }));
});

/**
 * Place the order with the "Place Order" button. The step waits for the
 * store's answer: the order received page (the order is then the scenario's
 * "last placed order"), or the checkout again with the reasons it refused
 * (the errors under the fields, an error message), which the next steps
 * assert.
 *
 * Example #1: When I place the order
 * Example #2: When we place the order
 * Example #3: And I place the order
 * Example #4: When I place the order
 * Example #5: And we place the order
 */
When(/^(I |we )*place the order$/, async function (pronounCase) {
  const block = await checkoutBlock(this);
  await checkoutIdle(this, 'settle before the order is placed');
  const button = block.getByRole('button', { name: /^Place Order$/i }).first();
  if (!(await button.count())) {
    throw friendly({ message: 'The checkout has no "Place Order" button.', hint: 'The button is at the end of the checkout form.' });
  }
  const navigation = this.page.waitForURL((url) => /order-received/.test(String(url)), { timeout: budget(this) * 6 }).then(() => 'placed').catch(() => 'stayed');
  await button.click();
  // The checkout refuses in place: idle again with errors under its fields, or with an error of its own.
  // (Once the browser has left for the order received page, the stores are gone: the check says no.)
  const refused = this.page.waitForFunction(() => {
    try {
      const data = window.wp && window.wp.data;
      const checkout = data && data.select('wc/store/checkout');
      const validation = data && data.select('wc/store/validation');
      if (!checkout || !validation) return false;
      const visibleErrors = Object.values(validation.getValidationErrors() || {}).some((e) => !e.hidden);
      return (checkout.isIdle() && visibleErrors) || checkout.hasError();
    } catch (e) {
      return false;
    }
  }, null, { timeout: budget(this) * 6, polling: 100 }).then(() => 'refused').catch(() => 'stayed');
  const outcome = await Promise.race([navigation, refused]);
  if (outcome === 'placed') {
    await this.page.waitForLoadState('domcontentloaded');
    await settle(this);
    rememberOrder(this, await orderOnConfirmation(this));
  } else {
    await settle(this);
  }
});

/**
 * Assert the page is the order received page the store shows once an order
 * is placed ("Order received", "Thank you. Your order has been received."),
 * and remember the order it shows as the scenario's last placed order.
 *
 * Example #1: Then I should see the order confirmation
 * Example #2: And we should see the order confirmation
 * Example #3: Then I should see the order confirmation
 * Example #4: Then we should see the order confirmation
 * Example #5: And I should see the order confirmation
 */
Then(/^(I |we )*should see the order confirmation$/, async function (pronounCase) {
  try {
    await this.page.waitForURL((url) => /order-received/.test(String(url)), { timeout: budget(this) * 3 });
  } catch (err) {
    const errors = await this.page.locator('.wc-block-components-validation-error, .wc-block-components-notice-banner.is-error').allTextContents().catch(() => []);
    throw friendly({
      message: `Expected the order confirmation, but the browser is on ${this.page.url()}.${errors.length ? ` The checkout says: ${listed(errors)}.` : ''}`,
      hint: 'The store sends the browser to the order received page once it placed the order; a refused order stays on the checkout with its reasons.',
    });
  }
  await eventually(this, () => this.page.locator('main').innerText(), (text) => /order (has been )?received/i.test(text), () => ({
    message: `The order received page does not say the order was received (${this.page.url()}).`,
    hint: 'The page reads "Order received" and "Thank you. Your order has been received."',
  }));
  const order = await orderOnConfirmation(this);
  if (!order.id) {
    throw friendly({ message: `The order received page names no order (${this.page.url()}).`, hint: 'Its address carries the order: /checkout/order-received/<id>/?key=…' });
  }
  rememberOrder(this, order);
});

/**
 * Assert a line of the summary of the order received page: the order's
 * total, the email it goes to, or its payment method.
 *
 * Example #1: Then the order total should be "$23.00"
 * Example #2: And the order email should be "guest@example.com"
 * Example #3: Then the order payment method should be "Check payments"
 * Example #4: And the order payment method should be "Cash on delivery"
 * Example #5: Then the order total should be "$45.50"
 */
Then(/^the order (total|email|payment method) should be "([^"]*)"$/, async function (line, expected) {
  const key = { total: 'total', email: 'email', 'payment method': 'payment' }[line];
  await eventually(this, () => orderSummary(this), (summary) => summary[key] !== undefined && (key === 'total' ? samePrice(summary[key], expected) : same(summary[key], expected)), (summary) => ({
    message: summary && summary[key] !== undefined
      ? `Expected the order ${line} "${expected}", but it reads "${summary[key]}".`
      : `Expected the order ${line} "${expected}", but the page has no order summary (${this.page.url()}).`,
    hint: 'The order received page lists the order number, date, total, email and payment method.',
  }));
});

/**
 * Assert an error the store shows under a field (the checkout's fields, the
 * coupon field), by its text and, with "for", by the label of its field. A
 * part of the text is enough.
 *
 * Example #1: Then I should see the field error "Please enter a valid email address"
 * Example #2: And I should see the field error "Please enter a valid first name" for "First name"
 * Example #3: Then we should see the field error "cannot be applied because it does not exist" for "Enter code"
 * Example #4: Then I should not see the field error "Please enter a valid email address"
 * Example #5: And I should see the field error "Please enter a valid zip code" for "ZIP Code"
 */
Then(/^(I |we )*should( not)* see the field error "([^"]*)"(?: for "([^"]*)")?$/, async function (pronounCase, notCase, text, label) {
  const read = () => this.page.evaluate(() => [...document.querySelectorAll('.wc-block-components-validation-error')].filter((e) => {
    const box = e.getBoundingClientRect();
    return box.width || box.height;
  }).map((e) => {
    const holder = e.closest('.wc-block-components-text-input, .wc-block-components-select-input, .wc-blocks-components-select, .wc-block-components-combobox, .wc-block-components-totals-coupon, .wc-block-components-address-form__email, .wc-block-components-checkbox') || e.parentElement;
    const field = holder && holder.querySelector('input, select, textarea');
    let label = '';
    if (field) {
      const lab = (field.id && document.querySelector(`label[for="${field.id}"]`)) || field.closest('label');
      label = (lab ? lab.textContent : (field.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
    }
    return { text: e.textContent.replace(/\s+/g, ' ').trim(), label };
  }));
  const matches = (all) => (all || []).filter((e) => clean(e.text).toLowerCase().includes(clean(text).toLowerCase())
    && (!label || clean(e.label).toLowerCase().replace(/\s*\(optional\)$/, '') === clean(label).toLowerCase().replace(/\s*\(optional\)$/, '')));
  if (notCase) {
    await settle(this);
    const found = matches(await read());
    if (found.length) {
      throw friendly({ message: `Expected no field error "${text}"${label ? ` for "${label}"` : ''}, but the page shows it.`, hint: 'A field error is the reason the store prints under a field.' });
    }
    return;
  }
  await eventually(this, read, (all) => matches(all).length > 0, (all) => ({
    message: `Expected the field error "${text}"${label ? ` for "${label}"` : ''}. The fields' errors: ${listed((all || []).map((e) => `${e.label || 'a field'}: ${e.text}`))}.`,
    hint: 'The checkout checks its fields when the order is placed, the coupon field when a code is applied.',
  }));
});
