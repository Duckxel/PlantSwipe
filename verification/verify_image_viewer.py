import asyncio
import json
from playwright.async_api import async_playwright, Page, Route, Request

# Mock data for the plant page
MOCK_PLANT = {
    "id": "123",
    "name": "Test Plant",
    "scientific_name": "Testus Plantus",
    "plant_type": "flower",
    "status": "published",
    # Add other fields if necessary to avoid crashes
}

MOCK_PLANT_TRANSLATION = {
    "plant_id": "123",
    "language": "en",
    "name": "Test Plant",
    "overview": "A beautiful test plant for verification.",
    "scientific_name": "Testus Plantus"
}

MOCK_IMAGES = [
    {"id": "img1", "plant_id": "123", "link": "https://via.placeholder.com/800x600?text=Image+1", "use": "primary"},
    {"id": "img2", "plant_id": "123", "link": "https://via.placeholder.com/800x600?text=Image+2", "use": "gallery"},
]

async def handle_plants_route(route: Route):
    await route.fulfill(json=MOCK_PLANT)

async def handle_translations_route(route: Route):
    await route.fulfill(json=MOCK_PLANT_TRANSLATION)

async def handle_images_route(route: Route):
    await route.fulfill(json=MOCK_IMAGES)

async def handle_empty_route(route: Route):
    await route.fulfill(json=[])

async def verify_image_viewer():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Inject environment variables
        await page.add_init_script("""
            window.__ENV__ = {
                VITE_SUPABASE_URL: 'https://mock.supabase.co',
                VITE_SUPABASE_ANON_KEY: 'mock-key'
            };
        """)

        # Intercept Supabase requests
        # We need to be careful with the patterns to match what supabase-js generates
        await page.route("**/rest/v1/plants?*", handle_plants_route)
        await page.route("**/rest/v1/plant_translations?*", handle_translations_route)
        await page.route("**/rest/v1/plant_images?*", handle_images_route)

        # Mock other relations to return empty arrays/objects to prevent errors
        await page.route("**/rest/v1/plant_colors?*", handle_empty_route)
        await page.route("**/rest/v1/plant_watering_schedules?*", handle_empty_route)
        await page.route("**/rest/v1/plant_sources?*", handle_empty_route)
        await page.route("**/rest/v1/plant_infusion_mixes?*", handle_empty_route)
        await page.route("**/rest/v1/plant_contributors?*", handle_empty_route)
        await page.route("**/rest/v1/plant_recipes?*", handle_empty_route)
        await page.route("**/rest/v1/color_translations?*", handle_empty_route)

        # Also mock impressions/likes to avoid errors
        await page.route("**/api/impressions*", lambda route: route.fulfill(status=200, json={"count": 0}))
        await page.route("**/api/plants/*/likes-count", lambda route: route.fulfill(status=200, json={"likes": 0}))

        # Navigate to the plant page
        # Using localhost:5173 as per standard Vite dev server port
        print("Navigating to plant page...")
        await page.goto("http://localhost:5173/plants/123")

        # Wait for the page to load and images to appear
        # We look for the image gallery carousel
        print("Waiting for gallery...")
        try:
            await page.wait_for_selector("img[alt*='Image 1']", timeout=10000)
        except Exception:
            # If explicit wait fails, take a screenshot to debug
            await page.screenshot(path="verification/debug_load_fail.png")
            print("Failed to find image. See verification/debug_load_fail.png")
            await browser.close()
            return

        # Click the first image to open the viewer
        print("Opening image viewer...")
        await page.click("img[alt*='Image 1']")

        # Wait for the viewer to open (look for Close button)
        await page.wait_for_selector("button[title='Close']", timeout=5000)

        # Give a moment for animations
        await asyncio.sleep(0.5)

        # Take a screenshot of the open viewer
        await page.screenshot(path="verification/image_viewer_open.png")
        print("Screenshot taken: verification/image_viewer_open.png")

        # Test keyboard focus
        # Press Tab to focus the Close button
        print("Testing keyboard focus...")
        await page.keyboard.press("Tab") # Focus might start at top or need a tab
        await page.keyboard.press("Tab") # Ensure we hit a button

        # Take a screenshot of the focused element
        await page.screenshot(path="verification/image_viewer_focus.png")
        print("Screenshot taken: verification/image_viewer_focus.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_image_viewer())
