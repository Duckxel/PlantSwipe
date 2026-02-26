from playwright.sync_api import sync_playwright
import time

def verify_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Inject mock environment variables
        page.add_init_script("""
            window.__ENV__ = {
                VITE_SUPABASE_URL: 'https://mock.supabase.co',
                VITE_SUPABASE_ANON_KEY: 'mock-key'
            };
        """)

        # Go to search page to see TopBar and Footer (TopBar is visible on desktop)
        print("Navigating to /search...")
        page.goto("http://127.0.0.1:5173/search")

        # Wait for page load
        time.sleep(2)

        # Handle cookie consent if present
        try:
            reject_btn = page.get_by_role("button", name="Reject all")
            if reject_btn.is_visible():
                reject_btn.click()
                print("Clicked Reject all cookies")
                time.sleep(1)
        except Exception as e:
            print(f"Cookie consent handling skipped: {e}")

        # Check for TopBar elements
        # "Aphylia" is the app name in TopBar
        print("Checking for TopBar...")
        app_name = page.get_by_role("link", name="Aphylia").first
        if app_name.is_visible():
            print("TopBar app name is visible")
        else:
            print("TopBar app name NOT visible")

        # Check for Footer elements
        # "About" link in Footer
        print("Checking for Footer...")
        about_link = page.get_by_role("link", name="About")
        if about_link.is_visible():
             print("Footer About link is visible")
        else:
             print("Footer About link NOT visible")

        # Take screenshot
        screenshot_path = "verification/layout_verification.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_layout()
