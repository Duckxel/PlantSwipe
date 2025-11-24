# BigQuery Quota Exceeded - Diagnostic & Fix Guide

## Understanding the Error

The error you're seeing indicates that your Google Cloud project has exceeded the quota for the maximum number of jobs that can be queued per project. BigQuery has a default limit of **100 concurrent jobs** per project.

```
Quota exceeded: Your project_and_region exceeded quota for max number of jobs 
that can be queued per project.
```

## Quick Diagnosis

### 1. Check Current Job Status

Run the diagnostic script:

```bash
# Install required package
pip install google-cloud-bigquery

# Authenticate (if not already done)
gcloud auth application-default login

# Run diagnostic
python3 scripts/check-bigquery-quota.py
```

### 2. Check via Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **BigQuery** → **Jobs**
3. Filter by status: **Pending** and **Running**
4. Count the active jobs

### 3. Check via gcloud CLI

```bash
# List all jobs
gcloud alpha bq jobs list --limit=100

# Count pending jobs
gcloud alpha bq jobs list --filter="state=PENDING" --format="value(jobId)" | wc -l

# Count running jobs
gcloud alpha bq jobs list --filter="state=RUNNING" --format="value(jobId)" | wc -l
```

## Common Causes

### 1. **Runaway Processes**
- A script or application creating jobs faster than they complete
- Missing error handling causing retry loops
- Scheduled jobs overlapping

### 2. **Stuck Jobs**
- Jobs that are pending/running indefinitely
- Network issues preventing job completion
- Resource constraints

### 3. **High Concurrency**
- Multiple services/applications submitting jobs simultaneously
- Batch processing without rate limiting
- Missing job queuing mechanism

## Solutions

### Immediate Fix: Cancel Stuck Jobs

```bash
# Use the diagnostic script to cancel stuck jobs
python3 scripts/check-bigquery-quota.py --cancel-stuck

# Or manually cancel via gcloud
gcloud alpha bq jobs cancel JOB_ID --location=LOCATION

# Cancel all pending jobs older than 1 hour (example)
gcloud alpha bq jobs list --filter="state=PENDING AND creationTime<$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --format="value(jobId)" | xargs -I {} gcloud alpha bq jobs cancel {} --location=US
```

### Code-Level Fixes

#### 1. Implement Job Queuing

```python
from google.cloud import bigquery
import time
from queue import Queue
import threading

class BigQueryJobQueue:
    def __init__(self, max_concurrent=50):
        self.client = bigquery.Client()
        self.max_concurrent = max_concurrent
        self.active_jobs = Queue(maxsize=max_concurrent)
        self.lock = threading.Lock()
    
    def submit_job(self, query, wait=True):
        """Submit a job, waiting if queue is full."""
        # Wait for slot
        while self.active_jobs.full():
            self._cleanup_completed_jobs()
            time.sleep(1)
        
        # Submit job
        job = self.client.query(query)
        self.active_jobs.put(job.job_id)
        
        if wait:
            job.result()  # Wait for completion
            self.active_jobs.get()
        
        return job
    
    def _cleanup_completed_jobs(self):
        """Remove completed jobs from queue."""
        with self.lock:
            temp_queue = Queue()
            while not self.active_jobs.empty():
                job_id = self.active_jobs.get()
                job = self.client.get_job(job_id)
                if job.state not in ('DONE', 'ERROR'):
                    temp_queue.put(job_id)
            self.active_jobs = temp_queue
```

#### 2. Add Retry Logic with Exponential Backoff

```python
from google.api_core import retry
import time

def submit_with_retry(client, query, max_retries=3):
    """Submit query with retry logic."""
    for attempt in range(max_retries):
        try:
            job = client.query(query)
            return job.result()  # Wait for completion
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait_time = 2 ** attempt  # Exponential backoff
            print(f"Retry {attempt + 1}/{max_retries} after {wait_time}s")
            time.sleep(wait_time)
```

#### 3. Check Job Status Before Submitting

```python
def can_submit_job(client, max_pending=80):
    """Check if we can submit a new job."""
    pending_count = sum(
        1 for job in client.list_jobs(max_results=100)
        if job.state == 'PENDING'
    )
    return pending_count < max_pending

# Usage
if can_submit_job(client):
    job = client.query(query)
else:
    print("Too many pending jobs, waiting...")
    time.sleep(10)
```

### Request Quota Increase

If you legitimately need more concurrent jobs:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Quotas**
3. Search for "BigQuery API: Concurrent jobs per project"
4. Click **Edit Quotas**
5. Request increase with justification

## Prevention Best Practices

1. **Monitor Job Counts**
   - Set up alerts for high job counts
   - Monitor via Cloud Monitoring

2. **Implement Rate Limiting**
   - Limit concurrent job submissions
   - Use job queues for batch processing

3. **Clean Up Old Jobs**
   - Periodically cancel stuck jobs
   - Archive completed job metadata

4. **Error Handling**
   - Proper retry logic with backoff
   - Handle quota errors gracefully
   - Log job failures

5. **Use Job Configuration**
   - Set appropriate priority levels
   - Use dry runs for testing
   - Configure job timeouts

## Finding Where BigQuery is Used

Since your codebase uses PostgreSQL/Supabase, BigQuery might be used in:

1. **External Services**
   - Analytics pipelines
   - Data warehouse exports
   - Scheduled reports

2. **Supabase Features**
   - Some Supabase features might use BigQuery
   - Check Supabase dashboard for integrations

3. **CI/CD Pipelines**
   - Check GitHub Actions or other CI workflows
   - Look for `gcloud` or `bq` commands

4. **Monitoring/Logging**
   - Cloud Logging exports
   - Monitoring data exports

## Next Steps

1. ✅ Run the diagnostic script to identify the issue
2. ✅ Cancel stuck/unnecessary jobs
3. ✅ Review your code for job submission patterns
4. ✅ Implement rate limiting if needed
5. ✅ Set up monitoring/alerts
6. ✅ Consider requesting quota increase if legitimate

## Additional Resources

- [BigQuery Quotas Documentation](https://cloud.google.com/bigquery/docs/troubleshoot-quotas)
- [BigQuery Job API](https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs)
- [Managing BigQuery Jobs](https://cloud.google.com/bigquery/docs/managing-jobs)
