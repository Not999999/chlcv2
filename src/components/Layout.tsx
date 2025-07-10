import React from 'react'
import { LogOut, GraduationCap } from 'lucide-react'
import { getCurrentStaffUser, logoutStaff } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
  title: string
  isCreatorLayout?: boolean
}

export function Layout({ children, title, isCreatorLayout = false }: LayoutProps) {
  const navigate = useNavigate()
  const [user, setUser] = React.useState<any>(null)

  React.useEffect(() => {
    if (isCreatorLayout) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      }
      getUser()
    } else {
      const staffUser = getCurrentStaffUser()
      setUser(staffUser)
    }
  }, [isCreatorLayout])

  const handleLogout = async () => {
    if (isCreatorLayout) {
      await supabase.auth.signOut()
      navigate('/creator-login')
    } else {
      logoutStaff()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">EduSync</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Charis Hope Learning Centre</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {user?.name || user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role || 'User'}
                </p>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
        </div>
        {children}
      </main>
    </div>
  )
}