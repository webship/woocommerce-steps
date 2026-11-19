<p align="center"><img src="https://raw.githubusercontent.com/webship/woocommerce-steps/2.0.x/assets/logo.svg" alt="WooCommerce logo" width="96"></p>

# woocommerce-steps

[![Test](https://github.com/webship/woocommerce-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/woocommerce-steps/actions/workflows/test.yml)

Cucumber step definitions for testing shops on WordPress with WooCommerce, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/woocommerce-steps` is an extension of
[`@webship-js/wordpress-steps`](https://github.com/webship/wordpress-steps): it
depends on it and loads it, so a shop project installs this one pack and has
both. The WordPress pack gives the login by a handle of the users registry, the
administration screens and menus, the block editor and the rest of the site;
this pack adds the shop:

- **the store front**: the product list (its count, sorting, its pages), a
  category, the store's search, the breadcrumbs, the store's messages, and
  whether the store is open to visitors or shows its "coming soon" page;
- **a product's page**: the options of a variable product and the variation
  they choose, the quantity, adding it to the cart (and the store's refusal
  when an option is missing), the price, the sale badge, the tabs;
- **the cart**: the mini cart in the header, the products of the cart, their
  quantities, removing one, a coupon (applied, refused, removed), the totals,
  the empty cart;
- **the checkout**: the contact email, the shipping and billing addresses, the
  shipping and payment methods, placing the order (and the errors under the
  fields when the checkout refuses it), the order confirmation;
- **the customer's account**: the store's login form, the account's pages, the
  order history and an order's page, the billing and shipping addresses;
- **the administration of the store**: the order a scenario placed (in the
  list, its status, its notes, its customer, deleting it), the products and
  coupons lists, and the store's screens by name ("Orders", "Coupons",
  "Store settings");
- **the order e-mails**, read in the local mail catcher.

No step phrase names the platform: a scenario reads `When I add "Beanie" to the
cart from the product list` and `Then the order status should be "On hold"`.

CI builds a real shop with [DDEV](https://ddev.com) on the runner (the latest
WordPress, the latest WooCommerce from the plugin directory, its own sample
products, the default block theme, the offline payments), and runs the whole
suite against it twice on every push and pull request, then the assertions that
must fail; see [`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. PHP, WP-CLI, the database and the mail catcher run in DDEV's containers.

**1. The shop.** The pack's own build script (the one CI runs) makes the shop in a DDEV project of type `wordpress`: the latest WordPress, WooCommerce from the plugin directory (set up as a new shop is on its first visit, its onboarding wizard skipped, open to visitors), WooCommerce's own sample products, the default block theme with the mini cart in its header, the Cart and Checkout blocks, the offline payments (direct bank transfer, check payments, cash on delivery), one flat rate, no taxes, and the three accounts of [Test users](#test-users). It takes about two minutes.

```bash
git clone https://github.com/webship/woocommerce-steps.git
SITE_DIR="$PWD/woocommerce-shop" woocommerce-steps/.github/scripts/build-ddev-site.sh
```

The shop answers at `https://woocommercesteps.ddev.site` and its mailbox at `https://woocommercesteps.ddev.site:8026`. Its accounts are `administrator`, `shop_manager` and `customer`, each with the password `dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its WooCommerce plugin builds the same shop instead, on top of its WordPress plugin, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require woocommerce --with-needs
bash core/scripts/plugins.sh --activate woocommerce --with-needs
bash core/scripts/plugins.sh --install woocommerce
bash dev/cmd-woocommerce-project.sh wooshop --install --add-users --sample-data
```

That shop answers at `https://wooshop.ddev.site` and its mailbox at `https://wooshop.ddev.site:8026`. `--sample-data` imports the sample products the features name. Its accounts are the plugin's, the same three with the workspace's shared password `dD.123123ddd`: `administrator`, `shop_manager` and `customer` (step 3 names them). The workspace's own account is the installer's, and the shop's name is the site's ("dev wooshop"): the subjects of its mail carry it, and the mail steps read a part of a subject.

**2. A test project.**

```bash
mkdir woocommerce-tests && cd woocommerce-tests
npm init -y
npm install --save-dev webship-js @webship-js/woocommerce-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing. npm installs `@webship-js/wordpress-steps` along with the pack.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack (which loads the WordPress pack's itself), the tags that keep the assertions that must fail out of a normal run, the address of the shop and of its mailbox, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/woocommerce-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://woocommercesteps.ddev.site',
      mailUrl: (process.env.LAUNCH_URL || 'https://woocommercesteps.ddev.site') + ':8026',
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      // Chromium logs "Permissions policy violation: unload is not allowed in this document." on the classic
      // editor screens of the administration (a product, a coupon): not a fault of the shop.
      javascript: { mode: 'warn', levels: ['error'], ignore: 'Permissions policy violation: unload is not allowed' },
      // "admin" is the handle the WordPress pack's features give the administrator.
      users: {
        admin: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com' },
        shop_manager: { username: 'shop_manager', password: 'dD.123123ddd', email: 'shop_manager@example.com' },
        customer: { username: 'customer', password: 'dD.123123ddd', email: 'customer@example.com' },
      },
    },
  },
};
```

On a shop from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5), and `mailUrl` follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A visitor puts a product in the cart
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart should contain "Beanie"
    And the cart order total should be "$23.00"

  Scenario: The shop manager opens the orders
    Given I am a logged in user with the "shop_manager" user
    When I go to the "Orders" admin screen
    Then I should be on the "Orders" admin screen
    And the admin menu should not list "Plugins"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the shop: `https://woocommercesteps.ddev.site` for the build script's shop, `https://wooshop.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://woocommercesteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
12 steps (12 passed)
0m09.000s (executing steps: 0m09.000s)
[webship-js] HTML report → …/woocommerce-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/woocommerce-steps/tests/features/`): together they use every step of the pack. They read no file of their own, and they run as they are on the shop of either way of step 1.

### What the suite tests

The features of this repository run every step of the pack against the test shop, twice in a row in CI on every change, then the assertions that must fail: the shop and its pages, the result count, a product hidden from the catalog, sorting by price both ways, a category from a product's page and by its name, the store's search (and a search with no result, and one with a single result that opens the product); a simple product on sale and one that is not, a variable product whose options choose the variation and its price, the refusal of a product without its options, the quantity, the tabs; products added from the list, the mini cart, the cart's quantities and totals, removing products down to the empty cart, a coupon the store does not have, a coupon made in the administration that takes ten percent off and goes again; a checkout refused without an address, a guest's order with a check (and no account made, the guest's mail, the shop's mail), a guest's order with a billing address of its own, a customer's order with the saved addresses and cash on delivery (the order history, the order's page, its mail); the account's login form (and a wrong password), the account's pages, an address changed and put back, a customer kept out of the administration; the shop manager's menus and the administrator's, the store's screens by name, a customer refused the store's screens, a product added, changed in price and removed; a guest's order completed by the shop manager (a note, the status, the mail of the completed order), a customer's order cancelled by the shop manager and seen in the customer's account; an accessibility audit of the shop, a product, the cart, the account page and the checkout.

Every scenario that places an order deletes it again, and one that makes a product or a coupon removes it: the suite leaves the shop as it found it. The customer's address is changed and put back.

Not tested: payment providers (only the offline methods, which need no account anywhere), taxes, a second shipping zone or free shipping, product reviews written by a customer, downloads, registration (the store's account registration is off by default), refunds, the store's analytics, the new block product editor, and a classic theme's markup (the steps read the classic store's classes as a fallback, but CI runs the default block theme only).

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A shop on WordPress with WooCommerce, and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/woocommerce-steps
```

npm installs `@webship-js/wordpress-steps` with it. List only this pack's step files in `cucumber.js`: it loads the WordPress pack's itself. A project that also lists the WordPress pack's glob is fine while npm installed one copy of it (Node loads a file once); a second, nested copy (the project pins another release line of the WordPress pack) would register every WordPress step twice, so drop that glob then.

## Quick start

1. Add the pack's step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/woocommerce-steps/tests/step-definitions/**/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the shop, `mailUrl` at its mailbox, and name the
   accounts the suite logs in with (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-shop.ddev.site',
     mailUrl: 'https://your-shop.ddev.site:8026', // the shop's mailbox (Mailpit), for the mail steps
     storePages: {},                               // { cart: '/basket/' } when the shop moved its pages
     users: {
       shop_manager: { username: 'shop_manager', password: process.env.SHOP_MANAGER_PASSWORD, email: 'shop_manager@example.com' },
       customer: { username: 'customer', password: process.env.CUSTOMER_PASSWORD, email: 'customer@example.com' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the products, addresses and texts with those of your
   shop.

```gherkin
Feature: A variable product

  Scenario: The options choose the variation and its price
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    Then adding the product to the cart should be refused with "Please select some product options"
    When I choose "Blue" for the product option "Color"
    And I choose "Yes" for the product option "Logo"
    Then the product price should be "$45.00"
    When I add the product to the cart
    Then I should see the success message "“Hoodie” has been added to your cart."
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `woocommerce-store.steps.js` | 16 | The store's pages (shop, cart, checkout), the product list (count, result count, a product in it, opening one, sorting and its order, its pages, adding a product from it), a category, the store's search, the breadcrumbs, the store's messages, the "coming soon" page. |
| `woocommerce-product.steps.js` | 8 | A product's options and their values, the quantity, adding it to the cart and the store's refusal, its price, the sale badge, its tabs. |
| `woocommerce-cart.steps.js` | 13 | Emptying the cart, the mini cart (its count, opening it, what it holds), the cart (what it holds, quantities, removing a product, the empty cart), coupons (applying, having, removing), the totals. |
| `woocommerce-checkout.steps.js` | 8 | The contact email, the shipping and billing addresses, the shipping and payment methods, placing the order, the order confirmation and its summary, the errors under the fields. |
| `woocommerce-account.steps.js` | 6 | The account page's login form, the account's pages, the order history and an order's page, the billing and shipping addresses (read and changed). |
| `woocommerce-admin.steps.js` | 14 | The scenario's order in the administration (opening it, the orders list, its status, its notes, its customer, deleting it), the products and coupons lists (listed, opened, moved to the trash, deleted for good), leftovers of a stopped run cleaned up. |
| `woocommerce-mail.steps.js` | 4 | The shop's mail: an e-mail by a part of its subject, its text, the order it is about, the absence of any. |
| `woocommerce-defaults.js` | | Loads the WordPress pack's steps, adds the store's screens to its named administration screens, and keeps per scenario the moment it began and the orders it placed. It registers no step. |
| `woocommerce-helpers.js` | | Shared plumbing: the store's pages, the product list and its router, the product page's form, the cart and checkout blocks and their data stores, the store's messages, the orders a scenario placed, the mailbox. It registers no step. |

Text, links, fields, buttons, dialogs, the status code and the headers of a
page and the accessibility audit are webship-js's own steps (`I should see
"..."`, `I fill in "Coupon code" with "suite10"`, `I press "Publish"`, `I click
"Cart" in the modal`, `the path should be "/checkout/"`, `the page should have
no critical accessibility violations`); the login, the administration's
screens, menus, notices and roles are the WordPress pack's (`I am a logged in
user with the "shop_manager" user`, `I go to the "Orders" admin screen`, `the
admin menu should list "Products"`, `I should see a success notice "Product
published."`, `I should see the access denied screen`). This pack adds only
what the shop decides.

## How the steps find things and wait

- **By what a person reads.** A product is found by the name its title shows,
  an option by the label of its menu, a field by its label, a cart line by its
  product, a payment method by its label, an order by its number. What the shop
  prints the same way on every site is the fallback: the classes of the product
  list (`li.wc-block-product`, `ul.products li.product`, `product_cat-<slug>`),
  the cart and checkout blocks (`.wc-block-cart-items__row`,
  `.wc-block-components-totals-*`), the add-to-cart form
  (`form.variations_form`, `input[name="variation_id"]`), the account's tables
  (`.woocommerce-orders-table__cell-*`) and the order screen (`#order_status`,
  `ul.order_notes`).
- **No fixed sleeps.** The steps wait on the shop's own signals:
  - the product list of a block theme loads in place through the store's
    router when it is sorted or paged: the step waits for the address and for
    the end of the router's loading bar, then for a quiet page;
  - the cart and checkout blocks keep the cart in a data store of the page
    (`wc/store/cart`): a step waits until the store resolved the cart, nothing
    is pending (items, coupons, the address, the shipping rate) and the block's
    placeholders are gone, and then until the cart holds what the action asked
    for (a quantity change starts a moment after the typing, so "nothing
    pending" alone is not enough);
  - the checkout's own stores (`wc/store/checkout`, `wc/store/payment`,
    `wc/store/validation`): the payment methods loaded, the checkout idle,
    the order placed (the browser sent to the order received page) or refused
    (the errors under the fields);
  - the variation the store finds once every option has a value (its id in
    the form), and the store's alert when an option is missing;
  - the page a form leads to and the notice of the administration screen
    ("Order updated.", "1 order moved to the Trash.");
  - the mail in the mailbox, polled until it arrives.
- **The last placed order.** The order a scenario places is remembered from
  the order received page (its number, id and key): the account, the
  administration and the mail steps read it as "the last placed order", so a
  feature never names an order number.
- **Failures say what was found.** `Expected the cart order total "$99.00", but
  it reads "$23.00".` with a hint on where to look.

## Accounts

The suite never creates or deletes an account, and a guest's checkout makes
none (the store's "create an account" at the checkout is off, as it is by
default). Accounts are configuration: list the ones the shop has in
`worldParameters.users`, by a handle the scenarios use, each with its
`username` and `password`, and its `email` for the mail steps (a handle stands
for its address there). Each account logs in through the site's login screen
(the WordPress pack's step); the store's own login form has a step of its own.

```javascript
users: {
  admin: { username: 'administrator', password: process.env.WP_ADMIN_PASSWORD, email: 'administrator@example.com' },
  shop_manager: { username: 'shop_manager', password: process.env.WP_SHOP_MANAGER_PASSWORD, email: 'shop_manager@example.com' },
  customer: { username: 'customer', password: process.env.WP_CUSTOMER_PASSWORD, email: 'customer@example.com' },
},
```

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the `WP_<HANDLE>_USER`,
`WP_<HANDLE>_PASSWORD` and `WP_<HANDLE>_EMAIL` variables replace them). The
build script creates them, each named after its role, with one password; the
Workspace's WooCommerce plugin creates the same three.

```json
{
  "admin": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com" },
  "shop_manager": { "username": "shop_manager", "password": "dD.123123ddd", "email": "shop_manager@example.com" },
  "customer": { "username": "customer", "password": "dD.123123ddd", "email": "customer@example.com" }
}
```

`admin` is the site's administrator (the installer's account in the build
script); `shop_manager` has the store's shop manager role (products, orders,
coupons, the store's settings) and gets the shop's order notifications;
`customer` has the customer role and a billing and a shipping address (Casey
Customer, 2 Test Avenue, Los Angeles). They are placeholder credentials of a
throwaway test shop, not of any real one.

## A test shop

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the shop the suite of this repository runs against, in a DDEV project of
type `wordpress` with PHP 8.4 and Node.js 24 (`WORDPRESS_VERSION`,
`WOOCOMMERCE_VERSION`, `PHP_VERSION`, `PROJECT_NAME` and `SITE_DIR` change
it):

- WordPress with WP-CLI, its permalinks as `/%postname%/`;
- WooCommerce from the plugin directory, set up the way its own first visit of
  the administration sets up a new shop (its orders in their own tables, the
  new e-mails), with the onboarding wizard skipped and the shop open to
  visitors (not "coming soon"), a store in San Francisco, in US dollars,
  without taxes;
- WooCommerce's own sample products (its `sample-data/sample_products.xml`,
  imported with the WordPress importer, which is removed again), and the
  product lookup tables built for them: an import leaves them empty, and
  sorting by price reads them;
- the default block theme, with the Mini-Cart and the account link in its
  header ([`site/header.html`](site/header.html), saved as the theme's header
  template part, as a shop owner adds them in the site editor), and the Cart and
  Checkout blocks WooCommerce puts on its pages;
- the offline payments (direct bank transfer, check payments, cash on
  delivery) and one flat rate of $5.00 for every address;
- the accounts of [Test users](#test-users), and the shop manager as the
  address of the shop's order notifications.

```bash
SITE_DIR="$PWD/../woocommerce-shop" .github/scripts/build-ddev-site.sh
npm test
```

Nothing is installed that is paid or needs an account: no WooCommerce.com
connection, no extension from the marketplace, no payment provider. The
store's "Get Jetpack" and "connect your store" prompts are never followed.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `woocommerce-store.steps.js` (16)

- `Given I am on the shop`
- `Then the product list should have 16 products`
- `Then the result count should be "Showing 1–16 of 17 results"`
- `Then I should see the product "Beanie" in the product list`
- `When I open the product "Hoodie" from the product list`
- `When I sort the product list by "Sort by price: low to high"`
- `Then the product list should be ordered by price ascending`
- `When I go to the next page of the product list`
- `Then the product list should be on page 2`
- `When I add "Beanie" to the cart from the product list`
- `When I open the category "Hoodies"`
- `Then every product of the product list should be in the category "Hoodies"`
- `When I search the store for "hoodie"`
- `Then the breadcrumbs should be "Home / Shop"`
- `Then I should see the success message "“Hoodie” has been added to your cart."`
- `Then I should not see the coming soon page`

### `woocommerce-product.steps.js` (8)

- `When I choose "Blue" for the product option "Color"`
- `Then the product option "Color" should be "Blue"`
- `When I set the product quantity to 2`
- `When I add the product to the cart`
- `Then adding the product to the cart should be refused with "Please select some product options"`
- `Then the product price should be "$45.00"`
- `Then the product should be on sale`
- `When I open the "Additional information" product tab`

### `woocommerce-cart.steps.js` (13)

- `Given my cart is empty`
- `Then the mini cart should show 1 item`
- `When I open the mini cart`
- `Then the mini cart should contain "Beanie"`
- `Then the cart should contain "Hoodie"`
- `When I change the cart quantity of "Beanie" to 2`
- `Then the cart quantity of "Beanie" should be 2`
- `When I remove "Beanie" from the cart`
- `Then the cart should be empty`
- `When I apply the coupon "suite10"`
- `Then the cart should have the coupon "suite10"`
- `When I remove the coupon "suite10"`
- `Then the cart subtotal should be "$45.00"`

### `woocommerce-checkout.steps.js` (8)

- `When I fill in the checkout email with "guest@example.com"`
- `When I fill in the shipping address:`
- `When I choose the "Flat rate" shipping method`
- `When I choose the "Check payments" payment method`
- `When I place the order`
- `Then I should see the order confirmation`
- `Then the order total should be "$23.00"`
- `Then I should see the field error "Please enter a valid email address"`

### `woocommerce-account.steps.js` (6)

- `When I log in to the store as "customer"`
- `Given I am on my "Orders" account page`
- `Then my order history should list the last placed order`
- `When I open the last placed order in my order history`
- `Then my billing address should contain "Los Angeles"`
- `When I change my billing address:`

### `woocommerce-admin.steps.js` (14)

- `When I open the last placed order in the admin`
- `Then the orders list should include the last placed order`
- `Then the order status should be "On hold"`
- `When I change the order status to "Completed"`
- `Then the order notes should include "Order status changed from On hold to Completed."`
- `When I add the order note "A note of the webship-js suite"`
- `Then the order should belong to a guest`
- `When I delete the last placed order`
- `Then the products list should include "Suite Mug"`
- `When I open the product "Suite Mug" in the admin`
- `When I move the product "Suite Mug" to the trash`
- `When I delete the product "Suite Mug" permanently`
- `Given there is no product "Suite Mug"`
- `When I delete the orders of "must-fail@example.com"`

### `woocommerce-mail.steps.js` (4)

- `Then an email with the subject "order has been received" should be sent to "guest@example.com"`
- `Then no email should be sent to "customer"`
- `Then the email with the subject "order has been received" to "guest@example.com" should contain "Beanie"`
- `Then the email with the subject "order has been received" to "guest@example.com" should be about the last placed order`

### Phrases shared with other packs

Shop packs share phrases on purpose, one profile per system (the webship-js
FAQ, "Can I load several step packs in one project?"): this pack shares 36 of
its 69 phrases with [`@webship-js/magento-steps`](https://github.com/webship/magento-steps)
and 19 with [`@webship-js/prestashop-steps`](https://github.com/webship/prestashop-steps),
among them `the cart should contain "..."`, `I change the cart quantity of "..." to 2`,
`I remove "..." from the cart`, `my cart is empty`, `I place the order`, `the
product price should be "..."`, `I add the product to the cart`, `I should see the
product "..." in the product list`, `I sort the product list by "..."`, `the
order status should be "..."`, `I should see the field error "..."` and the
mini cart's (`the mini cart should show 2 items`); and the three mail phrases
(`an email with the subject "..." should be sent to "..."`, `no email should be
sent to "..."`, `the email with the subject "..." to "..." should contain
"..."`) with [`@webship-js/laravel-steps`](https://github.com/webship/laravel-steps)
and [`@webship-js/symfony-steps`](https://github.com/webship/symfony-steps). Here
a subject is matched by a part of it: the shop's mail carries the shop's name
and the order number.

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../woocommerce-shop" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns (this pack, the WordPress pack, webship-js)
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the shop
npm run test:must-fail     # assertions that must fail, each with its message
```

`LAUNCH_URL` points the suite at another shop; `npx cucumber-js
tests/features/cart.feature` runs one feature and `npx cucumber-js
tests/features/cart.feature:<line>` one scenario (the line of its `Scenario:`;
the paths of `cucumber.js` are left out when the command line names any);
`FEATURES` runs a subset too (`FEATURES=tests/features/cart.feature npm test`);
`CUCUMBER_TAGS=@critical` runs the smoke lane; `HEADLESS=false` shows the
browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test shop. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing. A few of them place an order to have something to
fail on; the scenario tagged `@must-fail-cleanup` runs after them and deletes
those orders.

A run stopped half way can leave an order, a coupon, the suite's product
("Suite Mug") or the customer's changed address behind; the build script puts
the shop back without building anything:

```bash
RESET_ONLY=1 SITE_DIR="$PWD/../woocommerce-shop" .github/scripts/build-ddev-site.sh
```

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads or saves (the router's
loading bar, the data stores of the cart and the checkout, the skeleton rows of
a cart that is still loading), the exact messages. The steps are proven on
WordPress 7.1.5 with WooCommerce 11.3.0, Twenty Twenty-Five, in US English,
with Chromium.

Not covered: payment providers, the classic cart and checkout shortcodes (the
steps read the blocks), the new block-based product editor, and a shop's own
extensions.

## License

MIT

## Logo

The WooCommerce logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The WooCommerce name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
