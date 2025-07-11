import { supabase } from './supabase'; // Adjust path as necessary
import { getCurrentStaffUser } from './auth'; // To get current user ID for reviews

export interface LeaveBalance {
  total_leaves: number;
  used_leaves: number;
  remaining_leaves: number;
}

export interface AnnualLeaveApplication {
  id: string;
  teacher_id: string;
  users?: { name: string }; // For joining teacher name
  leave_date: string; // YYYY-MM-DD
  leave_type: string; // Added: e.g., 'Annual', 'Sick'
  reason?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  created_at: string;
  reviewed_by?: string | null;
  users_reviewed_by?: { name: string }; // For joining reviewer name
  decision_time?: string | null;
  reviewer_notes?: string | null;
}

const DEFAULT_TOTAL_LEAVES = 14; // Default if no balance record exists

/**
 * Fetches the leave balance for a specific teacher.
 * If no balance record exists, it attempts to create one with default values.
 */
export const getLeaveBalance = async (teacherId: string): Promise<LeaveBalance> => {
  let { data, error } = await supabase
    .from('teacher_leave_balances')
    .select('total_leaves, used_leaves')
    .eq('teacher_id', teacherId)
    .single();

  if (error && error.code === 'PGRST116') { // PGRST116: "Searched item was not found"
    // No balance record found, try to create one with defaults
    console.warn(`No leave balance found for teacher ${teacherId}. Attempting to create with defaults.`);
    const { data: newData, error: insertError } = await supabase
      .from('teacher_leave_balances')
      .insert({ teacher_id: teacherId, total_leaves: DEFAULT_TOTAL_LEAVES, used_leaves: 0 })
      .select('total_leaves, used_leaves')
      .single();

    if (insertError) {
      console.error('Error creating default leave balance:', insertError);
      // Return default zero balance if creation also fails
      return { total_leaves: DEFAULT_TOTAL_LEAVES, used_leaves: 0, remaining_leaves: DEFAULT_TOTAL_LEAVES };
    }
    data = newData;
  } else if (error) {
    console.error('Error fetching leave balance:', error);
    throw error; // Re-throw other errors
  }

  if (!data) { // Should be covered by PGRST116 or insert, but as a fallback
    return { total_leaves: DEFAULT_TOTAL_LEAVES, used_leaves: 0, remaining_leaves: DEFAULT_TOTAL_LEAVES };
  }

  const total = data.total_leaves || 0;
  const used = data.used_leaves || 0;
  return {
    total_leaves: total,
    used_leaves: used,
    remaining_leaves: total - used,
  };
};

/**
 * Fetches all leave applications for a specific teacher.
 */
export const getTeacherLeaveApplications = async (teacherId: string): Promise<AnnualLeaveApplication[]> => {
  const { data, error } = await supabase
    .from('annual_leaves')
    .select(`
      id,
      teacher_id,
      leave_date,
      leave_type,
      reason,
      status,
      created_at,
      reviewed_by,
      users_reviewed_by:users!annual_leaves_reviewed_by_fkey ( name ),
      decision_time,
      reviewer_notes
    `)
    .eq('teacher_id', teacherId)
    .order('leave_date', { ascending: false });

  if (error) {
    console.error('Error fetching teacher leave applications:', error);
    throw error;
  }
  return data as AnnualLeaveApplication[];
};

/**
 * Submits a new leave application for a teacher.
 * Performs server-side (Supabase function or direct check) validations.
 */
export const submitLeaveApplication = async (
  teacherId: string,
  leaveDate: string, // Expected YYYY-MM-DD
  reason?: string,
  leaveType: string = 'Annual' // Added leaveType parameter
): Promise<AnnualLeaveApplication> => {
  // 1. Client-side pre-validation (can be duplicated here or rely on UI)
  // Ensure leaveDate is for tomorrow or later
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day
  const selectedDate = new Date(leaveDate);
  selectedDate.setHours(0,0,0,0); // Normalize selectedDate to start of day

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (selectedDate < tomorrow) {
    throw new Error('Leave date must be in the future.');
  }

  // 2. Check remaining balance
  const balance = await getLeaveBalance(teacherId);
  if (balance.remaining_leaves <= 0) {
    throw new Error('You have no remaining leave days.');
  }

  // 3. Check for duplicate application for the same date (Supabase constraint will also catch this)
  const { data: existingApplications, error: existingError } = await supabase
    .from('annual_leaves')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('leave_date', leaveDate)
    .in('status', ['Pending', 'Approved']); // Check against pending or already approved for that date

  if (existingError) {
    console.error('Error checking existing applications:', existingError);
    throw new Error('Failed to verify existing applications. Please try again.');
  }
  if (existingApplications && existingApplications.length > 0) {
    throw new Error(`You already have a 'Pending' or 'Approved' leave application for ${leaveDate}.`);
  }

  // 4. Insert new leave application
  const { data, error } = await supabase
    .from('annual_leaves')
    .insert({
      teacher_id: teacherId,
      leave_date: leaveDate,
      leave_type: leaveType, // Use the provided or default leaveType
      reason: reason || null,
      status: 'Pending',
    })
    .select(`
      id,
      teacher_id,
      leave_date,
      leave_type,
      reason,
      status,
      created_at,
      reviewed_by,
      users_reviewed_by:users!annual_leaves_reviewed_by_fkey ( name ),
      decision_time,
      reviewer_notes
    `)
    .single();

  if (error) {
    console.error('Error submitting leave application:', error);
    if (error.code === '23505') { // Unique violation (e.g. teacher_id, leave_date)
        throw new Error(`A leave application for this date (${leaveDate}) already exists.`);
    }
    throw error;
  }
  if (!data) throw new Error('Failed to submit leave application, no data returned.');

  return data as AnnualLeaveApplication;
};

/**
 * Fetches all pending leave applications for admin/head view.
 */
export const getPendingLeaveApplicationsForAdmin = async (): Promise<AnnualLeaveApplication[]> => {
  const { data, error } = await supabase
    .from('annual_leaves')
    .select(`
      id,
      teacher_id,
      users ( id, name, email ),
      leave_date,
      leave_type,
      reason,
      status,
      created_at,
      reviewer_notes,
      reviewed_by,
      users_reviewed_by:users!annual_leaves_reviewed_by_fkey ( name ),
      decision_time
    `)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending leave applications:', error);
    throw error;
  }
  return data as AnnualLeaveApplication[];
};

/**
 * Processes a leave application (approve or reject) by calling Supabase DB functions.
 */
export const processLeaveApplicationByAdmin = async (
  leaveId: string,
  action: 'approve' | 'reject',
  reviewerNotes?: string
): Promise<{ success: boolean; message: string; remaining_balance?: number }> => {
  const currentUser = getCurrentStaffUser(); // RLS in DB function might rely on auth.uid()
  if (!currentUser || !currentUser.id) {
    throw new Error('User not authenticated or ID missing.');
  }

  const functionName = action === 'approve' ? 'approve_leave_request' : 'reject_leave_request';
  const params = action === 'approve'
    ? { leave_id_param: leaveId, reviewer_id_param: currentUser.id, p_reviewer_notes: reviewerNotes }
    : { leave_id_param: leaveId, reviewer_id_param: currentUser.id, p_reviewer_notes: reviewerNotes };

  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw new Error(`Failed to ${action} leave request: ${error.message}`);
  }

  // The RPC function returns an array with a single object [{ success, message, remaining_balance }]
  if (data && Array.isArray(data) && data.length > 0) {
    return data[0] as { success: boolean; message: string; remaining_balance?: number };
  } else if (data) { // If it somehow returns a single object not in an array
    return data as { success: boolean; message: string; remaining_balance?: number };
  }

  console.error('Unexpected response format from RPC function:', data);
  throw new Error('Unexpected response from server while processing leave request.');
};


/**
 * Allows a teacher to cancel their own PENDING leave application.
 */
export const cancelLeaveApplicationByTeacher = async (
  leaveId: string
): Promise<{ success: boolean; message: string }> => {
  const currentUser = getCurrentStaffUser();
  if (!currentUser || !currentUser.id) {
    throw new Error('User not authenticated or ID missing.');
  }

  const { data, error } = await supabase.rpc('cancel_leave_request_by_teacher', {
    leave_id_param: leaveId,
    requesting_teacher_id: currentUser.id
  });

  if (error) {
    console.error('Error calling cancel_leave_request_by_teacher:', error);
    throw new Error(`Failed to cancel leave request: ${error.message}`);
  }

  if (data && Array.isArray(data) && data.length > 0) {
    return data[0] as { success: boolean; message: string };
  } else if (data) {
    return data as { success: boolean; message: string };
  }

  console.error('Unexpected response format from RPC function (cancel_leave_request_by_teacher):', data);
  throw new Error('Unexpected response from server while cancelling leave request.');
};

/**
 * For Head of School to set/update total_leaves for a teacher.
 */
export const setTeacherTotalLeaves = async (teacherId: string, newTotalLeaves: number): Promise<void> => {
    if (newTotalLeaves < 0) throw new Error("Total leaves cannot be negative.");
    const { error } = await supabase
        .from('teacher_leave_balances')
        .upsert(
            { teacher_id: teacherId, total_leaves: newTotalLeaves },
            { onConflict: 'teacher_id' }
        );

    if (error) {
        console.error('Error setting total leaves:', error);
        throw new Error(`Failed to set total leaves for teacher ${teacherId}: ${error.message}`);
    }
};

/**
 * Fetches all leave applications for admin/head view with filtering and sorting.
 */
export interface LeaveApplicationFilters {
  teacherId?: string;
  status?: string;
  leaveType?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}
export interface LeaveApplicationSort {
  column: string; // e.g., 'leave_date', 'created_at', 'users.name', 'status'
  ascending: boolean;
}

export const getAllLeaveApplicationsForAdmin = async (
  filters?: LeaveApplicationFilters,
  sort?: LeaveApplicationSort,
  page: number = 1,
  pageSize: number = 20
): Promise<{ applications: AnnualLeaveApplication[], count: number | null }> => {
  let query = supabase
    .from('annual_leaves')
    .select(`
      id,
      teacher_id,
      users ( id, name, email ),
      leave_date,
      leave_type,
      reason,
      status,
      created_at,
      reviewed_by,
      users_reviewed_by:users!annual_leaves_reviewed_by_fkey ( name ),
      decision_time,
      reviewer_notes
    `, { count: 'exact' }); // Add count for pagination

  // Apply filters
  if (filters) {
    if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);
    if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
    if (filters.leaveType && filters.leaveType !== 'All') query = query.eq('leave_type', filters.leaveType);
    if (filters.dateFrom) query = query.gte('leave_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('leave_date', filters.dateTo);
  }

  // Apply sorting
  if (sort) {
    // For sorting by joined table column 'users.name', Supabase syntax is 'foreign_table(column)'
    // e.g. users(name)
    // However, direct sorting on joined columns via PostgREST can be tricky or might require views/functions.
    // For simplicity, if sorting by 'users.name', we might need to fetch all and sort client-side,
    // or ensure the column name for sorting is directly from 'annual_leaves'.
    // Let's assume basic column sorting for now. If 'users.name' is passed, it might not work as expected without specific setup.
    // A common pattern is to sort by `teacher_id` and then map names on client, or denormalize teacher_name.
    // For now, we'll pass it through and see if Supabase handles it with the join syntax.
    // Supabase might require `foreignTable.column` for joined sort. Let's try that.
    let sortColumn = sort.column;
    if (sort.column === 'users.name') { // Adjust if Supabase needs specific syntax for joined sort
        sortColumn = 'users(name)'; // This might not work directly for order().
                                     // Often, you sort by teacher_id and handle name display.
                                     // Or, a DB view is better for complex sorts.
                                     // For now, let's be simple and sort by primary table columns.
                                     // If users.name is requested, we'll sort by teacher_id instead as a proxy.
        // sortColumn = 'teacher_id'; // Safer proxy sort
        // Or allow direct attempt:
        // No change needed if Supabase JS client handles `users(name)` in order()
    }
     query = query.order(sortColumn, { ascending: sort.ascending });
  } else {
    query = query.order('created_at', { ascending: false }); // Default sort
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching all leave applications for admin:', error);
    throw error;
  }
  return { applications: data as AnnualLeaveApplication[], count };
};
