
create table if not exists public.admin_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.admin_email_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  sent_at timestamptz default now(),
  status text default 'sent',
  error text
);

create index if not exists idx_admin_campaign_sends_campaign_user 
  on public.admin_campaign_sends(campaign_id, user_id);

-- Function to check if a user is eligible for a timezone-aware campaign
-- Returns true if now() >= scheduled_time adjusted for user timezone
create or replace function public.is_campaign_due_for_user(
  _scheduled_for timestamptz,
  _campaign_tz text,
  _user_tz text
) returns boolean language plpgsql as $$
declare
  _target_time timestamptz;
  _user_offset interval;
  _campaign_offset interval;
begin
  -- Default timezones if null
  _campaign_tz := coalesce(_campaign_tz, 'UTC');
  _user_tz := coalesce(_user_tz, 'UTC');
  
  -- Calculate offsets
  -- We want to find the moment when User's Wall Clock Time == Campaign Scheduled Wall Clock Time
  -- Effective Time = Scheduled_UTC - Camp_Offset + User_Offset
  -- Example: Sched=09:00Z (Camp=UTC). User=JST (+09). 
  -- Target = 09:00 - 0 + 9 = 18:00Z ? No.
  -- 
  -- Let's think in Wall Clock.
  -- Admin says: "9:00 AM" (in Campaign TZ).
  -- User wants to receive at "9:00 AM" (in User TZ).
  -- 
  -- 9 AM JST happens at 00:00 UTC.
  -- 9 AM UTC happens at 09:00 UTC.
  -- So JST user receives it 9 hours *earlier* than UTC user.
  -- 
  -- Formula: Target_UTC = Scheduled_UTC - (User_Offset - Camp_Offset)
  -- Check: Sched=09:00Z (Camp=UTC). User=JST(+9).
  -- Target = 09 - (9 - 0) = 00:00Z. Correct.
  -- 
  -- Check: Sched=09:00Z (Camp=UTC). User=EST(-5).
  -- Target = 09 - (-5 - 0) = 14:00Z. Correct.

  -- Get offsets from pg_timezone_names or by projecting now()
  -- Using simpler SQL approach:
  
  return now() >= (
    _scheduled_for - (
      (now() at time zone _user_tz at time zone 'UTC') - (now() at time zone 'UTC')
    ) + (
      (now() at time zone _campaign_tz at time zone 'UTC') - (now() at time zone 'UTC')
    )
  );
exception when others then
  -- Fallback to immediate send if timezone math fails (invalid TZ strings)
  return true;
end;
$$;
