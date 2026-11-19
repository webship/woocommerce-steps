# Step definitions

| File | Covers |
| --- | --- |
| `woocommerce-store.steps.js` | The store front: the store's pages, the product list (its count, the result count, a product in it, opening one, sorting it and its order, its pages, adding a product from it), a category, the store's search, the breadcrumbs, the store's messages, the "coming soon" page. |
| `woocommerce-product.steps.js` | A product's page: its options and their values, the quantity, adding it to the cart and the store's refusal, its price, the sale badge, its tabs. |
| `woocommerce-cart.steps.js` | Emptying the cart, the mini cart (its count, opening it, what it holds), the cart (what it holds, the quantities, removing a product, the empty cart), coupons (applying, having, removing one), the totals. |
| `woocommerce-checkout.steps.js` | The checkout: the contact email, the shipping and billing addresses, the shipping and payment methods, placing the order, the order confirmation and its summary, the errors under the fields. |
| `woocommerce-account.steps.js` | The customer's account: the account page's login form, the account's pages, the order history and an order's page, the billing and shipping addresses. |
| `woocommerce-admin.steps.js` | The store's administration: the scenario's order (opening it, the orders list, its status, its notes, its customer, deleting it), the products and coupons lists, leftovers of a run stopped half way. |
| `woocommerce-mail.steps.js` | The shop's mail, read in the mailbox of the test shop: an e-mail by a part of its subject, its text, the order it is about, the absence of any. |
| `woocommerce-defaults.js` | Loads the WordPress pack's steps, adds the store's screens to its named administration screens, and keeps per scenario the moment it began and the orders it placed. It registers no step. |
| `woocommerce-helpers.js` | Shared plumbing: the store's pages, the product list and its router, the product page's form, the cart and checkout blocks and their data stores, the store's messages, the orders a scenario placed, the mailbox. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` and the WordPress
  pack's steps (`node_modules/@webship-js/wordpress-steps/tests/step-definitions/`)
  first: a step that the generic vocabulary or the WordPress pack already covers
  (text, clicks, fields, dialogs, the login, the administration's screens, menus
  and notices) is not added here.
- No step phrase names the platform. A name appears only as an argument a step
  asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js or of the WordPress pack.
- Find things the way a person does: a label, a role, a text, the name of a
  product. What the shop prints the same way on every site is the fallback: the
  classes of the product list, the cart and checkout blocks, the add-to-cart
  form, the account's tables and the order screen.
- Wait on the shop, never on a fixed time: on the router of the product list, on
  the data stores of the cart and the checkout (`wc/store/cart`,
  `wc/store/checkout`, `wc/store/payment`, `wc/store/validation`), on the page a
  form leads to and its notice.
- Fail with `friendly({ message, hint })`: what was expected, what was found
  and where to look.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created by the build of the shop.
- Open the page in a real browser before writing or changing its step, and
  write the step from what is there.
- Give every assertion a scenario in `tests/must-fail/` that makes it fail.
