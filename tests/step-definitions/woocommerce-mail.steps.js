'use strict';

// The mail the shop sends, read in the mailbox of the test shop (Mailpit,
// which every DDEV project has at port 8026; `worldParameters.mailUrl` names
// another): the order received mail of the customer, the new order mail of
// the shop, the mail of a status the shop sets, and the absence of any.
//
// A mail step reads only the mail that arrived since the scenario began, never
// a mail of an earlier scenario or run. The subject of a shop's mail carries
// the shop's name and the order number ("[Webship Store]: New order #59"), so a
// step matches a part of the subject; letter case aside. An address stands
// for itself, a handle of the users registry for the account's address.

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  listed,
  addressOf,
  mailList,
  mailOfOrderSent,
  mailTo,
  mailText,
  lastOrder,
} = require('./woocommerce-helpers');

/**
 * Assert the shop sent an e-mail whose subject holds a text to an address (a
 * handle of the users registry stands for its address) since the scenario
 * began; the step waits for it to arrive.
 *
 * Example #1: Then an email with the subject "order has been received" should be sent to "guest@example.com"
 * Example #2: And an email with the subject "New order" should be sent to "shop_manager"
 * Example #3: Then an email with the subject "is on its way" should be sent to "customer"
 * Example #4: And an email with the subject "has been received" should be sent to "customer"
 * Example #5: Then an email with the subject "New order #" should be sent to "shop_manager@example.com"
 */
Then(/^an email with the subject "([^"]*)" should be sent to "([^"]*)"$/, async function (subject, who) {
  await mailTo(this, addressOf(this, who), subject);
});

/**
 * Assert the shop sent no e-mail to an address since the scenario began. When
 * the scenario placed an order, the step first waits for the shop to send that
 * order's mail (the e-mail that names the order is in the mailbox, and the mail
 * holds still), because the shop sends it, and an account's mail when the
 * checkout makes an account, in the request that places the order. Without an
 * order it reads the mailbox at once.
 *
 * Example #1: Then no email should be sent to "customer"
 * Example #2: And no email should be sent to "guest@example.com"
 * Example #3: Then no email should be sent to "shop_manager"
 * Example #4: But no email should be sent to "customer"
 * Example #5: Then no email should be sent to "nobody@example.com"
 */
Then(/^no email should be sent to "([^"]*)"$/, async function (who) {
  const address = addressOf(this, who);
  // An absence holds once the shop has sent what it sends: after an order, its mail.
  const orders = this.wooOrders || [];
  if (orders.length) await mailOfOrderSent(this, orders[orders.length - 1]);
  let messages;
  try {
    messages = (await mailList(this, address)).filter((m) => Date.parse(m.Created) >= (this.wooScenarioStartedAt || 0) - 2000);
  } catch (err) {
    throw friendly({ message: `Could not read the mailbox: ${clean(err && err.message)}.`, hint: 'Check worldParameters.mailUrl in cucumber.js.' });
  }
  if (messages.length) {
    throw friendly({ message: `Expected no e-mail to ${address}, but the shop sent: ${listed(messages.map((m) => m.Subject))}.`, hint: 'The step counts the mail that arrived since the scenario began.' });
  }
});

/**
 * Assert an e-mail whose subject holds a text, to an address, holds a text in
 * its body (its text version, or its HTML without the markup).
 *
 * Example #1: Then the email with the subject "order has been received" to "guest@example.com" should contain "Beanie"
 * Example #2: And the email with the subject "New order" to "shop_manager" should contain "Cash on delivery"
 * Example #3: Then the email with the subject "is on its way" to "customer" should contain "We have finished processing your order"
 * Example #4: And the email with the subject "has been received" to "customer" should contain "Casey"
 * Example #5: Then the email with the subject "New order" to "shop_manager" should contain "Gina Guest"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (subject, who, text) {
  const address = addressOf(this, who);
  const mail = await mailTo(this, address, subject);
  const body = mailText(mail);
  if (!body.toLowerCase().includes(clean(text).toLowerCase())) {
    throw friendly({ message: `The e-mail "${mail.subject}" to ${address} does not contain "${text}". It says: "${body.slice(0, 300)}".`, hint: 'The step reads the text of the e-mail, without its markup.' });
  }
});

/**
 * Assert an e-mail whose subject holds a text, to an address, is about the
 * order the scenario placed last: its subject or its body names the order's
 * number ("Order #59", "[Order #59]", "New order #59").
 *
 * Example #1: Then the email with the subject "order has been received" to "guest@example.com" should be about the last placed order
 * Example #2: And the email with the subject "New order" to "shop_manager" should be about the last placed order
 * Example #3: Then the email with the subject "is on its way" to "customer" should be about the last placed order
 * Example #4: And the email with the subject "has been received" to "customer" should be about the last placed order
 * Example #5: Then the email with the subject "New order" to "shop_manager@example.com" should be about the last placed order
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should be about the last placed order$/, async function (subject, who) {
  const order = lastOrder(this);
  const address = addressOf(this, who);
  const mail = await mailTo(this, address, subject);
  const text = `${clean(mail.subject)} ${mailText(mail)}`;
  if (!new RegExp(`#\\s*${String(order.number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
    throw friendly({ message: `The e-mail "${mail.subject}" to ${address} does not name order #${order.number}. It says: "${mailText(mail).slice(0, 240)}".`, hint: 'The order mail of the shop names its order: "Order #<number>".' });
  }
});
