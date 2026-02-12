
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
        )
        page = await context.new_page()

        # Mock env.js
        await page.route("**/env.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body="window.__ENV__ = { VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_ANON_KEY: 'mock-key' };"
        ))

        # Mock Supabase auth user to simulate logged in state (optional, but good to test both)
        # For now let's test guest state first as it has Search, Home, Login, Signup

        # Navigate to home
        await page.goto("http://localhost:5173/")

        # Wait for navbar to be visible
        # MobileNavBar uses <nav ... aria-label="Primary">
        nav = page.get_by_label("Primary")
        await expect(nav).to_be_visible()

        # Press Tab to focus on the first element in the page
        # We might need to press Tab multiple times to reach the navbar if it's at the bottom
        # But wait, MobileNavBar is fixed at bottom.
        # Let's try to focus specifically on one of the buttons.

        # Find the "Search" link/button in the navbar
        search_btn = nav.get_by_role("link", name="Search")
        await expect(search_btn).to_be_visible()

        # Force focus on it
        await search_btn.focus()

        # Take a screenshot of the navbar area
        # We can take a screenshot of the whole page, but maybe focusing on the bottom part is better
        await page.screenshot(path="focus_style_search.png")

        # Now let's try to tab to the next one "Login"
        await page.keyboard.press("Tab")
        await page.screenshot(path="focus_style_login.png")

        print("Screenshots taken")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
