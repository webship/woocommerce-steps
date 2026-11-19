# Features

Reference features for the test shop that `.github/scripts/build-ddev-site.sh`
builds: WordPress with WooCommerce, its own sample products, the default block
theme with the mini cart in its header, the offline payments and a flat rate of
$5.00, and the three accounts of `cucumber.js` (`admin`, `shop_manager`,
`customer`). A shop built with the Webship Workspace's WooCommerce plugin
(`cmd-woocommerce-project.sh <name> --install --add-users --sample-data`) runs
them as they are. Copy a feature into your project and replace the products,
addresses and texts with those of your shop.

| Feature | Covers |
| --- | --- |
| `shop` | The shop and its pages, the result count, a product hidden from the catalog, sorting by price both ways, a category from a product's page and by its name, the store's search, a search with no result. |
| `product` | A simple product on sale and one that is not, a variable product whose options choose the variation and its price, the refusal of a product without its options, the quantity, the tabs. |
| `cart` | Products added from the list, the mini cart, the cart's quantities and totals, removing products down to the empty cart, a coupon the store does not have, a coupon made in the administration that takes ten percent off and goes again. |
| `checkout` | A checkout refused without an address, a guest's order with a check (no account made, the guest's mail, the shop's mail), a guest's order with a billing address of its own, a customer's order with the saved addresses and cash on delivery. |
| `account` | The account page's login form, a wrong password, the account's pages, an address changed and put back, a customer kept out of the administration. |
| `admin-catalog` | The shop manager's menus and the administrator's, the store's screens by name, a customer refused the store's screens, a product added, changed in price and removed. |
| `admin-orders` | A guest's order completed by the shop manager (a note, the status, the mail), a customer's order cancelled by the shop manager and seen in the customer's account. |
| `accessibility` | An accessibility audit of the shop, a product, the cart, the account page and the checkout. |

Scenarios that make something remove it again: an order placed is deleted by
the shop manager, a product or a coupon made is deleted for good, an address
changed is put back. No scenario creates or deletes an account, and a guest's
checkout makes none.
