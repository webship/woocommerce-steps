@checkout
Feature: The checkout
  As a visitor or a customer of the store
  I want to place an order with an offline payment
  So that the store ships my products

  # Each scenario that places an order deletes it again, as the shop manager.

  Scenario: The checkout refuses an order without an address
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I place the order
    Then I should see the field error "Please enter a valid email address" for "Email address"
    And I should see the field error "Please enter a valid first name" for "First name"
    And I should see the field error "Please enter a valid zip code" for "ZIP Code"
    And the path should be "/checkout/"

  @critical
  Scenario: A guest orders with a check, and no account is made
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "guest@example.com"
    And I fill in the shipping address:
      | Country/Region | United States (US) |
      | First name     | Gina               |
      | Last name      | Guest              |
      | Address        | 1 Suite Road       |
      | City           | San Francisco      |
      | State          | California         |
      | ZIP Code       | 94110              |
    And I choose the "Flat rate" shipping method
    And I choose the "Check payments" payment method
    Then the cart subtotal should be "$18.00"
    And the cart order total should be "$23.00"
    When I place the order
    Then I should see the order confirmation
    And the order total should be "$23.00"
    And the order email should be "guest@example.com"
    And the order payment method should be "Check payments"
    And I should see "1 Suite Road"
    And I should not be logged in
    And an email with the subject "order has been received" should be sent to "guest@example.com"
    And the email with the subject "order has been received" to "guest@example.com" should be about the last placed order
    And the email with the subject "order has been received" to "guest@example.com" should contain "Beanie"
    And an email with the subject "New order" should be sent to "shop_manager"
    And no email should be sent to "customer"
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    Then the order status should be "On hold"
    And the order should belong to a guest
    When I delete the last placed order
    Then the orders list should not include the last placed order

  Scenario: A guest orders with a billing address of its own
    Given I am an anonymous user
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "guest@example.com"
    And I fill in the shipping address:
      | First name | Gina          |
      | Last name  | Guest         |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I fill in the billing address:
      | First name | Gina         |
      | Last name  | Guest        |
      | Address    | 9 Bill Lane  |
      | City       | San Diego    |
      | ZIP Code   | 92101        |
    And I choose the "Direct bank transfer" payment method
    And I place the order
    Then I should see the order confirmation
    And the order total should be "$21.00"
    And the order payment method should be "Direct bank transfer"
    And I should see "9 Bill Lane"
    And I should see "1 Suite Road"
    Given I am a logged in user with the "shop_manager" user
    When I delete the last placed order
    Then the orders list should not include the last placed order

  @critical
  Scenario: A customer orders with the saved addresses and cash on delivery
    Given I am a logged in user with the "customer" user
    And my cart is empty
    And I am on the shop
    When I add "Cap" to the cart from the product list
    And I go to the checkout
    Then I should see "2 Test Avenue"
    When I choose the "Cash on delivery" payment method
    And I place the order
    Then I should see the order confirmation
    And the order email should be "customer@example.com"
    And the order payment method should be "Cash on delivery"
    And the order total should be "$21.00"
    And my order history should list the last placed order as "Processing"
    When I open the last placed order in my order history
    Then the order status should be "Processing"
    And I should see "Cap"
    And an email with the subject "order has been received" should be sent to "customer"
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    Then the order should belong to "customer"
    When I delete the last placed order
    Then the orders list should not include the last placed order
