@must-fail
Feature: Assertions of the checkout, the orders, the account and the mail that must fail
  Each scenario asserts something that is not true. A few place an order to
  have something to fail on (as the guest "must-fail@example.com", or as the
  customer): the scenarios tagged @must-fail-cleanup run afterwards and delete
  those orders again.

  Scenario: A refused checkout has no order confirmation
    Fails with: Expected the order confirmation, but the browser is on
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I place the order
    Then I should see the order confirmation

  Scenario: The checkout offers no such payment method
    Fails with: The checkout offers no payment method "Credit card"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I choose the "Credit card" payment method

  Scenario: The checkout's address has no such field
    Fails with: The address has no field "Province"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I fill in the shipping address:
      | Province | Ontario |

  Scenario: An order placed has another total, email, status and mail
    Fails with: Expected the order total "$99.00", but it reads "$23.00"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I choose the "Check payments" payment method
    And I place the order
    Then I should see the order confirmation
    And the order total should be "$99.00"

  Scenario: The order's email is the one the checkout took
    Fails with: Expected the order email "someone@example.com", but it reads "must-fail@example.com"
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I place the order
    Then I should see the order confirmation
    And the order email should be "someone@example.com"

  Scenario: The mail of a status the order does not have is not sent
    Fails with: No e-mail with "on its way" in its subject to must-fail@example.com
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I place the order
    Then I should see the order confirmation
    And an email with the subject "on its way" should be sent to "must-fail@example.com"

  Scenario: The shop mails the guest who ordered
    Fails with: Expected no e-mail to must-fail@example.com, but the shop sent
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I place the order
    Then I should see the order confirmation
    And no email should be sent to "must-fail@example.com"

  Scenario: The order's mail names the products ordered
    Fails with: does not contain "Sunglasses"
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I place the order
    Then I should see the order confirmation
    And the email with the subject "order has been received" to "must-fail@example.com" should contain "Sunglasses"

  Scenario: A new order is on hold, a guest's, and has the store's notes only
    Fails with: Expected the order status "Completed", but it is "On hold"
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I choose the "Check payments" payment method
    And I place the order
    Then I should see the order confirmation
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    Then the order status should be "Completed"

  Scenario: A guest's order belongs to no account
    Fails with: Expected the order to belong to "customer", but it belongs to a guest
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I place the order
    Then I should see the order confirmation
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    Then the order should belong to "customer"

  Scenario: A new order has no note of a later status
    Fails with: Expected the order note "Order status changed from On hold to Completed."
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I choose the "Check payments" payment method
    And I place the order
    Then I should see the order confirmation
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    Then the order notes should include "Order status changed from On hold to Completed."

  Scenario: The orders list shows the order's own status
    Fails with: is "On hold" in the orders list, not "Completed"
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "must-fail@example.com"
    And I fill in the shipping address:
      | First name | Mina          |
      | Last name  | Mustfail      |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I choose the "Check payments" payment method
    And I place the order
    Then I should see the order confirmation
    Given I am a logged in user with the "shop_manager" user
    Then the orders list should include the last placed order as "Completed"

  Scenario: A customer's order is in the customer's order history
    Fails with: not in the order history, but it is there
    Given I am a logged in user with the "customer" user
    And my cart is empty
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I choose the "Cash on delivery" payment method
    And I place the order
    Then I should see the order confirmation
    And my order history should not list the last placed order

  Scenario: A scenario that placed no order has no last placed order
    Fails with: No order was placed in this scenario, so there is no "last placed order"
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin

  Scenario: The customer's billing address is another
    Fails with: Expected "Paris" in the billing address, but it reads
    Given I am a logged in user with the "customer" user
    And I am on my "Addresses" account page
    Then my billing address should contain "Paris"

  Scenario: The account menu has no such page
    Fails with: The account menu has no "Wishlist"
    Given I am a logged in user with the "customer" user
    And I am on my "Wishlist" account page

  Scenario: The products list has no such product
    Fails with: Expected the product "No Such Product Of The Suite" in the products list
    Given I am a logged in user with the "shop_manager" user
    Then the products list should include "No Such Product Of The Suite"

  Scenario: The coupons list has no such coupon
    Fails with: Expected the coupon "suite99" in the coupons list
    Given I am a logged in user with the "shop_manager" user
    Then the coupons list should include "suite99"

  @must-fail-cleanup
  Scenario: The orders the scenarios above placed are deleted
    Given I am a logged in user with the "shop_manager" user
    When I delete the orders of "must-fail@example.com"
    And I delete the orders of "customer@example.com"
