from playwright.sync_api import sync_playwright

def verify_aphylia_chat_aria_labels():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:5173')

        # Take a screenshot
        page.screenshot(path="verification/dashboard.png")
        browser.close()

if __name__ == "__main__":
    verify_aphylia_chat_aria_labels()
