@cart
Feature: The cart
  As a visitor of the store
  I want to gather products in my cart, change it and see what it costs
  So that I know what I will pay

  @critical
  Scenario: Products added from the list, in the mini cart and the cart, changed and removed
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I add "Cap" to the cart from the product list
    Then the mini cart should show 2 items
    When I open the mini cart
    Then the mini cart should contain "Beanie"
    And the mini cart should contain "Cap"
    And the mini cart should not contain "Hoodie"
    When I click "Cart" in the modal
    Then the cart should contain "Beanie"
    And the cart should contain "Cap"
    When I change the cart quantity of "Beanie" to 2
    Then the cart quantity of "Beanie" should be 2
    And the cart subtotal should be "$52.00"
    And the cart shipping should be "$5.00"
    And the cart order total should be "$57.00"
    When I remove "Cap" from the cart
    Then the cart should not contain "Cap"
    And the cart subtotal should be "$36.00"
    When I remove "Beanie" from the cart
    Then the cart should be empty

  Scenario: A coupon the store does not have is refused
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I apply the coupon "no-such-coupon"
    Then I should see the field error "does not exist" for "Enter code"
    And the cart should not have the coupon "no-such-coupon"
    And the cart order total should be "$23.00"

  Scenario: A coupon made in the administration takes ten percent off, and goes again
    Given I am a logged in user with the "shop_manager" user
    And there is no coupon "suite10"
    And I am on the "Add new coupon" admin screen
    When I fill in "Coupon code" with "suite10"
    And I select "Percentage discount" from "Discount type"
    And I fill in "Coupon amount" with "10"
    And I press "Publish"
    Then I should see a success notice "Coupon updated."
    And the coupons list should include "suite10"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I apply the coupon "SUITE10"
    Then the cart should have the coupon "suite10"
    And I should see the info message "has been applied to your cart"
    And the cart discount should be "-$1.80"
    And the cart order total should be "$21.20"
    When I remove the coupon "suite10"
    Then the cart should not have the coupon "suite10"
    And the cart order total should be "$23.00"
    Given I am a logged in user with the "shop_manager" user
    When I delete the coupon "suite10" permanently
    Then the coupons list should not include "suite10"
