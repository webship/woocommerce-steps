'use strict';

// What this pack brings along for every scenario. Not a step file.
//
//   1. The WordPress pack's steps. A shop project installs this pack alone:
//      the login by a handle of the users registry, the administration
//      screens, menus and notices, the block editor, comments, the REST API
//      and the feeds come from @webship-js/wordpress-steps, which this package
//      depends on and loads here, so one `require` glob in cucumber.js is
//      enough. A project that lists the WordPress pack's glob as well is fine
//      while npm installed one copy of it (Node loads a file once); a second,
//      nested copy (the project pins another release line of it) registers
//      every WordPress step twice, so drop that glob then (see README).
//
//   2. The shop's administration screens, added to the WordPress pack's list
//      of named screens: `Given I am on the "Orders" admin screen` opens the
//      orders of the shop, as `the "Plugins" admin screen` opens the plugins.
//      A name the WordPress pack already has is never changed.
//
//   3. Per scenario: the moment it began (a mail step reads only the mail
//      that arrived since then) and the orders it placed (the "last placed
//      order" of the order steps).

const fs = require('fs');
const path = require('path');
const { Before } = require('@cucumber/cucumber');

const WORDPRESS_STEPS_DIR = path.join(path.dirname(require.resolve('@webship-js/wordpress-steps/package.json')), 'tests', 'step-definitions');
for (const file of fs.readdirSync(WORDPRESS_STEPS_DIR).filter((f) => f.endsWith('.js')).sort()) {
  require(path.join(WORDPRESS_STEPS_DIR, file));
}

const { ADMIN_SCREENS } = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');

// The screens of the shop's administration, by the name a person reads in the
// menu or on the screen, lower case. `admin.php?page=wc-orders` is the orders
// screen whichever way the shop stores its orders: with the posts storage it
// sends the browser on to `edit.php?post_type=shop_order`.
const SHOP_ADMIN_SCREENS = {
  'products': '/wp-admin/edit.php?post_type=product',
  'all products': '/wp-admin/edit.php?post_type=product',
  'add new product': '/wp-admin/post-new.php?post_type=product',
  'product categories': '/wp-admin/edit-tags.php?taxonomy=product_cat&post_type=product',
  'product tags': '/wp-admin/edit-tags.php?taxonomy=product_tag&post_type=product',
  'product attributes': '/wp-admin/edit.php?post_type=product&page=product_attributes',
  'orders': '/wp-admin/admin.php?page=wc-orders',
  'add new order': '/wp-admin/admin.php?page=wc-orders&action=new',
  'coupons': '/wp-admin/edit.php?post_type=shop_coupon',
  'add new coupon': '/wp-admin/post-new.php?post_type=shop_coupon',
  'store home': '/wp-admin/admin.php?page=wc-admin',
  'store settings': '/wp-admin/admin.php?page=wc-settings',
  'payments settings': '/wp-admin/admin.php?page=wc-settings&tab=checkout',
  'shipping settings': '/wp-admin/admin.php?page=wc-settings&tab=shipping',
  'accounts and privacy settings': '/wp-admin/admin.php?page=wc-settings&tab=account',
  'emails settings': '/wp-admin/admin.php?page=wc-settings&tab=email',
  'store status': '/wp-admin/admin.php?page=wc-status',
};
for (const [name, screen] of Object.entries(SHOP_ADMIN_SCREENS)) {
  if (!(name in ADMIN_SCREENS)) ADMIN_SCREENS[name] = screen;
}

Before(function () {
  this.wooScenarioStartedAt = Date.now();
  this.wooOrders = [];
});

module.exports = { WORDPRESS_STEPS_DIR, SHOP_ADMIN_SCREENS };
