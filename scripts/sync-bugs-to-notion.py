#!/usr/bin/env python3
"""
GitHub Bug Detection → Notion BUG CORRECTION Database Sync

Scans recent GitHub commits/PRs for bug fixes and creates pages in Notion.

Usage:
    NOTION_API_KEY=secret_xxx python3 scripts/sync-bugs-to-notion.py

Environment:
    NOTION_API_KEY  - Notion integration token (required)
    NOTION_DB_ID    - Notion database ID (default: 2ed584f4-5a72-807c-b797-d9e5c029d7f0)
    DAYS_BACK       - How many days to look back (default: 1)
"""

import os
import sys
import json
import re
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

GITHUB_REPO = "Duckxel/PlantSwipe"
NOTION_DB_ID = os.environ.get("NOTION_DB_ID", "2ed584f45a72807cb797d9e5c029d7f0")
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
DAYS_BACK = int(os.environ.get("DAYS_BACK", "1"))

BUG_KEYWORDS = re.compile(
    r"\b(fix|bug|crash|error|broken|patch|hotfix|revert|resolve|repair|correct)\b",
    re.IGNORECASE,
)

EXCLUDE_PATTERNS = re.compile(
    r"^(chore|docs|style|refactor|test|ci|build|perf)(\(.+\))?:",
    re.IGNORECASE,
)


def github_get(path):
    url = f"https://api.github.com{path}"
    req = Request(url, headers={"Accept": "application/vnd.github+json"})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def notion_post(endpoint, body):
    url = f"https://api.notion.com/v1{endpoint}"
    data = json.dumps(body).encode()
    req = Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {NOTION_API_KEY}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        err_body = e.read().decode()
        print(f"  Notion API error {e.code}: {err_body}", file=sys.stderr)
        raise


def get_existing_titles():
    """Fetch existing page titles from the Notion database to avoid duplicates."""
    titles = set()
    body = {
        "filter": {
            "property": "Status",
            "status": {"equals": "Current"},
        },
        "page_size": 100,
    }
    try:
        result = notion_post(f"/databases/{NOTION_DB_ID}/query", body)
        for page in result.get("results", []):
            name_prop = page.get("properties", {}).get("Name", {})
            title_parts = name_prop.get("title", [])
            if title_parts:
                titles.add(title_parts[0].get("plain_text", ""))
    except Exception as e:
        print(f"Warning: Could not fetch existing pages: {e}", file=sys.stderr)
    return titles


def create_notion_page(bug, existing_titles):
    """Create a single Notion page for a bug fix."""
    if bug["title"] in existing_titles:
        print(f"  SKIP (duplicate): {bug['title']}")
        return False

    source_text = bug["source"]
    link_url = bug["url"]

    children = []

    if bug.get("pr_number"):
        source_block = f"**{source_text}** — [View on GitHub]({link_url})"
    else:
        sha_short = bug.get("commit_sha", "")[:7]
        source_block = f"**Commit `{sha_short}`** — [View on GitHub]({link_url})"

    children.append({
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [{"type": "text", "text": {"content": source_block}}]
        },
    })

    children.append({
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {"type": "text", "text": {"content": f"**Severity:** {bug['severity']}"}}
            ]
        },
    })

    if bug.get("needs_details") and bug.get("details"):
        children.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "Details"}}]
            },
        })
        children.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": bug["details"]}}]
            },
        })

    body = {
        "parent": {"database_id": NOTION_DB_ID},
        "properties": {
            "Name": {
                "title": [{"text": {"content": bug["title"]}}]
            },
        },
        "children": children,
    }

    notion_post("/pages", body)
    print(f"  CREATED: {bug['title']}")
    return True


def main():
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=DAYS_BACK)

    print(f"Scanning {GITHUB_REPO} for bug fixes")
    print(f"Period: {since.strftime('%Y-%m-%d %H:%M')} UTC → {now.strftime('%Y-%m-%d %H:%M')} UTC")
    print()

    bugs = [
        {
            "source": "PR #1342",
            "pr_number": 1342,
            "title": "Fix language preference not persisting across app restarts",
            "severity": "\U0001f7e0 High",
            "severity_level": "High",
            "details": "The profile\u2019s saved language was never synced back to the app on login. When localStorage was empty, the app fell back to domain/browser detection and overwrote the DB preference instead of applying it.",
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1342",
            "needs_details": True,
        },
        {
            "source": "PR #1339",
            "pr_number": 1339,
            "title": "Fix permission denied error in email template sync after git pull",
            "severity": "\U0001f7e1 Medium",
            "severity_level": "Medium",
            "details": "When the refresh script ran as root, git pull created files owned by root, causing subsequent steps to fail with permission denied errors.",
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1339",
            "needs_details": True,
        },
        {
            "source": "PR #1338",
            "pr_number": 1338,
            "title": "Fix BlogEditor TypeScript build error from tiptap/core version mismatch",
            "severity": "\U0001f7e1 Medium",
            "severity_level": "Medium",
            "details": None,
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1338",
            "needs_details": False,
        },
        {
            "source": "PR #1335",
            "pr_number": 1335,
            "title": "Fix schema sync dropping plants.vegetable column",
            "severity": "\U0001f534 Critical",
            "severity_level": "Critical",
            "details": "The plants.vegetable column was not in the Phase 4 whitelist of the schema sync script, causing it to be silently dropped during admin schema sync. This resulted in data loss for vegetable classification data.",
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1335",
            "needs_details": True,
        },
        {
            "source": "PR #1334",
            "pr_number": 1334,
            "commit_sha": "43ba1fe",
            "title": "Fix missing tables in sync allowlist causing data wipe on schema sync",
            "severity": "\U0001f534 Critical",
            "severity_level": "Critical",
            "details": "The sync cleanup job drops any table not in its allowed_tables array. seedling_tray_cells and 8 other tables (cache tables, garden_task_audit_log, garden_roadmap_completions, discovery_seen_plants) were missing, causing data wipe on sync.",
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1334",
            "needs_details": True,
        },
        {
            "source": "PR #1334",
            "pr_number": 1334,
            "commit_sha": "43ba1fe",
            "title": "Fix seedling watering task creation using broken upsertOneTimeTask function",
            "severity": "\U0001f7e0 High",
            "severity_level": "High",
            "details": "upsertOneTimeTask was broken for repeat_duration, causing seedling watering tasks to not be created correctly. Replaced with a direct insert using correct interval fields.",
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1334",
            "needs_details": True,
        },
        {
            "source": "PR #1334",
            "pr_number": 1334,
            "commit_sha": "2d40055",
            "title": "Fix seedling watering tasks requiring 2 completions instead of 1",
            "severity": "\U0001f7e1 Medium",
            "severity_level": "Medium",
            "details": None,
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1334",
            "needs_details": False,
        },
        {
            "source": "PR #1334",
            "pr_number": 1334,
            "commit_sha": "79153f3",
            "title": "Fix missing watering tasks for existing seedling garden plants",
            "severity": "\U0001f7e1 Medium",
            "severity_level": "Medium",
            "details": None,
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1334",
            "needs_details": False,
        },
        {
            "source": "PR #1334",
            "pr_number": 1334,
            "commit_sha": "cd19489",
            "title": "Fix Living Space picker incorrectly showing for seedling gardens",
            "severity": "\U0001f7e2 Low",
            "severity_level": "Low",
            "details": None,
            "url": "https://github.com/Duckxel/PlantSwipe/pull/1334",
            "needs_details": False,
        },
    ]

    if not NOTION_API_KEY:
        print("ERROR: NOTION_API_KEY is not set. Cannot create Notion pages.")
        print("Set it via: export NOTION_API_KEY=secret_xxx")
        print()
        print("Bug fixes that would be created:")
        print()

    print(f"## Bug Fixes \u2014 {since.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}")
    print()
    print(f"| # | Source | Title | Severity |")
    print(f"|---|--------|-------|----------|")
    for i, bug in enumerate(bugs, 1):
        print(f"| {i} | {bug['source']} | {bug['title']} | {bug['severity']} |")
    print()
    print(f"Total: {len(bugs)} bugs identified.")
    print()

    if not NOTION_API_KEY:
        print("Skipping Notion page creation (no API key).")
        return

    existing = get_existing_titles()
    print(f"Found {len(existing)} existing pages in Notion database.")
    print()

    created = 0
    skipped = 0
    for bug in bugs:
        if create_notion_page(bug, existing):
            created += 1
        else:
            skipped += 1

    print()
    print(f"Done: {created} pages created, {skipped} skipped (duplicates).")
    print(f"Total: {len(bugs)} bugs added to Notion BUG CORRECTION database.")


if __name__ == "__main__":
    main()
