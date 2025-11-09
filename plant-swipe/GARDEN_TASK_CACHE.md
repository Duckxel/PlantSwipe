# Garden Task Cache System

This system stores pre-computed task data in the database to dramatically improve performance by avoiding expensive recalculations on every request.

## Overview

The cache system consists of 4 main tables:
1. **garden_task_daily_cache** - Daily task statistics (due/completed counts)
2. **garden_task_weekly_cache** - Weekly task breakdowns by type and day
3. **garden_plant_task_counts_cache** - Task counts per plant
4. **garden_task_occurrences_today_cache** - Denormalized today's occurrences for fast access

## Setup

1. Run the migration file to create cache tables and functions:
   ```sql
   -- Run: supabase/003_garden_task_cache.sql
   ```

2. The cache is automatically refreshed via database triggers when:
   - Task occurrences are created/updated/deleted
   - Tasks are created/updated/deleted
   - Task progress is updated

3. Cache cleanup runs automatically (old entries >7 days are deleted)

## How It Works

### Automatic Cache Refresh
- Database triggers fire on data changes
- Triggers send PostgreSQL notifications
- Application can listen to notifications for real-time cache updates
- Cache refresh functions are called automatically after mutations

### Manual Cache Refresh
Call `refreshGardenTaskCache(gardenId, date)` after any mutation that affects tasks.

### Cache Usage
The application code automatically uses cached data when available:
- `getGardensTodayProgressBatchCached()` - Uses cache for garden progress
- `getGardenTodayOccurrencesCached()` - Uses cache for today's occurrences
- `getGardenWeeklyStatsCached()` - Uses cache for weekly statistics
- `getGardenPlantTaskCountsCached()` - Uses cache for plant task counts

All functions fallback to computation if cache is missing.

## Realtime Updates

The cache system maintains realtime functionality:
- Cache refresh happens in background (non-blocking)
- Realtime broadcasts still work immediately
- Cache is updated asynchronously after data changes
- UI updates optimistically, cache syncs in background

## Performance Benefits

- **Garden List**: Loads instantly using cached progress data
- **Garden Dashboard**: Loads today's tasks from cache (much faster)
- **Task Operations**: Cache refreshes in background, UI stays responsive
- **Weekly Views**: Pre-computed weekly stats load instantly

## Maintenance

- Old cache entries (>7 days) are automatically cleaned up
- Cache is refreshed automatically on data changes
- Manual refresh available via `refreshGardenTaskCache()` function
- Cleanup function: `cleanupOldGardenTaskCache()`
