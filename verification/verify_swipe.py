import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock environment variables
    page.add_init_script("""
        window.__ENV__ = {
            VITE_SUPABASE_URL: 'https://mock.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'mock-key'
        };
    """)

    # Mock Auth
    page.add_init_script("""
        localStorage.setItem('plantswipe.auth', JSON.stringify({
            access_token: 'mock-token',
            user: { id: 'mock-user-id', email: 'test@example.com' }
        }));
    """)

    # Mock Plants Data
    mock_plants = [
        {
            "id": "1",
            "name": "Monstera",
            "scientific_name": "Monstera deliciosa",
            "plant_type": "plant",
            "utility": ["ornemental"],
            "comestible_part": [],
            "fruit_type": [],
            "season": ["Spring"],
            "habitat": ["Tropical"],
            "level_sun": "Full Sun",
            "promotion_month": "january",
            "family": "Araceae",
            "life_cycle": "Perennial",
            "foliage_persistance": "Evergreen",
            "toxicity_human": "Midly Irritating",
            "toxicity_pets": "Midly Irritating",
            "living_space": "Indoor",
            "composition": [],
            "maintenance_level": "Low",
            "multicolor": False,
            "bicolor": False,
            "spiked": False,
            "scent": False,
            "created_time": "2023-01-01T00:00:00Z",
            "updated_time": "2023-01-01T00:00:00Z",
            "status": "Approved",
            "aromatherapy": False,
            "plant_images": [{"link": "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=600&q=80", "use": "primary"}],
            "plant_colors": [{"colors": {"id": "1", "name": "green", "hex_code": "#00FF00"}}],
            "plant_watering_schedules": [],
            "plant_sources": []
        }
    ]

    # Mock /rest/v1/plants call
    page.route("**/rest/v1/plants*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=str(mock_plants).replace("'", '"').replace("False", "false").replace("True", "true")
    ))

    # Mock top_liked_plants RPC
    page.route("**/rest/v1/rpc/top_liked_plants*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    # Mock plant_translations
    page.route("**/rest/v1/plant_translations*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    # Mock Colors
    mock_colors = [
        {"id": "1", "name": "green", "hex_code": "#00FF00", "is_primary": True, "parent_ids": []},
        {"id": "2", "name": "yellow", "hex_code": "#FFFF00", "is_primary": True, "parent_ids": []}
    ]
    page.route("**/rest/v1/colors*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=str(mock_colors).replace("'", '"').replace("True", "true").replace("False", "false")
    ))

    # Mock Color Translations
    page.route("**/rest/v1/color_translations*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    # Mock Profiles
    page.route("**/rest/v1/profiles*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"id": "mock-user-id", "display_name": "Test User", "is_admin": false}'
    ))

    # Navigate to Discovery
    try:
        page.goto("http://localhost:5173/discovery")

        # Wait for the card to appear
        # The card contains the plant name "Monstera"
        page.wait_for_selector("text=Monstera", timeout=10000)

        # Wait a bit for images to "load" (they are external)
        time.sleep(1)

        # Take screenshot
        page.screenshot(path="verification/discovery.png")
        print("Screenshot taken: verification/discovery.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
