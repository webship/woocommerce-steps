@shop
Feature: The shop
  As a visitor of the store
  I want to browse its products: page by page, sorted, by category and by a search
  So that I find what I came for

  # The store's own sample products: 18, of which "Hoodie with Pocket" is hidden from the catalog.

  @critical
  Scenario: The shop lists the products, sixteen to a page
    Given I am an anonymous user
    And I am on the shop
    Then I should not see the coming soon page
    And the breadcrumbs should be "Home / Shop"
    And the result count should be "Showing 1–16 of 17 results"
    And the product list should have 16 products
    And I should see the product "Beanie" in the product list
    And I should see the product "Hoodie" in the product list
    And I should not see the product "Hoodie with Pocket" in the product list
    When I go to the next page of the product list
    Then the product list should be on page 2
    And the product list should have 1 product
    And the result count should be "Showing 17–17 of 17 results"
    When I go to the previous page of the product list
    Then the product list should be on page 1
    And the product list should have 16 products

  Scenario: A page of the list by its number
    Given I am an anonymous user
    And I am on the shop
    When I go to page 2 of the product list
    Then the product list should be on page 2
    When I go to page 1 of the product list
    Then the product list should be on page 1

  Scenario: The product list sorted by price, both ways
    Given I am an anonymous user
    And I am on the shop
    When I sort the product list by "Sort by price: low to high"
    Then the product list should be ordered by price ascending
    And current url should have the "orderby" parameter with the "price" value
    When I sort the product list by "Sort by price: high to low"
    Then the product list should be ordered by price descending
    And current url should have the "orderby" parameter with the "price-desc" value
    When I sort the product list by "Default sorting"
    Then the result count should be "Showing 1–16 of 17 results"

  Scenario: A category from a product's page
    Given I am an anonymous user
    And I am on the shop
    When I open the product "Hoodie" from the product list
    Then the breadcrumbs should be "Home / Hoodies / Hoodie"
    When I open the category "Hoodies"
    Then I should see "Hoodies"
    And every product of the product list should be in the category "Hoodies"
    And the result count should be "Showing all 3 results"
    And I should see the product "Hoodie with Zipper" in the product list
    And I should not see the product "Beanie" in the product list

  Scenario: A category by its name
    Given I am an anonymous user
    And I am on the shop
    When I open the category "Accessories"
    Then the product list should have 5 products
    And every product of the product list should be in the category "Accessories"
    And I should see the product "Cap" in the product list

  Scenario: The store's search finds the products, and not a product hidden from the catalog
    Given I am an anonymous user
    When I search the store for "hoodie"
    Then I should see "Search results for"
    And the product list should have 3 products
    And I should see the product "Hoodie with Logo" in the product list
    And I should not see the product "Hoodie with Pocket" in the product list
    And I should not see the product "Beanie" in the product list

  Scenario: A search with no result says so
    Given I am an anonymous user
    When I search the store for "no such product of the suite"
    Then the product list should have 0 products
    And I should see "No products were found matching your selection."
