from playwright.sync_api import sync_playwright, expect
import json
import time

def test_mobile_nav_accessibility(page):
    # Log console messages
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    # Setup mock env
    mock_supabase_url = "https://mock.supabase.co"

    page.add_init_script(f"""
        window.__ENV__ = {{
            VITE_SUPABASE_URL: "{mock_supabase_url}",
            VITE_SUPABASE_ANON_KEY: "mock-key"
        }};
    """)

    # Mock Supabase requests
    def handle_supabase(route):
        route.fulfill(status=200, content_type="application/json", body="{}")

    page.route(f"{mock_supabase_url}/**/*", handle_supabase)

    # Mock backend API requests
    page.route("**/api/**/*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))

    # 1. Arrange: Go to the app with mobile viewport
    page.set_viewport_size({"width": 375, "height": 812})
    # Go to /search to avoid LandingPage logic and ensure MobileNavBar is rendered
    page.goto("http://localhost:5173/search")

    # Handle cookie consent if present (click Reject All to clear view)
    try:
        reject_btn = page.get_by_role("button", name="Reject All")
        if reject_btn.is_visible(timeout=5000):
            reject_btn.click()
    except:
        pass

    # Wait for the app to load
    # Since we hardcoded the user in MobileNavBar, the "Menu" button should appear
    menu_button = page.get_by_role("button", name="Menu")

    try:
        expect(menu_button).to_be_visible(timeout=10000)
    except AssertionError:
        print("Menu button not found. Taking screenshot of failure.")
        page.screenshot(path="verification/login_failed.png")
        raise

    # 2. Act: Click the Menu button to open the sheet
    menu_button.click()

    # Wait for the sheet to open
    # We expect the profile button with the user's name ("Test User")
    profile_button = page.get_by_role("button", name="Test User")
    expect(profile_button).to_be_visible()

    # 3. Assert: Check the structure of the profile button header

    # Verify the visible span inside the button
    visible_span = profile_button.locator("span.text-foreground")
    expect(visible_span).to_be_visible()
    expect(visible_span).to_have_text("Test User")

    # Verify the button does NOT contain an h2 anymore
    h2_inside_button = profile_button.locator("h2")
    expect(h2_inside_button).to_have_count(0)

    # Verify there is a hidden SheetTitle (h2) in the header
    sheet_content = page.locator("[role='dialog']")
    hidden_title = sheet_content.locator("h2.sr-only")
    expect(hidden_title).to_have_text("Test User")

    # 4. Screenshot: Capture the open menu
    page.screenshot(path="verification/mobile_menu.png")
    print("Verification successful!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_mobile_nav_accessibility(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
