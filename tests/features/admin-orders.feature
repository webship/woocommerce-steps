@admin @orders
Feature: The store's administration: an order from the checkout to its end
  As the shop manager
  I want to find a new order, write on it and complete it
  So that the customer gets the products and the mail that says so

  @critical
  Scenario: A guest's order is completed by the shop manager, and the guest is told
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    And I fill in the checkout email with "guest@example.com"
    And I fill in the shipping address:
      | First name | Gina          |
      | Last name  | Guest         |
      | Address    | 1 Suite Road  |
      | City       | San Francisco |
      | ZIP Code   | 94110         |
    And I choose the "Direct bank transfer" payment method
    And I place the order
    Then I should see the order confirmation
    Given I am a logged in user with the "shop_manager" user
    Then the orders list should include the last placed order as "On hold"
    When I open the last placed order in the admin
    Then the order status should be "On hold"
    And the order notes should include "Awaiting BACS payment"
    When I add the order note "A note of the webship-js suite"
    Then the order notes should include "A note of the webship-js suite"
    When I change the order status to "Completed"
    Then the order status should be "Completed"
    And the order notes should include "Order status changed from On hold to Completed."
    And the orders list should include the last placed order as "Completed"
    And an email with the subject "on its way" should be sent to "guest@example.com"
    And the email with the subject "on its way" to "guest@example.com" should be about the last placed order
    And the email with the subject "on its way" to "guest@example.com" should contain "Beanie"
    And the email with the subject "New order" to "shop_manager" should contain "Gina Guest"
    When I delete the last placed order
    Then the orders list should not include the last placed order

  Scenario: A customer's order cancelled by the shop manager shows so in the customer's account
    Given I am a logged in user with the "customer" user
    And my cart is empty
    And I am on the shop
    When I add "Polo" to the cart from the product list
    And I go to the checkout
    And I choose the "Check payments" payment method
    And I place the order
    Then I should see the order confirmation
    And my order history should list the last placed order as "On hold"
    Given I am a logged in user with the "shop_manager" user
    When I open the last placed order in the admin
    And I change the order status to "Cancelled"
    Then the order status should be "Cancelled"
    Given I am a logged in user with the "customer" user
    Then my order history should list the last placed order as "Cancelled"
    Given I am a logged in user with the "shop_manager" user
    When I delete the last placed order
    Then the orders list should not include the last placed order
