#!/usr/bin/env python3
"""
BigQuery Quota Diagnostic Script

This script helps diagnose and fix BigQuery quota issues by:
1. Checking current job queue status
2. Listing recent jobs
3. Identifying stuck/failed jobs
4. Providing recommendations
"""

import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

try:
    from google.cloud import bigquery
    from google.api_core import exceptions
except ImportError:
    print("ERROR: google-cloud-bigquery not installed.")
    print("Install it with: pip install google-cloud-bigquery")
    sys.exit(1)


def get_bigquery_client():
    """Initialize BigQuery client with credentials."""
    try:
        # Try to use application default credentials
        client = bigquery.Client()
        # Test connection
        client.get_dataset("_")  # This will fail but tests auth
        return client
    except Exception as e:
        print(f"ERROR: Failed to initialize BigQuery client: {e}")
        print("\nTo authenticate:")
        print("1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        print("   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json")
        print("2. Or run: gcloud auth application-default login")
        sys.exit(1)


def list_recent_jobs(client: bigquery.Client, limit: int = 100) -> List[Dict[str, Any]]:
    """List recent BigQuery jobs."""
    jobs = []
    try:
        for job in client.list_jobs(max_results=limit):
            jobs.append({
                "job_id": job.job_id,
                "state": job.state,
                "job_type": job.job_type,
                "created": job.created.isoformat() if job.created else None,
                "started": job.started.isoformat() if job.started else None,
                "ended": job.ended.isoformat() if job.ended else None,
                "error": str(job.errors[0]) if job.errors else None,
            })
    except Exception as e:
        print(f"ERROR: Failed to list jobs: {e}")
    return jobs


def count_jobs_by_state(jobs: List[Dict[str, Any]]) -> Dict[str, int]:
    """Count jobs by their state."""
    counts = {"PENDING": 0, "RUNNING": 0, "DONE": 0, "ERROR": 0, "UNKNOWN": 0}
    for job in jobs:
        state = job.get("state", "UNKNOWN")
        counts[state] = counts.get(state, 0) + 1
    return counts


def find_stuck_jobs(jobs: List[Dict[str, Any]], max_age_hours: int = 24) -> List[Dict[str, Any]]:
    """Find jobs that are stuck (pending/running for too long)."""
    stuck = []
    cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
    
    for job in jobs:
        state = job.get("state")
        created = job.get("created")
        
        if state in ("PENDING", "RUNNING") and created:
            try:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if created_dt.replace(tzinfo=None) < cutoff:
                    stuck.append(job)
            except Exception:
                pass
    
    return stuck


def cancel_job(client: bigquery.Client, job_id: str) -> bool:
    """Cancel a BigQuery job."""
    try:
        job = client.get_job(job_id)
        job.cancel()
        return True
    except Exception as e:
        print(f"ERROR: Failed to cancel job {job_id}: {e}")
        return False


def main():
    print("=" * 60)
    print("BigQuery Quota Diagnostic Tool")
    print("=" * 60)
    print()
    
    # Initialize client
    print("Connecting to BigQuery...")
    client = get_bigquery_client()
    project_id = client.project
    print(f"✓ Connected to project: {project_id}")
    print()
    
    # List recent jobs
    print("Fetching recent jobs...")
    jobs = list_recent_jobs(client, limit=200)
    print(f"✓ Found {len(jobs)} recent jobs")
    print()
    
    # Count by state
    counts = count_jobs_by_state(jobs)
    print("Job Status Summary:")
    print("-" * 40)
    for state, count in sorted(counts.items()):
        if count > 0:
            print(f"  {state:12} : {count:4}")
    print()
    
    # Check for quota issues
    pending_count = counts.get("PENDING", 0)
    running_count = counts.get("RUNNING", 0)
    total_active = pending_count + running_count
    
    print("Quota Analysis:")
    print("-" * 40)
    
    # BigQuery default quota is typically 100 concurrent jobs per project
    QUOTA_LIMIT = 100
    if total_active >= QUOTA_LIMIT:
        print(f"⚠️  CRITICAL: {total_active} active jobs (limit: {QUOTA_LIMIT})")
        print("   You've exceeded the quota limit!")
    elif total_active >= QUOTA_LIMIT * 0.8:
        print(f"⚠️  WARNING: {total_active} active jobs (limit: {QUOTA_LIMIT})")
        print("   Approaching quota limit (80% threshold)")
    else:
        print(f"✓ OK: {total_active} active jobs (limit: {QUOTA_LIMIT})")
    
    print()
    
    # Find stuck jobs
    print("Checking for stuck jobs...")
    stuck_jobs = find_stuck_jobs(jobs, max_age_hours=24)
    if stuck_jobs:
        print(f"⚠️  Found {len(stuck_jobs)} potentially stuck jobs:")
        print("-" * 40)
        for job in stuck_jobs[:10]:  # Show first 10
            print(f"  Job ID: {job['job_id']}")
            print(f"    State: {job['state']}")
            print(f"    Created: {job['created']}")
            if job.get("error"):
                print(f"    Error: {job['error']}")
            print()
    else:
        print("✓ No stuck jobs found")
    print()
    
    # Recommendations
    print("Recommendations:")
    print("-" * 40)
    
    if total_active >= QUOTA_LIMIT:
        print("1. URGENT: Cancel stuck or unnecessary jobs")
        print("2. Check for runaway processes creating too many jobs")
        print("3. Implement job queuing/throttling in your code")
        print("4. Consider requesting a quota increase from Google Cloud")
    elif pending_count > 50:
        print("1. High number of pending jobs - check for bottlenecks")
        print("2. Consider canceling old pending jobs")
        print("3. Review your job submission rate")
    else:
        print("1. Monitor job counts regularly")
        print("2. Implement proper error handling and retries")
        print("3. Clean up old completed jobs periodically")
    
    print()
    
    # Interactive mode
    if stuck_jobs and len(sys.argv) > 1 and sys.argv[1] == "--cancel-stuck":
        print("Canceling stuck jobs...")
        canceled = 0
        for job in stuck_jobs:
            if cancel_job(client, job["job_id"]):
                canceled += 1
                print(f"  ✓ Canceled: {job['job_id']}")
        print(f"\n✓ Canceled {canceled} stuck jobs")
    
    print()
    print("=" * 60)
    print("For more information:")
    print("  https://cloud.google.com/bigquery/docs/troubleshoot-quotas")
    print("=" * 60)


if __name__ == "__main__":
    main()
