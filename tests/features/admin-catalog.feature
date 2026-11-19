@admin @catalog
Feature: The store's administration: who sees what, and the products
  As the shop manager
  I want the store's screens, and to add, change and remove a product
  So that the shop sells what it has

  @critical
  Scenario: The shop manager has the store's menus, not the site's plugins
    Given I am a logged in user with the "shop_manager" user
    Then my account should have the "shop_manager" role
    And the admin menu should list "Products"
    And the admin menu should list "Marketing"
    And the admin menu should not list "Plugins"
    And the "Products" admin submenu should list "Add new product"
    And the "Marketing" admin submenu should list "Coupons"
    When I go to the "Orders" admin screen
    Then I should be on the "Orders" admin screen
    And I should see "Orders"

  Scenario: The administrator has the site's plugins as well
    Given I am a logged in user with the "admin" user
    Then the admin menu should list "Products"
    And the admin menu should list "Plugins"

  Scenario: The store's own screens open by name
    Given I am a logged in user with the "shop_manager" user
    When I go to the "Coupons" admin screen
    Then I should be on the "Coupons" admin screen
    When I go to the "Store settings" admin screen
    Then I should see "Store Address"
    When I go to the "Store home" admin screen
    Then I should be on the "Store home" admin screen

  # The browser logs the 403 of the refusal: not a fault of the shop.
  @js-off
  Scenario: A customer is kept out of the store's screens
    Given I am a logged in user with the "customer" user
    When I go to the "Products" admin screen
    Then I should see the access denied screen

  @critical
  Scenario: A product added, changed in price, and removed
    Given I am a logged in user with the "shop_manager" user
    And there is no product "Suite Mug"
    And I am on the "Add new product" admin screen
    When I fill in "Product name" with "Suite Mug"
    And I fill in "Regular price ($)" with "12.50"
    And I press "Publish"
    Then I should see a success notice "Product published."
    And the products list should include "Suite Mug"
    # A search with one match takes the visitor to the product's page.
    Given I am an anonymous user
    When I search the store for "Suite Mug"
    Then the breadcrumbs should be "Home / Uncategorized / Suite Mug"
    And the product price should be "$12.50"
    Given I am a logged in user with the "shop_manager" user
    When I open the product "Suite Mug" in the admin
    And I fill in "Regular price ($)" with "9.90"
    And I press "Update"
    Then I should see a success notice "Product updated."
    Given I am an anonymous user
    When I search the store for "Suite Mug"
    Then the product price should be "$9.90"
    Given I am a logged in user with the "shop_manager" user
    When I move the product "Suite Mug" to the trash
    Then the products list should not include "Suite Mug"
    When I delete the product "Suite Mug" permanently
    Then the products list should not include "Suite Mug"
