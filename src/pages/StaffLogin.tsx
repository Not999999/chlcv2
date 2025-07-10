import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticateStaff } from '../lib/auth'
import { GraduationCap, Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react'

export function StaffLogin() {
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await authenticateStaff(credentials.email, credentials.password)
      let redirectPath = '/teacher'
      if (user && typeof user.role === 'string') {
        if (user.role === 'admin') redirectPath = '/admin'
        else if (user.role === 'head') redirectPath = '/head'
        else if (user.role === 'teacher') redirectPath = '/teacher'
      }
      setTimeout(() => {
        navigate(redirectPath)
      }, 100)
    } catch (err) {
      console.error('Login error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Invalid login credentials. Please contact creator - Shan'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <GraduationCap className="h-12 w-12 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">EduSync Staff</h1>
            <p className="text-gray-600 mt-2">Charis Hope Learning Centre</p>
            <p className="text-sm text-gray-500 mt-1">Staff Portal Login</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10 pr-12 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-label="Password"
                />
                {/* Show/Hide password toggle button */}
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-2 p-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white hover:bg-emerald-50 transition"
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-emerald-600" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              System creator?{' '}
              <button
                onClick={() => navigate('/creator-login')}
                className="text-emerald-600 hover:text-emerald-800 underline"
              >
                Creator login
              </button>
            </p>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600 text-center">
              <strong>Demo Credentials:</strong><br />
              Admin: admin@charishope.edu<br />
              Head: head@charishope.edu<br />
              Teacher: teacher@charishope.edu<br />
              Password: password
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}