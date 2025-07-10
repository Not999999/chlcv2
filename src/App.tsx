import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CreatorLogin } from './pages/CreatorLogin'
import { StaffLogin } from './pages/StaffLogin'
import { CreatorDashboard } from './pages/CreatorDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { HeadDashboard } from './pages/HeadDashboard'
import { TeacherDashboard } from './pages/TeacherDashboard'
import { AllBehaviorReportsPage } from './pages/AllBehaviorReportsPage'
import Maintenance from './pages/Maintenance'
import ReportViewer from './pages/ReportViewer'
import { IntroSplash } from './components/IntroSplash'

function isMaintenanceMode() {
  return localStorage.getItem('maintenanceMode') === 'true'
}

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const location = window.location.pathname
  // Only allow creator to bypass maintenance
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
  // Allow /creator-login to bypass maintenance
  if (isMaintenanceMode() && user?.role !== 'creator' && location !== '/creator-login') {
    return <Maintenance />
  }
  return <>{children}</>
}

function App() {
  // Always show splash on every refresh (do not use sessionStorage)
  const [showSplash, setShowSplash] = React.useState(true);

  const handleSplashFinish = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <ToastProvider>
      {showSplash && <IntroSplash onFinish={handleSplashFinish} />}
      <Router>
        <MaintenanceGuard>
          <Routes>
            {/* Public Routes */}
            <Route path="/creator-login" element={<CreatorLogin />} />
            <Route path="/login" element={<StaffLogin />} />
            
            {/* Protected Routes */}
            <Route 
              path="/creator" 
              element={
                <ProtectedRoute requiredRole="creator" isCreatorRoute>
                  <CreatorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/head" 
              element={
                <ProtectedRoute requiredRole="head">
                  <HeadDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teacher" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/behavior-reports" 
              element={
                <ProtectedRoute requiredRole="head">
                  <AllBehaviorReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route path="/school-report-viewer" element={<ReportViewer />} />
            {/* Maintenance Standalone Route (for direct access) */}
            <Route path="/maintenance" element={<Maintenance />} />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </MaintenanceGuard>
      </Router>
    </ToastProvider>
  )
}

export default App