#!/usr/bin/env bash
# Builds the shop the suite runs against: the latest WordPress with the free WooCommerce plugin in a
# DDEV project of type wordpress, the way a new shop starts:
#   - WooCommerce from the plugin directory, set up as its own first visit of the administration sets up
#     a new shop (orders in their own tables, the new e-mails), with the onboarding wizard skipped and
#     the shop open to visitors (not "coming soon");
#   - WooCommerce's own sample products (its sample-data/sample_products.xml, imported with the
#     WordPress importer, which is removed again), and the product lookup tables built for them;
#   - the default block theme (Twenty Twenty-Five), with the Mini-Cart and the account link in its header
#     (site/header.html), and the Cart and Checkout blocks WooCommerce puts on its pages;
#   - the offline payments only (direct bank transfer, check payments, cash on delivery), one flat rate
#     for every address, no taxes, US dollars, a store in San Francisco;
#   - the accounts of the suite, and the shop manager as the address of the shop's order notifications.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME         the DDEV project name                          (default woocommercesteps)
#   SITE_DIR             the project folder                             (default a new temporary folder)
#   WORDPRESS_VERSION    the WordPress release                          (default latest)
#   WOOCOMMERCE_VERSION  the WooCommerce release, from the directory    (default the latest stable)
#   PHP_VERSION          the PHP of the web container                   (default 8.4)
#   SITE_TITLE           the name of the shop                           (default Webship Store)
#   RESET_ONLY           1: build nothing; put the shop in SITE_DIR back as the build left it, after a
#                        run that was stopped half way (the orders, the coupons and the suite's products
#                        go, the customer's addresses come back)
#
# The accounts are configuration: this script creates them and cucumber.js names them; the features never
# create or delete an account. Each is named after its role, with one password:
#   administrator  dD.123123ddd  administrator (the installer's account)
#   shop_manager   dD.123123ddd  Shop manager: products, orders, coupons; gets the order notifications
#   customer       dD.123123ddd  Customer, with a billing and a shipping address
#
# Nothing is installed that is paid or needs an account: no WooCommerce.com connection, no extension
# from the marketplace, no payment provider.
set -euo pipefail
# No command of the build reads a terminal: a container command waits forever on an open stdin pipe.
exec < /dev/null

PROJECT_NAME="${PROJECT_NAME:-woocommercesteps}"
WORDPRESS_VERSION="${WORDPRESS_VERSION:-latest}"
WOOCOMMERCE_VERSION="${WOOCOMMERCE_VERSION:-}"
PHP_VERSION="${PHP_VERSION:-8.4}"
SITE_TITLE="${SITE_TITLE:-Webship Store}"
PASSWORD='dD.123123ddd'
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

wc_cli() { ddev wp wc "$@" --user=administrator; }

# The customer's addresses: the checkout fills them in, and the address scenarios change them and put
# them back.
customer_addresses() {
  local id
  id="$(ddev wp user get customer --field=ID)"
  wc_cli customer update "$id" \
    --first_name=Casey --last_name=Customer \
    --billing='{"first_name":"Casey","last_name":"Customer","address_1":"2 Test Avenue","city":"Los Angeles","state":"CA","postcode":"90001","country":"US","email":"customer@example.com","phone":""}' \
    --shipping='{"first_name":"Casey","last_name":"Customer","address_1":"2 Test Avenue","city":"Los Angeles","state":"CA","postcode":"90001","country":"US"}' \
    --porcelain > /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${RESET_ONLY:-}" = "1" ]; then
  orders="$(wc_cli shop_order list --status=any --per_page=100 --field=id 2>/dev/null | tr '\n' ' ')"
  for id in $orders; do wc_cli shop_order delete "$id" --force=true --porcelain > /dev/null; done
  coupons="$(ddev wp post list --post_type=shop_coupon --post_status=any --format=ids)"
  [ -n "$coupons" ] && ddev wp post delete $coupons --force > /dev/null
  suite_products="$(ddev wp post list --post_type=product --post_status=any --s='Suite' --format=ids)"
  [ -n "$suite_products" ] && ddev wp post delete $suite_products --force > /dev/null
  customer_addresses
  echo "The shop is back as the build left it."
  exit 0
fi

# Node.js 24, the line the workspace builds run.
ddev config --project-type=wordpress --docroot="" --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --nodejs-version=24
ddev start -y
SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

ddev wp core download --version="$WORDPRESS_VERSION"
ddev wp core install --url="$SITE_URL" --title="$SITE_TITLE" \
  --admin_user=administrator --admin_password="$PASSWORD" --admin_email=administrator@example.com --skip-email
ddev wp rewrite structure '/%postname%/'

ddev wp plugin install woocommerce ${WOOCOMMERCE_VERSION:+--version="$WOOCOMMERCE_VERSION"} --activate
# WooCommerce sets a new shop up on the first visit of its administration (orders in their own tables,
# the new e-mails, the "coming soon" page): done now, so the shop does not change under the first scenario.
ddev wp eval 'WC_Install::newly_installed();'

# The store: open to visitors, in San Francisco, in US dollars, without taxes; the onboarding wizard
# skipped, its task lists hidden, no marketplace suggestions and no tracking.
ddev wp option update woocommerce_coming_soon no
ddev wp option update woocommerce_store_address '60 29th Street'
ddev wp option update woocommerce_store_city 'San Francisco'
ddev wp option update woocommerce_store_postcode '94110'
ddev wp option update woocommerce_default_country 'US:CA'
ddev wp option update woocommerce_currency USD
ddev wp option update woocommerce_calc_taxes no
ddev wp option update woocommerce_default_customer_address base
ddev wp option update woocommerce_onboarding_profile '{"skipped":true}' --format=json
ddev wp option update woocommerce_task_list_hidden_lists '["setup","extended"]' --format=json
ddev wp option update woocommerce_show_marketplace_suggestions no
ddev wp option update woocommerce_allow_tracking no

# WooCommerce's own sample products, with their categories, attributes, variations and images. The
# importer reads the file as a person does in Tools > Import; it is removed again afterwards. Price
# sorting and the filters read the product lookup tables, which an import does not fill.
ddev wp plugin install wordpress-importer --activate
ddev wp import wp-content/plugins/woocommerce/sample-data/sample_products.xml --authors=skip --quiet
ddev wp plugin uninstall wordpress-importer --deactivate
wc_cli tool run regenerate_product_lookup_tables > /dev/null
wc_cli tool run regenerate_product_attributes_lookup_table > /dev/null
wc_cli tool run recount_terms > /dev/null

# The offline payments, and one flat rate for every address.
for gateway in bacs cheque cod; do
  wc_cli payment_gateway update "$gateway" --enabled=true --porcelain > /dev/null
done
wc_cli shipping_zone_method create 0 --method_id=flat_rate --enabled=true --settings='{"cost":"5.00"}' --porcelain > /dev/null

# The header of the default theme with the Mini-Cart and the account link, as a shop owner adds them in
# the site editor: a template part of the theme, saved in the database.
cp "$REPO_DIR/site/header.html" header-with-mini-cart.html
header_id="$(ddev wp post create header-with-mini-cart.html --post_type=wp_template_part --post_status=publish \
  --post_name=header --post_title=Header --porcelain)"
rm -f header-with-mini-cart.html
ddev wp post term set "$header_id" wp_theme "$(ddev wp option get stylesheet)" > /dev/null
ddev wp post term set "$header_id" wp_template_part_area header > /dev/null

# The accounts of the suite (the installer's account is the administrator).
ddev wp user create shop_manager shop_manager@example.com --role=shop_manager --user_pass="$PASSWORD" --porcelain > /dev/null
ddev wp user create customer customer@example.com --role=customer --user_pass="$PASSWORD" --porcelain > /dev/null
customer_addresses
# The order notifications go to the shop manager.
ddev wp eval 'foreach ( array( "new_order", "cancelled_order", "failed_order" ) as $id ) { $o = get_option( "woocommerce_{$id}_settings", array() ); $o = is_array( $o ) ? $o : array(); $o["enabled"] = "yes"; $o["recipient"] = "shop_manager@example.com"; update_option( "woocommerce_{$id}_settings", $o ); }'

ddev wp rewrite flush

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built the shop at $SITE_URL: WordPress $(ddev wp core version), WooCommerce $(ddev wp plugin get woocommerce --field=version), $(ddev wp post list --post_type=product --format=count) products"
