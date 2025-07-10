import React from 'react'
import { Layout } from '../components/Layout'
import { AIButton } from '../components/AIButton'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { getCurrentStaffUser } from '../lib/auth'
import { Calendar, Clock, Users, BookOpen, Plus, Edit, Trash2, RotateCcw } from 'lucide-react'
import { callOpenRouterAPI, getSystemPromptByRole } from '../lib/aiHelpers'
import { AIAssistant } from '../components/AIAssistant'

export function AdminDashboard() {
  // Move these constants to the very top to avoid ReferenceError
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const levels = ['Pre-K', 'K1', 'K2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']
  const subjects = ['English', 'Mathematics', 'Science', 'Social Studies', 'Art', 'Music', 'Physical Education']

  const { showToast } = useToast()
  const user = getCurrentStaffUser()
  const [schedules, setSchedules] = React.useState<any[]>([])
  const [teachers, setTeachers] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [editingSchedule, setEditingSchedule] = React.useState<any>(null)
  const [formData, setFormData] = React.useState({
    day: '',
    time: '',
    level: '',
    subject: '',
    teacher_id: ''
  })

  // AI Scheduler state
  const [aiSchedulerMode, setAiSchedulerMode] = React.useState(false)
  const [aiScheduleMatrix, setAiScheduleMatrix] = React.useState<ScheduleMatrix>(() => {
    // Build initial matrix: { [level]: { [day]: { subject: '', teacher_id: '', time: '' } } }
    const matrix: ScheduleMatrix = {};
    levels.forEach(level => {
      matrix[level] = {};
      days.forEach(day => {
        matrix[level][day] = { subject: '', teacher_id: '', time: '' };
      });
    });
    return matrix;
  })
  // State for AI Scheduler Chatbot
  const [showAISchedulerChat, setShowAISchedulerChat] = React.useState(false)

  // State for planned AI schedule commands
  const [aiPlannedCommands, setAiPlannedCommands] = React.useState<any[]>([])
  const [showAICommandReview, setShowAICommandReview] = React.useState(false)

  React.useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // First, load schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .order('day')
        .order('time')

      if (scheduleError) throw scheduleError

      // Then, load teachers separately
      const { data: teacherData, error: teacherError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'teacher')
        .order('name')

      if (teacherError) throw teacherError
      setTeachers(teacherData || [])

      // Merge schedule data with teacher names client-side
      const schedulesWithTeachers = (scheduleData || []).map(schedule => ({
        ...schedule,
        users: {
          name: teacherData?.find(teacher => teacher.id === schedule.teacher_id)?.name || 'Unknown Teacher'
        }
      }))

      setSchedules(schedulesWithTeachers)
    } catch (error) {
      console.error('Error loading data:', error)
      showToast('Please contact creator - Shan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Clean and log formData before submit
    const cleanedFormData = {
      day: formData.day.trim(),
      time: formData.time.trim(),
      level: formData.level.trim(),
      subject: formData.subject.trim(),
      teacher_id: formData.teacher_id.trim()
    }
    console.log('Submitting schedule:', cleanedFormData)
    try {
      if (editingSchedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('schedules')
          .update(cleanedFormData)
          .eq('id', editingSchedule.id)

        if (error) {
          console.error('Schedule update error:', error)
          throw new Error('Please contact creator - Shan')
        }
        showToast('Schedule updated successfully', 'success')
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('schedules')
          .insert(cleanedFormData)

        if (error) {
          console.error('Schedule insert error:', error)
          throw new Error('Please contact creator - Shan')
        }
        showToast('Schedule created successfully', 'success')
      }

      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    }
  }

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule)
    setFormData({
      day: schedule.day,
      time: schedule.time,
      level: schedule.level,
      subject: schedule.subject,
      teacher_id: schedule.teacher_id
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Schedule delete error:', error)
        throw new Error('Please contact creator - Shan')
      }
      showToast('Schedule deleted successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    }
  }

  const handleResetWeeklyData = async () => {
    if (!confirm('Are you sure you want to reset all weekly data? This will delete all schedules and attendance logs.')) {
      return
    }

    try {
      // Delete attendance logs
      const { error: attendanceError } = await supabase
        .from('attendance_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (attendanceError) {
        console.error('Attendance delete error:', attendanceError)
        throw new Error('Please contact creator - Shan')
      }

      // Delete schedules
      const { error: scheduleError } = await supabase
        .from('schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (scheduleError) {
        console.error('Schedule delete error:', scheduleError)
        throw new Error('Please contact creator - Shan')
      }

      showToast('Weekly data reset successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Error resetting data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      day: '',
      time: '',
      level: '',
      subject: '',
      teacher_id: ''
    })
    setEditingSchedule(null)
    setShowForm(false)
  }

  // Submit all changes in matrix to Supabase
  const handleAISubmit = async () => {
    setLoading(true);
    try {
      // Flatten matrix to array of schedule objects
      const updates: any[] = [];
      levels.forEach(level => {
        days.forEach(day => {
          const cell = aiScheduleMatrix[level][day];
          if (cell.subject && cell.teacher_id && cell.time) {
            updates.push({
              day,
              time: cell.time,
              level,
              subject: cell.subject,
              teacher_id: cell.teacher_id
            });
          }
        });
      });
      // Upsert all at once (onConflict expects comma-separated string)
      const { error } = await supabase.from('schedules').upsert(updates, { onConflict: 'day,time,level' });
      if (error) throw error;
      showToast('AI schedule submitted!', 'success');
      setAiSchedulerMode(false);
      loadData();
    } catch (error) {
      showToast('Failed to submit schedule', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handler to process AI response from chatbot and extract commands (handles code block wrapping)
  const handleAICommandResponse = (response: string) => {
    let jsonStr = response.trim()
    // Remove code block wrappers if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    try {
      const commands = JSON.parse(jsonStr)
      if (Array.isArray(commands) && commands.every(cmd => cmd.command)) {
        setAiPlannedCommands(commands)
        setShowAICommandReview(true)
        showToast('AI has proposed schedule changes for your review.', 'info')
      } else {
        showToast('AI response did not contain valid commands.', 'error')
      }
    } catch (e) {
      showToast('Failed to parse AI commands. Please try again.', 'error')
    }
  }

  // Custom function to apply AI commands after confirmation
  const applyAICommands = async (commands: any[]) => {
    setLoading(true)
    let successCount = 0
    let failCount = 0
    for (const cmd of commands) {
      try {
        if (cmd.command === 'AddSchedule') {
          const { error } = await supabase.from('schedules').insert({
            day: cmd.day,
            time: cmd.time,
            level: cmd.level,
            subject: cmd.subject,
            teacher_id: cmd.teacher_id
          })
          if (error) throw error
          showToast(`AddSchedule for ${cmd.level} ${cmd.day} succeeded.`, 'success')
          successCount++
        } else if (cmd.command === 'UpdateSchedule') {
          const updateFields = { ...cmd }
          delete updateFields.command
          const { id, ...fields } = updateFields
          const { error } = await supabase.from('schedules').update(fields).eq('id', id)
          if (error) throw error
          showToast(`UpdateSchedule for ID ${id} succeeded.`, 'success')
          successCount++
        } else if (cmd.command === 'DeleteSchedule') {
          const { error } = await supabase.from('schedules').delete().eq('id', cmd.id)
          if (error) throw error
          showToast(`DeleteSchedule for ID ${cmd.id} succeeded.`, 'success')
          successCount++
        } else {
          showToast(`Unknown command type: ${cmd.command}`, 'error')
          failCount++
        }
      } catch (e) {
        showToast(`Command failed: ${cmd.command}${cmd.id ? ' (ID: ' + cmd.id + ')' : ''}`, 'error')
        failCount++
      }
    }
    setShowAICommandReview(false)
    setAiPlannedCommands([])
    setLoading(false)
    loadData()
  }

  // Helper to get teacher names for AI context
  const getTeacherNames = () => teachers.map(t => t.name)

  // Handler to process AI response as a single schedule object and send to form
  const handleAISingleScheduleResponse = (response: string) => {
    let jsonStr = response.trim()
    // Remove code block wrappers if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    try {
      const schedule = JSON.parse(jsonStr)
      // Validate required fields
      if (
        schedule &&
        typeof schedule === 'object' &&
        schedule.day &&
        schedule.time &&
        schedule.level &&
        schedule.subject &&
        schedule.teacher_id
      ) {
        // Find teacher by exact or partial name match
        const teacherList = teachers
        let teacher = teacherList.find(t => t.id === schedule.teacher_id)
        if (!teacher) {
          // Try to match by name (case-insensitive, partial)
          teacher = teacherList.find(t =>
            schedule.teacher_id &&
            t.name.toLowerCase().includes(schedule.teacher_id.toLowerCase())
          )
          if (teacher) {
            schedule.teacher_id = teacher.id
          } else {
            // Try to match by partial name from AI's teacher_name field if present
            if (schedule.teacher_name) {
              teacher = teacherList.find(t =>
                t.name.toLowerCase().includes(schedule.teacher_name.toLowerCase())
              )
              if (teacher) {
                schedule.teacher_id = teacher.id
              }
            }
          }
        }
        // If still not found, show error
        if (!teacher) {
          showToast('AI selected an invalid teacher. Please choose a real teacher.', 'error')
          return
        }
        // Only set teacher_id to a valid id
        schedule.teacher_id = teacher.id
        setFormData(schedule)
        setShowForm(true)
        // --- Immediately submit the form as if admin entered it manually ---
        // Create a fake event to call handleSubmit
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent
        handleSubmit(fakeEvent)
        // ---
        showToast('AI has filled and submitted the schedule form.', 'info')
      } else {
        showToast('AI response did not contain a valid schedule object.', 'error')
      }
    } catch (e) {
      showToast('Failed to parse AI schedule. Please try again.', 'error')
    }
  }

  // Add fallback UI for unauthenticated users
  if (!user) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-xl font-semibold mb-2">You are not logged in</h2>
          <p className="mb-4">Please log in to access the Admin Dashboard.</p>
          <a href="/StaffLogin" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Go to Login</a>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-emerald-50 rounded-lg p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-emerald-900 mb-2">
            Welcome, {user?.name || 'Administrator'}
          </h3>
          <p className="text-emerald-700 text-base sm:text-lg">
            Manage weekly schedules, class assignments, and academic planning for Pre-K to P6 classes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-base sm:text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </button>
            <button
              onClick={handleResetWeeklyData}
              className="flex items-center px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-base sm:text-sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Weekly Data
            </button>
          </div>
        </div>

        {/* Schedule Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData(prev => ({ ...prev, day: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="">Select Day</option>
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="">Select Level</option>
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Teacher</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-base sm:text-sm"
                >
                  {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-base sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* AI Scheduler Toggle */}
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center cursor-pointer text-base sm:text-sm">
            <input
              type="checkbox"
              checked={aiSchedulerMode}
              onChange={e => setAiSchedulerMode(e.target.checked)}
              className="form-checkbox h-5 w-5 text-emerald-600"
            />
            <span className="ml-2 font-medium text-emerald-700">🧠 Enable AI Scheduling</span>
          </label>
          {aiSchedulerMode && (
            <button
              type="button"
              className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-base sm:text-xs"
              onClick={() => setShowAISchedulerChat(true)}
            >
              Open AI Scheduler Chat
            </button>
          )}
        </div>

        {/* AI Scheduler Chatbot Modal */}
        {showAISchedulerChat && (
          <AIAssistant
            isOpen={showAISchedulerChat}
            onClose={() => setShowAISchedulerChat(false)}
            userRole="admin"
            triggerMessage={null}
            onTriggerMessageProcessed={undefined}
            onAICommandResponse={handleAICommandResponse}
            onAISingleScheduleResponse={handleAISingleScheduleResponse}
            teacherNames={getTeacherNames()} // Pass teacher names for AI context
          />
        )}

        {/* AI Command Review Modal */}
        {showAICommandReview && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Changes Proposed by AI</h3>
              <div className="max-h-80 overflow-y-auto mb-4">
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Command</th>
                      <th className="p-2 border">Day</th>
                      <th className="p-2 border">Time</th>
                      <th className="p-2 border">Level</th>
                      <th className="p-2 border">Subject</th>
                      <th className="p-2 border">Teacher</th>
                      <th className="p-2 border">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiPlannedCommands.map((cmd, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border font-semibold">{cmd.command}</td>
                        <td className="p-2 border">{cmd.day || ''}</td>
                        <td className="p-2 border">{cmd.time || ''}</td>
                        <td className="p-2 border">{cmd.level || ''}</td>
                        <td className="p-2 border">{cmd.subject || ''}</td>
                        <td className="p-2 border">{cmd.teacher_id ? (teachers.find(t => t.id === cmd.teacher_id)?.name || cmd.teacher_id) : ''}</td>
                        <td className="p-2 border">{cmd.id || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-sm"
                  onClick={() => {
                    setShowAICommandReview(false)
                    setAiPlannedCommands([])
                  }}
                >
                  Clear Commands
                </button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm"
                  onClick={async () => {
                    await applyAICommands(aiPlannedCommands)
                  }}
                >
                  Confirm & Apply Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Scheduler View */}
        {aiSchedulerMode && (
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">AI Scheduler</h3>
              <div className="flex gap-2">
                {/* Remove AI Fill button, keep Submit Schedule */}
                <button
                  onClick={handleAISubmit}
                  className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                >
                  Submit Schedule
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 border-b bg-gray-50">Level</th>
                    {days.map(day => (
                      <th key={day} className="p-2 border-b bg-gray-50">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {levels.map(level => (
                    <tr key={level}>
                      <td className="p-2 font-semibold border-b bg-gray-50">{level}</td>
                      {days.map(day => (
                        <td key={day} className="p-2 border-b">
                          <div className="flex flex-col gap-1">
                            <input
                              type="time"
                              value={aiScheduleMatrix[level][day].time}
                              onChange={e => setAiScheduleMatrix((m: ScheduleMatrix) => ({
                                ...m,
                                [level]: {
                                  ...m[level],
                                  [day]: { ...m[level][day], time: e.target.value }
                                }
                              }))}
                              className="w-full px-1 py-1 border border-gray-200 rounded text-xs mb-1"
                            />
                            <select
                              value={aiScheduleMatrix[level][day].subject}
                              onChange={e => setAiScheduleMatrix((m: ScheduleMatrix) => ({
                                ...m,
                                [level]: {
                                  ...m[level],
                                  [day]: { ...m[level][day], subject: e.target.value }
                                }
                              }))}
                              className="w-full px-1 py-1 border border-gray-200 rounded text-xs mb-1"
                            >
                              <option value="">Subject</option>
                              {subjects.map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                              ))}
                            </select>
                            <select
                              value={aiScheduleMatrix[level][day].teacher_id}
                              onChange={e => setAiScheduleMatrix((m: ScheduleMatrix) => ({
                                ...m,
                                [level]: {
                                  ...m[level],
                                  [day]: { ...m[level][day], teacher_id: e.target.value }
                                }
                              }))}
                              className="w-full px-1 py-1 border border-gray-200 rounded text-xs"
                            >
                              <option value="">Teacher</option>
                              {teachers.map(teacher => (
                                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedules List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 sm:p-6 border-b">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Weekly Schedule</h3>
          </div>
          
          {schedules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Teacher</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                        {schedule.day}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {schedule.time}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {schedule.level}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {schedule.subject}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                        {schedule.users?.name}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="text-emerald-600 hover:text-emerald-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 sm:p-6 text-center text-gray-500 text-sm">
              No schedules created yet. Click "Add Schedule" to get started.
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{levels.length}</div>
              <div className="text-sm sm:text-base text-gray-600">Grade Levels</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{schedules.length}</div>
              <div className="text-sm sm:text-base text-gray-600">Active Schedules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{teachers.length}</div>
              <div className="text-sm sm:text-base text-gray-600">Teachers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{subjects.length}</div>
              <div className="text-sm sm:text-base text-gray-600">Subjects</div>
            </div>
          </div>
        </div>
      </div>

      <AIButton userRole="admin" />
    </Layout>
  )
}

// Types for matrix and updates
type ScheduleCell = { subject: string; teacher_id: string; time: string }
type ScheduleMatrix = { [level: string]: { [day: string]: ScheduleCell } }