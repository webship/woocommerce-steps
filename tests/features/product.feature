@product
Feature: A product's page
  As a visitor of the store
  I want to read a product, choose its options and put it in my cart
  So that I buy the right thing

  @critical
  Scenario: A simple product on sale
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    Then the breadcrumbs should be "Home / Accessories / Beanie"
    And the product price should be "$18.00"
    And the product should be on sale
    When I open the "Additional information" product tab
    Then I should see "Red"
    When I add the product to the cart
    Then I should see the success message "“Beanie” has been added to your cart."
    And the mini cart should show 1 item

  Scenario: A product that is not on sale
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Album" from the product list
    Then the product price should be "$15.00"
    And the product should not be on sale

  @critical
  Scenario: A variable product: its options choose the variation, and its price
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    Then the product price should be "$42.00 – $45.00"
    And the product option "Logo" should be "Choose an option"
    And adding the product to the cart should be refused with "Please select some product options"
    When I choose "Blue" for the product option "Color"
    And I choose "Yes" for the product option "Logo"
    Then the product option "Color" should be "Blue"
    And the product option "Logo" should be "Yes"
    And the product price should be "$45.00"
    # A logo is made in blue only: with the logo chosen, the colour menu offers blue alone.
    When I choose "No" for the product option "Logo"
    And I choose "Red" for the product option "Color"
    Then the product price should be "$42.00"
    When I set the product quantity to 2
    And I add the product to the cart
    Then I should see the success message "2 × “Hoodie” have been added to your cart."
    And the mini cart should show 2 items

  Scenario: The reviews tab of a product
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Cap" from the product list
    And I open the "Reviews" product tab
    Then I should see "There are no reviews yet."
