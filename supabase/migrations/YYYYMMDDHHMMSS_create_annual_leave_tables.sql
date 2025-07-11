-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. teacher_leave_balances table
CREATE TABLE IF NOT EXISTS public.teacher_leave_balances (
    teacher_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_leaves integer NOT NULL DEFAULT 14,
    used_leaves integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT teacher_leave_balances_check CHECK (used_leaves >= 0 AND total_leaves >= 0 AND used_leaves <= total_leaves)
);

COMMENT ON TABLE public.teacher_leave_balances IS 'Stores annual leave balance for each teacher.';
COMMENT ON COLUMN public.teacher_leave_balances.teacher_id IS 'Foreign key to the users table, identifying the teacher.';
COMMENT ON COLUMN public.teacher_leave_balances.total_leaves IS 'Total annual leave days allocated to the teacher per year.';
COMMENT ON COLUMN public.teacher_leave_balances.used_leaves IS 'Number of annual leave days already used by the teacher.';

-- Trigger function to update 'updated_at' on balance changes
CREATE OR REPLACE FUNCTION public.update_leave_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then recreate it to make the script idempotent
DROP TRIGGER IF EXISTS teacher_leave_balance_updated_at_trigger ON public.teacher_leave_balances;
CREATE TRIGGER teacher_leave_balance_updated_at_trigger
BEFORE UPDATE ON public.teacher_leave_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_leave_balance_timestamp();

-- 2. annual_leaves table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
        CREATE TYPE leave_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.annual_leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_date date NOT NULL,
    reason text,
    status leave_status NOT NULL DEFAULT 'Pending',
    created_at timestamptz DEFAULT now(),
    reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Admin/Head who reviewed
    decision_time timestamptz,
    reviewer_notes text,
    CONSTRAINT unique_leave_per_teacher_per_day UNIQUE (teacher_id, leave_date) -- Max 1 application per day per teacher
);

COMMENT ON TABLE public.annual_leaves IS 'Stores annual leave applications from teachers.';
COMMENT ON COLUMN public.annual_leaves.leave_date IS 'The specific date requested for leave.';
COMMENT ON COLUMN public.annual_leaves.reason IS 'Optional reason provided by the teacher for the leave.';
COMMENT ON COLUMN public.annual_leaves.status IS 'Status of the leave application: Pending, Approved, Rejected, Cancelled.';
COMMENT ON COLUMN public.annual_leaves.reviewed_by IS 'Admin/Head user who made the decision on the leave request.';
COMMENT ON COLUMN public.annual_leaves.reviewer_notes IS 'Optional notes from the reviewer regarding the decision.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_annual_leaves_teacher_id ON public.annual_leaves(teacher_id);
CREATE INDEX IF NOT EXISTS idx_annual_leaves_status ON public.annual_leaves(status);
CREATE INDEX IF NOT EXISTS idx_annual_leaves_leave_date ON public.annual_leaves(leave_date);


-- 3. RLS Policies

-- teacher_leave_balances RLS
ALTER TABLE public.teacher_leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own leave balance"
ON public.teacher_leave_balances FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);

CREATE POLICY "Head of School can manage all leave balances"
ON public.teacher_leave_balances FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'head'))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'head'));


-- annual_leaves RLS
ALTER TABLE public.annual_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own leave applications"
ON public.annual_leaves FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (
    auth.uid() = teacher_id AND
    -- Allow insert if status is Pending (default)
    (status = 'Pending' OR status = 'Cancelled') -- Teachers can cancel their pending requests
    -- For updates, teachers can only update 'reason' or 'status' to 'Cancelled' if it's currently 'Pending'
    -- More granular checks might be needed if direct updates are allowed beyond cancellation
);

CREATE POLICY "Head of School can manage all leave applications"
ON public.annual_leaves FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'head'))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'head'));


-- 4. Database Functions for processing leave requests (Security definer for controlled updates)

-- Function to approve a leave request
CREATE OR REPLACE FUNCTION public.approve_leave_request(
    leave_id_param uuid,
    reviewer_id_param uuid,
    p_reviewer_notes text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    remaining_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER -- Important for permission handling within the function
AS $$
DECLARE
    v_teacher_id uuid;
    v_leave_date date;
    v_current_status leave_status;
    v_total_leaves integer;
    v_used_leaves integer;
BEGIN
    -- Check if reviewer is Head of School
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = reviewer_id_param AND role = 'head') THEN
        RETURN QUERY SELECT false, 'Unauthorized: Only Head of School can approve leaves.', NULL::integer;
        RETURN;
    END IF;

    -- Get leave details
    SELECT teacher_id, leave_date, status INTO v_teacher_id, v_leave_date, v_current_status
    FROM public.annual_leaves WHERE id = leave_id_param;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Leave request not found.', NULL::integer;
        RETURN;
    END IF;

    IF v_current_status <> 'Pending' THEN
        RETURN QUERY SELECT false, 'Leave request is not in Pending state. Current state: ' || v_current_status, NULL::integer;
        RETURN;
    END IF;

    -- Check teacher's leave balance
    SELECT total_leaves, used_leaves INTO v_total_leaves, v_used_leaves
    FROM public.teacher_leave_balances WHERE teacher_id = v_teacher_id;

    IF NOT FOUND THEN
        -- Attempt to create a balance entry if not found (e.g. new teacher)
        INSERT INTO public.teacher_leave_balances (teacher_id) VALUES (v_teacher_id)
        RETURNING total_leaves, used_leaves INTO v_total_leaves, v_used_leaves;
        -- If this fails (e.g. FK constraint if teacher_id is bad), it will error out, which is fine.
    END IF;

    IF v_used_leaves >= v_total_leaves THEN
        -- Update status to Rejected if no balance, even if trying to approve
        UPDATE public.annual_leaves
        SET status = 'Rejected',
            reviewed_by = reviewer_id_param,
            decision_time = now(),
            reviewer_notes = COALESCE(p_reviewer_notes, 'Rejected due to insufficient leave balance during approval attempt.')
        WHERE id = leave_id_param;
        RETURN QUERY SELECT false, 'Cannot approve: Teacher has no remaining leave balance. Request auto-rejected.', 0;
        RETURN;
    END IF;

    -- Proceed with approval
    UPDATE public.annual_leaves
    SET status = 'Approved',
        reviewed_by = reviewer_id_param,
        decision_time = now(),
        reviewer_notes = p_reviewer_notes
    WHERE id = leave_id_param;

    UPDATE public.teacher_leave_balances
    SET used_leaves = used_leaves + 1
    WHERE teacher_id = v_teacher_id;

    RETURN QUERY SELECT true, 'Leave request approved successfully.', (v_total_leaves - (v_used_leaves + 1));
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in approve_leave_request: %', SQLERRM;
        RETURN QUERY SELECT false, 'An internal error occurred: ' || SQLERRM, NULL::integer;
END;
$$;

-- Function to reject a leave request
CREATE OR REPLACE FUNCTION public.reject_leave_request(
    leave_id_param uuid,
    reviewer_id_param uuid,
    p_reviewer_notes text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status leave_status;
BEGIN
    -- Check if reviewer is Head of School
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = reviewer_id_param AND role = 'head') THEN
        RETURN QUERY SELECT false, 'Unauthorized: Only Head of School can reject leaves.';
        RETURN;
    END IF;

    SELECT status INTO v_current_status FROM public.annual_leaves WHERE id = leave_id_param;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Leave request not found.';
        RETURN;
    END IF;

    IF v_current_status <> 'Pending' THEN
        RETURN QUERY SELECT false, 'Leave request is not in Pending state. Current state: ' || v_current_status;
        RETURN;
    END IF;

    UPDATE public.annual_leaves
    SET status = 'Rejected',
        reviewed_by = reviewer_id_param,
        decision_time = now(),
        reviewer_notes = p_reviewer_notes
    WHERE id = leave_id_param;

    RETURN QUERY SELECT true, 'Leave request rejected successfully.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in reject_leave_request: %', SQLERRM;
        RETURN QUERY SELECT false, 'An internal error occurred: ' || SQLERRM;
END;
$$;

-- Function to cancel a leave request (by teacher)
CREATE OR REPLACE FUNCTION public.cancel_leave_request_by_teacher(
    leave_id_param uuid,
    requesting_teacher_id uuid
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Or SECURITY INVOKER if RLS policies are sufficient and preferred for this path
AS $$
DECLARE
    v_current_status leave_status;
    v_leave_teacher_id uuid;
BEGIN
    SELECT teacher_id, status INTO v_leave_teacher_id, v_current_status
    FROM public.annual_leaves WHERE id = leave_id_param;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Leave request not found.';
        RETURN;
    END IF;

    IF v_leave_teacher_id <> requesting_teacher_id THEN
        RETURN QUERY SELECT false, 'Unauthorized: You can only cancel your own leave requests.';
        RETURN;
    END IF;

    IF v_current_status <> 'Pending' THEN
        RETURN QUERY SELECT false, 'Only Pending leave requests can be cancelled. Current state: ' || v_current_status;
        RETURN;
    END IF;

    UPDATE public.annual_leaves
    SET status = 'Cancelled'
    -- reviewed_by and decision_time might not be relevant for cancellation by teacher, or set them if needed
    -- decision_time = now()
    WHERE id = leave_id_param;

    RETURN QUERY SELECT true, 'Leave request cancelled successfully.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in cancel_leave_request_by_teacher: %', SQLERRM;
        RETURN QUERY SELECT false, 'An internal error occurred: ' || SQLERRM;
END;
$$;


-- Grant execute on functions to authenticated users.
-- The functions themselves check roles internally where necessary (e.g. 'head' for approve/reject).
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request_by_teacher(uuid, uuid) TO authenticated;

-- Enable real-time for annual_leaves for teachers to get updates on status
ALTER PUBLICATION supabase_realtime ADD TABLE public.annual_leaves;
ALTER TABLE public.annual_leaves REPLICA IDENTITY FULL;

-- Enable real-time for teacher_leave_balances for teachers to get updates on balance
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_leave_balances;
ALTER TABLE public.teacher_leave_balances REPLICA IDENTITY FULL;

-- Note: Default total_leaves for new teachers
-- When a new teacher is added to the `users` table, their entry in `teacher_leave_balances`
-- needs to be created. This can be done via a trigger on `users` table insert,
-- or by ensuring the application logic creates this balance entry when a teacher user is created.
-- For simplicity, the `approve_leave_request` function includes a check to insert a balance if not found.
-- A more robust solution would be a trigger on the users table:
/*
CREATE OR REPLACE FUNCTION public.create_teacher_leave_balance_entry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'teacher' THEN
        INSERT INTO public.teacher_leave_balances (teacher_id, total_leaves, used_leaves)
        VALUES (NEW.id, 14, 0) -- Default 14 leaves
        ON CONFLICT (teacher_id) DO NOTHING; -- In case it somehow already exists
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_teacher_create_leave_balance
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.create_teacher_leave_balance_entry();
*/
-- The above trigger is commented out as it's an addition to the `users` table which is existing.
-- It's provided as a suggestion for a more robust way to handle new teacher balances.
-- The current solution within `approve_leave_request` to insert if not found is a fallback.
