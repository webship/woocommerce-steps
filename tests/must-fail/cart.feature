@must-fail
Feature: Assertions of the cart that must fail
  Each scenario asserts something that is not true of the visitor's cart. Its
  last step must fail with the message of its description and a hint.

  Scenario: The mini cart counts another number
    Fails with: Expected the mini cart to count 3 item(s), but it counts 1
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    Then the mini cart should show 3 items

  Scenario: The mini cart holds another product
    Fails with: Expected "Cap" in the mini cart. It holds: "Beanie"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I open the mini cart
    Then the mini cart should contain "Cap"

  Scenario: The mini cart holds the product
    Fails with: Expected no "Beanie" in the mini cart, but it holds it
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I open the mini cart
    Then the mini cart should not contain "Beanie"

  Scenario: The cart holds another product
    Fails with: Expected "Cap" in the cart. It holds: "Beanie"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart should contain "Cap"

  Scenario: The cart holds the product
    Fails with: Expected no "Beanie" in the cart, but it holds it
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart should not contain "Beanie"

  Scenario: The cart holds another quantity
    Fails with: Expected 3 of "Beanie" in the cart, but it holds 1
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart quantity of "Beanie" should be 3

  Scenario: A cart with a product is not empty
    Fails with: Expected an empty cart, but it holds "Beanie × 1"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart should be empty

  Scenario: A product that is not in the cart cannot be removed
    Fails with: The cart has no "Remove" for "Cap"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I remove "Cap" from the cart

  Scenario: A refused coupon is not on the cart
    Fails with: Expected the coupon "no-such-coupon" on the cart
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I apply the coupon "no-such-coupon"
    Then the cart should have the coupon "no-such-coupon"

  Scenario: A coupon that is not on the cart cannot be removed
    Fails with: The cart has no coupon "suite10"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I remove the coupon "suite10"

  Scenario: The total is another
    Fails with: Expected the cart order total "$99.00", but it reads "$23.00"
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart order total should be "$99.00"

  Scenario: A cart without a coupon has no discount line
    Fails with: Expected the cart discount "-$1.80", but the totals have no discount line
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then the cart discount should be "-$1.80"

  Scenario: A cart with no error under a field
    Fails with: Expected the field error "Please enter a valid email address". The fields' errors: (none)
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    Then I should see the field error "Please enter a valid email address"

  Scenario: The reason a coupon was refused is under its field
    Fails with: Expected no field error "does not exist", but the page shows it
    Given I am an anonymous user
    And I am on the shop
    When I add "Beanie" to the cart from the product list
    And I go to the cart
    And I apply the coupon "no-such-coupon"
    Then I should not see the field error "does not exist"

  Scenario: The cart needs a cart page
    Fails with: The page shows no cart
    Given I am an anonymous user
    And I am on the shop
    Then the cart should contain "Beanie"
