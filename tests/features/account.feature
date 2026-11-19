@account
Feature: The customer's account
  As a customer of the store
  I want to log in, find my orders and keep my addresses
  So that the next order is quick

  Scenario: The account page's login form logs a customer in
    Given I am an anonymous user
    When I log in to the store as "customer"
    Then I should be logged in as the "customer" user
    And my account should have the "customer" role
    And I should see "Hello customer"
    And I should not see the admin bar

  Scenario: The account page's login form refuses a wrong password
    Given I am an anonymous user
    When I log in to the store as "customer" with the password "wrong-password"
    Then I should see the error message "The password you entered for the username customer is incorrect"
    And I should not be logged in

  Scenario: The account's pages by their menu links
    Given I am a logged in user with the "customer" user
    And I am on my "Dashboard" account page
    Then I should see "From your account dashboard you can view your recent orders"
    When I go to my "Account details" account page
    # The label of a required field ends with "*".
    Then the "Email address *" field should contain "customer@example.com"
    When I go to my "Addresses" account page
    Then my billing address should contain "Casey Customer"
    And my billing address should contain "2 Test Avenue"
    And my shipping address should contain "Los Angeles"

  Scenario: A changed address, and the old one back
    Given I am a logged in user with the "customer" user
    When I change my billing address:
      | Town / City | San Diego |
      | ZIP Code    | 92101     |
    Then I should see the success message "Address changed successfully."
    And my billing address should contain "San Diego"
    And my billing address should not contain "Los Angeles"
    When I change my billing address:
      | Town / City | Los Angeles |
      | ZIP Code    | 90001       |
    Then I should see the success message "Address changed successfully."
    And my billing address should contain "Los Angeles"

  Scenario: The store keeps a customer out of the administration
    Given I am a logged in user with the "customer" user
    When I go to "/wp-admin/"
    Then the path should be "/my-account/"
    And I should not see the admin bar
