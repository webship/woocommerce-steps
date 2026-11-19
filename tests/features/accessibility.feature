@accessibility
Feature: The store's pages for every visitor
  As a visitor who uses a screen reader or a keyboard
  I want the store's pages to have no critical accessibility fault
  So that I can buy like anybody else

  Scenario Outline: A page of the store has no critical accessibility violation
    Given I am an anonymous user
    When I go to "<page>"
    Then the page should have no critical accessibility violations

    Examples:
      | page                |
      | /shop/              |
      | /product/hoodie/    |
      | /cart/              |
      | /my-account/        |

  Scenario: The checkout with a product has no critical accessibility violation
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the checkout
    Then the page should have no critical accessibility violations
