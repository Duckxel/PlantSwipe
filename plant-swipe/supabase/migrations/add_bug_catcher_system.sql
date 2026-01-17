-- Bug Catcher System
-- Tables for managing bug catcher actions, responses, bug reports, and points

-- ============================================================================
-- 1. BUG ACTIONS TABLE - Tasks that bug catchers can complete
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bug_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    points_reward integer NOT NULL DEFAULT 10,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'active', 'closed')),
    release_date timestamptz,  -- When the action becomes available (for planned status)
    questions jsonb DEFAULT '[]',  -- Array of questions: [{id, title, required, type}]
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_count integer DEFAULT 0  -- Cached count of completions
);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_bug_actions_status ON public.bug_actions(status);
CREATE INDEX IF NOT EXISTS idx_bug_actions_release_date ON public.bug_actions(release_date) WHERE status = 'planned';

COMMENT ON TABLE public.bug_actions IS 'Tasks/actions that bug catchers can complete to earn points';
COMMENT ON COLUMN public.bug_actions.questions IS 'Array of question objects: [{id: string, title: string, required: boolean, type: "text"|"textarea"|"boolean"}]';

-- ============================================================================
-- 2. BUG ACTION RESPONSES TABLE - User responses to actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bug_action_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES public.bug_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers jsonb DEFAULT '{}',  -- {questionId: answer}
    points_earned integer DEFAULT 0,
    completed_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(action_id, user_id)  -- Each user can only complete an action once
);

CREATE INDEX IF NOT EXISTS idx_bug_action_responses_user ON public.bug_action_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_action_responses_action ON public.bug_action_responses(action_id);

COMMENT ON TABLE public.bug_action_responses IS 'User responses to bug catcher actions';

-- ============================================================================
-- 3. BUG REPORTS TABLE - Bugs reported by bug catchers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bug_name text NOT NULL,
    description text NOT NULL,
    steps_to_reproduce text,
    screenshots jsonb DEFAULT '[]',  -- Array of image URLs
    user_info jsonb DEFAULT '{}',  -- {username, role, server, device}
    console_logs text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'closed', 'completed')),
    points_earned integer DEFAULT 0,
    admin_notes text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON public.bug_reports(created_at DESC);

COMMENT ON TABLE public.bug_reports IS 'Bug reports submitted by bug catchers';

-- ============================================================================
-- 4. BUG POINTS HISTORY TABLE - Track point transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bug_points_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points integer NOT NULL,
    reason text NOT NULL,  -- 'action_completed', 'bug_report_accepted', 'bonus', 'adjustment'
    reference_id uuid,  -- Reference to action_response or bug_report
    reference_type text,  -- 'action' or 'bug_report'
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_points_history_user ON public.bug_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_points_history_created ON public.bug_points_history(created_at DESC);

COMMENT ON TABLE public.bug_points_history IS 'History of all point transactions for bug catchers';

-- ============================================================================
-- 5. ADD bug_points COLUMN TO PROFILES
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'bug_points'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN bug_points integer DEFAULT 0;
        COMMENT ON COLUMN public.profiles.bug_points IS 'Total bug catcher points accumulated';
    END IF;
END $$;

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Function to get bug catcher leaderboard (top 10)
CREATE OR REPLACE FUNCTION public.get_bug_catcher_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
    rank bigint,
    user_id uuid,
    display_name text,
    avatar_url text,
    bug_points integer,
    actions_completed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank,
        p.id as user_id,
        p.display_name,
        p.avatar_url,
        COALESCE(p.bug_points, 0) as bug_points,
        COUNT(DISTINCT bar.id) as actions_completed
    FROM public.profiles p
    LEFT JOIN public.bug_action_responses bar ON bar.user_id = p.id
    WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
    GROUP BY p.id, p.display_name, p.avatar_url, p.bug_points
    ORDER BY COALESCE(p.bug_points, 0) DESC, p.id
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_leaderboard(integer) TO authenticated;

-- Function to get user's bug catcher rank
CREATE OR REPLACE FUNCTION public.get_bug_catcher_rank(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT rank::integer FROM (
            SELECT 
                p.id,
                ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank
            FROM public.profiles p
            WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
        ) ranked WHERE id = _user_id),
        0
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_rank(uuid) TO authenticated;

-- Function to get available actions for a bug catcher (max 5 uncompleted)
CREATE OR REPLACE FUNCTION public.get_available_bug_actions(_user_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(
    id uuid,
    title text,
    description text,
    points_reward integer,
    questions jsonb,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ba.id,
        ba.title,
        ba.description,
        ba.points_reward,
        ba.questions,
        ba.created_at
    FROM public.bug_actions ba
    WHERE ba.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM public.bug_action_responses bar 
        WHERE bar.action_id = ba.id AND bar.user_id = _user_id
    )
    ORDER BY ba.created_at DESC
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_bug_actions(uuid, integer) TO authenticated;

-- Function to get completed actions for a user
CREATE OR REPLACE FUNCTION public.get_completed_bug_actions(_user_id uuid)
RETURNS TABLE(
    id uuid,
    action_id uuid,
    title text,
    description text,
    points_earned integer,
    answers jsonb,
    completed_at timestamptz,
    action_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        bar.id,
        bar.action_id,
        ba.title,
        ba.description,
        bar.points_earned,
        bar.answers,
        bar.completed_at,
        ba.status as action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.user_id = _user_id
    ORDER BY bar.completed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_completed_bug_actions(uuid) TO authenticated;

-- Function to submit action response
CREATE OR REPLACE FUNCTION public.submit_bug_action_response(
    _user_id uuid,
    _action_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
    v_points_reward integer;
    v_response_id uuid;
BEGIN
    -- Check if action exists and is active
    SELECT status, points_reward INTO v_action_status, v_points_reward
    FROM public.bug_actions WHERE id = _action_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 0, 'Action not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status != 'active' THEN
        RETURN QUERY SELECT false, 0, 'Action is not active'::text;
        RETURN;
    END IF;
    
    -- Check if user has bug_catcher role
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'))) THEN
        RETURN QUERY SELECT false, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Check if already completed
    IF EXISTS (SELECT 1 FROM public.bug_action_responses WHERE action_id = _action_id AND user_id = _user_id) THEN
        RETURN QUERY SELECT false, 0, 'Action already completed'::text;
        RETURN;
    END IF;
    
    -- Insert response
    INSERT INTO public.bug_action_responses (action_id, user_id, answers, points_earned)
    VALUES (_action_id, _user_id, _answers, v_points_reward)
    RETURNING id INTO v_response_id;
    
    -- Update user's bug points
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_points_reward
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_points_reward, 'action_completed', v_response_id, 'action');
    
    -- Update action completed count
    UPDATE public.bug_actions 
    SET completed_count = COALESCE(completed_count, 0) + 1
    WHERE id = _action_id;
    
    RETURN QUERY SELECT true, v_points_reward, 'Action completed successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to update an action response (if action not closed)
CREATE OR REPLACE FUNCTION public.update_bug_action_response(
    _user_id uuid,
    _response_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
BEGIN
    -- Check if response exists and belongs to user
    SELECT ba.status INTO v_action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.id = _response_id AND bar.user_id = _user_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 'Response not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status = 'closed' THEN
        RETURN QUERY SELECT false, 'Cannot update response for closed action'::text;
        RETURN;
    END IF;
    
    -- Update response
    UPDATE public.bug_action_responses 
    SET answers = _answers, updated_at = now()
    WHERE id = _response_id AND user_id = _user_id;
    
    RETURN QUERY SELECT true, 'Response updated successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to submit a bug report
CREATE OR REPLACE FUNCTION public.submit_bug_report(
    _user_id uuid,
    _bug_name text,
    _description text,
    _steps_to_reproduce text DEFAULT NULL,
    _screenshots jsonb DEFAULT '[]',
    _user_info jsonb DEFAULT '{}',
    _console_logs text DEFAULT NULL
)
RETURNS TABLE(success boolean, report_id uuid, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report_id uuid;
    v_base_points integer := 5;  -- Base points for submitting a bug report
BEGIN
    -- Check if user has bug_catcher role
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'))) THEN
        RETURN QUERY SELECT false, NULL::uuid, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Insert bug report
    INSERT INTO public.bug_reports (
        user_id, bug_name, description, steps_to_reproduce, 
        screenshots, user_info, console_logs, points_earned
    )
    VALUES (
        _user_id, _bug_name, _description, _steps_to_reproduce,
        _screenshots, _user_info, _console_logs, v_base_points
    )
    RETURNING id INTO v_report_id;
    
    -- Award base points for submission
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_base_points
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_base_points, 'bug_report_submitted', v_report_id, 'bug_report');
    
    RETURN QUERY SELECT true, v_report_id, v_base_points, 'Bug report submitted successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_report(uuid, text, text, text, jsonb, jsonb, text) TO authenticated;

-- Function for admin to complete a bug report (awards bonus points)
CREATE OR REPLACE FUNCTION public.admin_complete_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _bonus_points integer DEFAULT 15,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_current_status text;
BEGIN
    -- Get report info
    SELECT user_id, status INTO v_user_id, v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'completed',
        points_earned = COALESCE(points_earned, 0) + _bonus_points,
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    -- Award bonus points to user
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + _bonus_points
    WHERE id = v_user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (v_user_id, _bonus_points, 'bug_report_accepted', _report_id, 'bug_report');
    
    RETURN QUERY SELECT true, 'Bug report completed and bonus points awarded'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_bug_report(uuid, uuid, integer, text) TO authenticated;

-- Function for admin to close a bug report (duplicate or invalid - no bonus points)
CREATE OR REPLACE FUNCTION public.admin_close_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status text;
BEGIN
    -- Get report status
    SELECT status INTO v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_current_status IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'closed',
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    RETURN QUERY SELECT true, 'Bug report closed'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_close_bug_report(uuid, uuid, text) TO authenticated;

-- Function to get bug catcher stats for admin
CREATE OR REPLACE FUNCTION public.get_bug_catcher_stats()
RETURNS TABLE(
    total_bug_catchers bigint,
    total_actions bigint,
    active_actions bigint,
    total_responses bigint,
    pending_bug_reports bigint,
    total_points_awarded bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_bug_catchers,
        (SELECT COUNT(*) FROM public.bug_actions) as total_actions,
        (SELECT COUNT(*) FROM public.bug_actions WHERE status = 'active') as active_actions,
        (SELECT COUNT(*) FROM public.bug_action_responses) as total_responses,
        (SELECT COUNT(*) FROM public.bug_reports WHERE status = 'pending') as pending_bug_reports,
        (SELECT COALESCE(SUM(bug_points), 0) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_points_awarded;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_stats() TO authenticated;

-- Function to get user bug reports
CREATE OR REPLACE FUNCTION public.get_user_bug_reports(_user_id uuid)
RETURNS TABLE(
    id uuid,
    bug_name text,
    description text,
    status text,
    points_earned integer,
    created_at timestamptz,
    resolved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        br.id,
        br.bug_name,
        br.description,
        br.status,
        br.points_earned,
        br.created_at,
        br.resolved_at
    FROM public.bug_reports br
    WHERE br.user_id = _user_id
    ORDER BY br.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_bug_reports(uuid) TO authenticated;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.bug_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_action_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_points_history ENABLE ROW LEVEL SECURITY;

-- Bug Actions policies
CREATE POLICY "Bug catchers can view active actions" ON public.bug_actions
    FOR SELECT
    TO authenticated
    USING (status = 'active' OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

CREATE POLICY "Admins can manage all actions" ON public.bug_actions
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

-- Bug Action Responses policies
CREATE POLICY "Users can view own responses" ON public.bug_action_responses
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

CREATE POLICY "Users can insert own responses" ON public.bug_action_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own responses" ON public.bug_action_responses
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Bug Reports policies
CREATE POLICY "Users can view own reports" ON public.bug_reports
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

CREATE POLICY "Users can insert own reports" ON public.bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update reports" ON public.bug_reports
    FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

-- Bug Points History policies
CREATE POLICY "Users can view own points history" ON public.bug_points_history
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
    ));

CREATE POLICY "System can insert points history" ON public.bug_points_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);  -- Controlled by functions

-- Update comment on profiles.roles to include bug_catcher
COMMENT ON COLUMN public.profiles.roles IS 'User roles: admin, editor, pro, merchant, creator, vip, plus, bug_catcher';
