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
import { MaintenanceProvider, useMaintenanceStatus } from './contexts/MaintenanceContext'
import { getCurrentStaffUser } from './lib/auth' // To get user role

// Updated MaintenanceGuard to use the context
function MaintenanceGuardContent({ children }: { children: React.ReactNode }) {
  const { isMaintenanceModeActive, isLoadingMaintenanceStatus } = useMaintenanceStatus();
  const location = window.location.pathname;
  const user = getCurrentStaffUser();

  if (isLoadingMaintenanceStatus) {
    // Full page loader while fetching maintenance status.
    // IntroSplash might have finished by the time this context loads.
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500"></div>
        <p className="ml-4 text-lg text-gray-700">Checking system status...</p>
      </div>
    );
  }

  if (isMaintenanceModeActive) {
    if (user?.role === 'creator') {
      // Creator sees the site with a banner
      return (
        <>
          <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-3 text-center z-[9998] shadow-lg">
            <p className="text-sm font-semibold">
              ⚠️ MAINTENANCE MODE IS ACTIVE. Regular users are seeing the maintenance page. You have full access.
            </p>
          </div>
          <div className="pt-12"> {/* Add padding to offset the banner */}
            {children}
          </div>
        </>
      );
    } else if (location !== '/creator-login') {
      // Non-creators (and not on creator login) see the Maintenance page
      return <Maintenance />;
    }
  }

  // If not in maintenance mode, or if creator on creator-login, render children normally
  return <>{children}</>;
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
        <MaintenanceProvider> {/* Provider wraps routes and guard */}
          <MaintenanceGuardContent> {/* Renamed to avoid conflict and use hook */}
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