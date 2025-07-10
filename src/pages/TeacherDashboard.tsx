import React from 'react'
import { Layout } from '../components/Layout'
import { AIButton } from '../components/AIButton'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { getCurrentStaffUser } from '../lib/auth'
import { Calendar, Users, CheckSquare, Clock, Coffee, LogOut as SignOut, FileText, Plus, Play, Square } from 'lucide-react'

export function TeacherDashboard() {
  const { showToast } = useToast()
  const [todaySchedule, setTodaySchedule] = React.useState<any[]>([])
  const [activeSessions, setActiveSessions] = React.useState<any[]>([])
  const [attendanceStatus, setAttendanceStatus] = React.useState<any>(null)
  const [behaviorReports, setBehaviorReports] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [remarks, setRemarks] = React.useState('')
  const [showSignOutForm, setShowSignOutForm] = React.useState(false)
  const [showBehaviorForm, setShowBehaviorForm] = React.useState(false)
  const [completedSession, setCompletedSession] = React.useState<any>(null)
  const [behaviorForm, setBehaviorForm] = React.useState({
    student_name: '',
    class_level: '',
    incident: '',
    action_taken: ''
  })

  const user = getCurrentStaffUser()
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  React.useEffect(() => {
    loadData()
    loadBehaviorReports()
    loadActiveSessions()
  }, [])

  const loadData = async () => {
    try {
      // Get current user from localStorage (staff login)
      const currentUser = getCurrentStaffUser()
      if (!currentUser) {
        throw new Error('No user session. Please contact creator - Shan')
      }

      // Load today's schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('day', currentDay)
        .order('time')

      if (scheduleError) throw scheduleError
      
      // Add teacher name to schedule data
      const schedulesWithTeacher = (scheduleData || []).map(schedule => ({
        ...schedule,
        users: { name: currentUser.name }
      }))
      setTodaySchedule(schedulesWithTeacher)

      // Load today's attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('date', today)
        .maybeSingle()

      if (attendanceError) {
        console.error('Attendance query error:', attendanceError)
        throw attendanceError
      }
      setAttendanceStatus(attendanceData)
    } catch (error) {
      console.error('Error loading data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadBehaviorReports = async () => {
    try {
      const currentUser = getCurrentStaffUser()
      if (!currentUser) return

      const { data: reports, error } = await supabase
        .from('behavior_reports')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Behavior reports query error:', error)
        return
      }

      setBehaviorReports(reports || [])
    } catch (error) {
      console.error('Error loading data:', error)
      showToast('Please contact creator - Shan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAttendance = async () => {
    if (attendanceStatus) {
      showToast('Attendance already confirmed for today', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const currentUser = getCurrentStaffUser()
      if (!currentUser) {
        throw new Error('No user session. Please contact creator - Shan')
      }

      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          teacher_id: currentUser.id,
          date: today,
          status: 'present'
        })

      if (error) {
        console.error('Attendance insert error:', error)
        throw new Error('Please contact creator - Shan')
      }
      
      showToast('Attendance confirmed successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Error confirming attendance:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = async (status: 'break' | 'absent') => {
    setSubmitting(true)
    try {
      const currentUser = getCurrentStaffUser()
      if (!currentUser) {
        throw new Error('No user session. Please contact creator - Shan')
      }

      if (attendanceStatus) {
        // Update existing record
        const { error } = await supabase
          .from('attendance_logs')
          .update({
            status,
            remarks: remarks || null
          })
          .eq('id', attendanceStatus.id)

        if (error) {
          console.error('Attendance update error:', error)
          throw new Error('Please contact creator - Shan')
        }
      } else {
        // Create new record
        const { error } = await supabase
          .from('attendance_logs')
          .insert({
            teacher_id: currentUser.id,
            date: today,
            status,
            remarks: remarks || null
          })

        if (error) {
          console.error('Attendance insert error:', error)
          throw new Error('Please contact creator - Shan')
        }
      }
      
      showToast(`Status updated to ${status}`, 'success')
      setShowSignOutForm(false)
      setRemarks('')
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const loadActiveSessions = async () => {
    try {
      const currentUser = getCurrentStaffUser()
      if (!currentUser) return

      const { data: sessions, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('status', 'active')
        .order('start_time', { ascending: false })

      if (error) {
        console.error('Active sessions query error:', error)
        return
      }

      setActiveSessions(sessions || [])
    } catch (error) {
      console.error('Error loading active sessions:', error)
    }
  }

  const canStartClass = (schedule: any) => {
    const now = new Date()
    const [hours, minutes] = schedule.time.split(':').map(Number)
    const classTime = new Date()
    classTime.setHours(hours, minutes, 0, 0)
    
    // Can start 15 minutes before class time
    const startWindow = new Date(classTime.getTime() - 15 * 60 * 1000)
    
    // Check if already started
    const alreadyStarted = activeSessions.some(session => 
      session.schedule_id === schedule.id && session.status === 'active'
    )
    
    return now >= startWindow && !alreadyStarted
  }

  const getActiveSession = (schedule: any) => {
    return activeSessions.find(session => 
      session.schedule_id === schedule.id && session.status === 'active'
    )
  }

  const handleStartClass = async (schedule: any) => {
    const currentUser = getCurrentStaffUser()
    if (!currentUser) {
      showToast('No user session. Please contact creator - Shan', 'error')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('class_sessions')
        .insert({
          teacher_id: currentUser.id,
          schedule_id: schedule.id,
          class_level: schedule.level,
          subject: schedule.subject,
          status: 'active'
        })

      if (error) {
        console.error('Start class error:', error)
        throw new Error('Error managing class. Please contact Creator - Shan')
      }

      showToast('Class started successfully', 'success')
      loadActiveSessions()
    } catch (error) {
      console.error('Error starting class:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error managing class. Please contact Creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEndClass = async (session: any) => {
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('class_sessions')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', session.id)

      if (error) {
        console.error('End class error:', error)
        throw new Error('Error managing class. Please contact Creator - Shan')
      }

      // Calculate duration
      const startTime = new Date(session.start_time)
      const endTime = new Date()
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      setCompletedSession({
        ...session,
        end_time: endTime.toISOString(),
        duration
      })

      showToast('Class ended. Summary generated', 'success')
      loadActiveSessions()
    } catch (error) {
      console.error('Error ending class:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error managing class. Please contact Creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBehaviorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const currentUser = getCurrentStaffUser()
    if (!currentUser) {
      showToast('No user session. Please contact creator - Shan', 'error')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('behavior_reports')
        .insert({
          student_name: behaviorForm.student_name,
          class_level: behaviorForm.class_level,
          incident: behaviorForm.incident,
          action_taken: behaviorForm.action_taken,
          teacher_id: currentUser.id
        })

      if (error) {
        console.error('Behavior report insert error:', error)
        throw new Error('Please contact creator - Shan')
      }

      showToast('Behavior report submitted successfully', 'success')
      setShowBehaviorForm(false)
      setBehaviorForm({
        student_name: '',
        class_level: '',
        incident: '',
        action_taken: ''
      })
      loadBehaviorReports()
    } catch (error) {
      console.error('Error submitting behavior report:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please contact creator - Shan'
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Teacher Dashboard">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Teacher Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-orange-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            Welcome, Teacher {user?.name || 'Teacher'}
          </h3>
          <p className="text-orange-700">
            Today is {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Attendance Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckSquare className="h-5 w-5 mr-2 text-orange-600" />
            Daily Attendance
          </h3>
          
          <div className="space-y-4">
            {attendanceStatus ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900">
                      Status: <span className="capitalize">{attendanceStatus.status}</span>
                    </p>
                    {attendanceStatus.remarks && (
                      <p className="text-sm text-green-700 mt-1">
                        Remarks: {attendanceStatus.remarks}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-green-600">
                    {new Date(attendanceStatus.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 mb-3">Please confirm your attendance for today</p>
                <button
                  onClick={handleConfirmAttendance}
                  disabled={submitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Confirming...' : 'Confirm Attendance'}
                </button>
              </div>
            )}

            {/* Sign Out Options */}
            {attendanceStatus && attendanceStatus.status === 'present' && (
              <div className="space-y-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSignOutForm(true)}
                    className="flex items-center px-3 sm:px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Take Break</span>
                    <span className="sm:hidden">Break</span>
                  </button>
                  <button
                    onClick={() => handleSignOut('absent')}
                    disabled={submitting}
                    className="flex items-center px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    <SignOut className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Sign Out</span>
                    <span className="sm:hidden">Out</span>
                  </button>
                </div>

                {showSignOutForm && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Remarks (optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      rows={3}
                      placeholder="Add any remarks..."
                    />
                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
                      <button
                        onClick={() => handleSignOut('break')}
                        disabled={submitting}
                        className="px-3 sm:px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 transition-colors text-sm"
                      >
                        {submitting ? 'Updating...' : 'Confirm Break'}
                      </button>
                      <button
                        onClick={() => setShowSignOutForm(false)}
                        className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-orange-600" />
            Today's Schedule ({currentDay})
          </h3>
          
          {todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((schedule) => {
                const activeSession = getActiveSession(schedule)
                const canStart = canStartClass(schedule)
                
                return (
                  <div key={schedule.id} className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {schedule.level} - {schedule.subject}
                        </p>
                        <p className="text-sm text-gray-600">
                          Time: {schedule.time}
                        </p>
                        {activeSession && (
                          <p className="text-sm text-green-600 font-medium">
                            ✅ Class in session (started {new Date(activeSession.start_time).toLocaleTimeString()})
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          {schedule.time}
                        </span>
                        
                        {/* Class Control Buttons */}
                        {canStart && !activeSession && (
                          <button
                            onClick={() => handleStartClass(schedule)}
                            disabled={submitting}
                            className="flex items-center px-2 sm:px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-xs sm:text-sm"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Start Class</span>
                            <span className="sm:hidden">Start</span>
                          </button>
                        )}
                        
                        {activeSession && (
                          <button
                            onClick={() => handleEndClass(activeSession)}
                            disabled={submitting}
                            className="flex items-center px-2 sm:px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-xs sm:text-sm"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">End Class</span>
                            <span className="sm:hidden">End</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No classes scheduled for today
            </p>
          )}
        </div>

        {/* Behavior Reports Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-orange-600" />
              Behavior Reports
            </h3>
            <button
              onClick={() => setShowBehaviorForm(true)}
              className="flex items-center px-2 sm:px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New Report</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>

          {/* Behavior Report Form */}
          {showBehaviorForm && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="text-sm sm:text-base font-medium text-gray-900 mb-3">Submit Behavior Report</h4>
              
              <form onSubmit={handleBehaviorSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Student Name</label>
                    <input
                      type="text"
                      value={behaviorForm.student_name}
                      onChange={(e) => setBehaviorForm(prev => ({ ...prev, student_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class Level</label>
                    <select
                      value={behaviorForm.class_level}
                      onChange={(e) => setBehaviorForm(prev => ({ ...prev, class_level: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    >
                      <option value="">Select Level</option>
                      <option value="Pre-K">Pre-K</option>
                      <option value="K1">K1</option>
                      <option value="K2">K2</option>
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                      <option value="P3">P3</option>
                      <option value="P4">P4</option>
                      <option value="P5">P5</option>
                      <option value="P6">P6</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Incident Description</label>
                  <textarea
                    value={behaviorForm.incident}
                    onChange={(e) => setBehaviorForm(prev => ({ ...prev, incident: e.target.value }))}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    placeholder="Describe what happened..."
                  />
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Action Taken</label>
                  <textarea
                    value={behaviorForm.action_taken}
                    onChange={(e) => setBehaviorForm(prev => ({ ...prev, action_taken: e.target.value }))}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    placeholder="Describe what action was taken..."
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBehaviorForm(false)}
                    className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Recent Reports */}
          {behaviorReports.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs sm:text-sm font-medium text-gray-700">Your Recent Reports</h4>
              {behaviorReports.map((report) => (
                <div key={report.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {report.student_name} ({report.class_level})
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 mb-2">
                    <strong>Incident:</strong> {report.incident}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700">
                    <strong>Action:</strong> {report.action_taken}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4 text-sm">
              No behavior reports submitted yet.
            </p>
          )}
        </div>

        {/* Class Summary Modal */}
        {completedSession && (
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckSquare className="h-5 w-5 mr-2 text-green-600" />
              ✅ Class Summary
            </h3>
            
            <div className="space-y-2 text-xs sm:text-sm">
              <p><strong>Subject:</strong> {completedSession.subject}</p>
              <p><strong>Level:</strong> {completedSession.class_level}</p>
              <p><strong>Duration:</strong> {completedSession.duration} minutes</p>
              <p><strong>Started at:</strong> {new Date(completedSession.start_time).toLocaleTimeString()}</p>
              <p><strong>Ended at:</strong> {new Date(completedSession.end_time).toLocaleTimeString()}</p>
            </div>
            
            <button
              onClick={() => setCompletedSession(null)}
              className="mt-4 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              Close Summary
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-orange-600">{todaySchedule.length}</div>
              <div className="text-xs sm:text-sm text-gray-600">Classes Today</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-orange-600">{behaviorReports.length}</div>
              <div className="text-xs sm:text-sm text-gray-600">Behavior Reports</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                attendanceStatus?.status === 'present' ? 'text-green-600' :
                attendanceStatus?.status === 'break' ? 'text-yellow-600' :
                attendanceStatus?.status === 'absent' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {attendanceStatus?.status ? attendanceStatus.status.charAt(0).toUpperCase() + attendanceStatus.status.slice(1) : 'Not Set'}
              </div>
              <div className="text-xs sm:text-sm text-gray-600">Current Status</div>
            </div>
          </div>
        </div>
      </div>

      <AIButton userRole="teacher" />
    </Layout>
  )
}