@must-fail
Feature: Assertions of the store front and the product page that must fail
  Each scenario asserts something that is not true on the test shop. Its last
  step must fail with the message of its description and a hint; the steps
  before it must pass (tests/check-must-fail.js).

  Scenario: The product list has another count
    Fails with: Expected the product list to show 15 product(s), but it shows 16
    Given I am an anonymous user
    And I am on the shop
    Then the product list should have 15 products

  Scenario: The result count reads otherwise
    Fails with: Expected the result count "Showing all 3 results", but it reads
    Given I am an anonymous user
    And I am on the shop
    Then the result count should be "Showing all 3 results"

  Scenario: A product hidden from the catalog is not in the list
    Fails with: No product "Hoodie with Pocket" is in the product list
    Given I am an anonymous user
    And I am on the shop
    Then I should see the product "Hoodie with Pocket" in the product list

  Scenario: A listed product is in the list
    Fails with: Expected no product "Beanie" in the product list
    Given I am an anonymous user
    And I am on the shop
    Then I should not see the product "Beanie" in the product list

  Scenario: A list sorted up is not sorted down
    Fails with: Expected the product list ordered by price descending
    Given I am an anonymous user
    And I am on the shop
    When I sort the product list by "Sort by price: low to high"
    Then the product list should be ordered by price descending

  Scenario: The sorting menu has no such option
    Fails with: The sorting menu has no "Sort by colour"
    Given I am an anonymous user
    And I am on the shop
    When I sort the product list by "Sort by colour"

  Scenario: The list is on its first page
    Fails with: Expected the product list on page 2, but it is on page 1
    Given I am an anonymous user
    And I am on the shop
    Then the product list should be on page 2

  Scenario: The list has no third page
    Fails with: The product list has no page 3 to go to from page 1
    Given I am an anonymous user
    And I am on the shop
    When I go to page 3 of the product list

  Scenario: The shop holds more than one category
    Fails with: Expected every product of the list in the category "Hoodies", but these are not
    Given I am an anonymous user
    And I am on the shop
    Then every product of the product list should be in the category "Hoodies"

  Scenario: The breadcrumbs read otherwise
    Fails with: Expected the breadcrumbs "Home / Store", but they read "Home / Shop"
    Given I am an anonymous user
    And I am on the shop
    Then the breadcrumbs should be "Home / Store"

  Scenario: The shop shows no message of an added product
    Fails with: Expected the success message "has been added to your cart"
    Given I am an anonymous user
    And I am on the shop
    Then I should see the success message "has been added to your cart"

  Scenario: The message of an added product is there
    Fails with: Expected no success message "has been added to your cart", but the page shows it
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    And I add the product to the cart
    Then I should not see the success message "has been added to your cart"

  Scenario: The store is open to visitors
    Fails with: Expected the store's "coming soon" page, but
    Given I am an anonymous user
    And I am on the shop
    Then I should see the coming soon page

  Scenario: An option has no value yet
    Fails with: Expected the option "Logo" to be "Yes", but it is "Choose an option"
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    Then the product option "Logo" should be "Yes"

  Scenario: An option has no such value
    Fails with: The option "color" has no value "Purple"
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    And I choose "Purple" for the product option "Color"

  Scenario: A product has no such option
    Fails with: The product has no option "Size"
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    And I choose "Large" for the product option "Size"

  Scenario: The price is another
    Fails with: Expected the product price "$20.00", but the page shows "$18.00"
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    Then the product price should be "$20.00"

  Scenario: A product without a sale price is not on sale
    Fails with: Expected the product on sale, but the page shows no sale badge
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Album" from the product list
    Then the product should be on sale

  Scenario: A product with a sale price is on sale
    Fails with: Expected the product not on sale, but the page shows its sale badge
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    Then the product should not be on sale

  Scenario: A simple product is not refused
    Fails with: Expected the store to refuse the product with "Please select", but it added it
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    Then adding the product to the cart should be refused with "Please select"

  Scenario: A variable product without its options is refused
    Fails with: The store did not add the product to the cart: Please select some product options
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    And I add the product to the cart

  Scenario: A product has no such tab
    Fails with: The product has no tab "Specifications"
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Beanie" from the product list
    And I open the "Specifications" product tab

  Scenario: A variable product has no add button in the list
    Fails with: The product "Hoodie" has no "Add to cart" button in the product list
    Given I am an anonymous user
    And I am on the shop
    When I add "Hoodie" to the cart from the product list

  Scenario: The store has no such category
    Fails with: The store has no product category "Shoes"
    Given I am an anonymous user
    And I am on the shop
    When I open the category "Shoes"
